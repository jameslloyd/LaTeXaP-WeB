import crypto from 'node:crypto';
import type { BibEntry } from '../../shared/types/academic.js';
import { HttpError } from '../middleware/errorMiddleware.js';

const ALLOWED_CITATION_HOSTS = new Set([
  'api.crossref.org',
  'export.arxiv.org',
  'openlibrary.org',
]);

const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 8000;

export type FetchImpl = typeof fetch;

const DANGEROUS_TEX_PRIMITIVES_RE =
  /\\(?:write18|immediate|openout|newwrite|catcode|input|include|@@input|verbatiminput|lstinputlisting|ShellEscape|pdffilemoddate|directlua)\b/gi;

function sanitizeMetadataText(raw: string): string {
  return (raw || '')
    .replace(/[\r\n\t\0\x00-\x1f]/g, ' ')
    .replace(DANGEROUS_TEX_PRIMITIVES_RE, '')
    .replace(/[\\{}]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function makeCiteKey(authors: string[], year: string, title: string): string {
  const firstAuthor = authors[0] || 'Author';
  const lastName =
    firstAuthor
      .split(',')[0]
      .split(/\s+/)
      .pop()
      ?.toLowerCase()
      .replace(/[^a-z0-9]/g, '') || 'ref';
  const cleanYear = (year || 'nd').replace(/[^0-9]/g, '').slice(0, 4) || 'nd';
  const firstWord =
    title
      .toLowerCase()
      .split(/\s+/)
      .find((w) => w.replace(/[^a-z0-9]/g, '').length > 3)
      ?.replace(/[^a-z0-9]/g, '') || 'paper';
  return `${lastName}${cleanYear}${firstWord}`;
}

function buildRawBibTeX(entry: Omit<BibEntry, 'id' | 'rawBibTeX'>): string {
  const fields: string[] = [];
  if (entry.authors.length > 0) {
    fields.push(`  author = {${entry.authors.join(' and ')}}`);
  }
  fields.push(`  title = {${entry.title}}`);
  if (entry.year) fields.push(`  year = {${entry.year}}`);
  if (entry.venue) {
    const fieldName = entry.entryType === 'inproceedings' ? 'booktitle' : 'journal';
    fields.push(`  ${fieldName} = {${entry.venue}}`);
  }
  if (entry.volume) fields.push(`  volume = {${entry.volume}}`);
  if (entry.number) fields.push(`  number = {${entry.number}}`);
  if (entry.pages) fields.push(`  pages = {${entry.pages}}`);
  if (entry.publisher) fields.push(`  publisher = {${entry.publisher}}`);
  if (entry.doi) fields.push(`  doi = {${entry.doi}}`);
  if (entry.isbn) fields.push(`  isbn = {${entry.isbn}}`);
  if (entry.arxivId) fields.push(`  eprint = {${entry.arxivId}}`);
  if (entry.url) fields.push(`  url = {${entry.url}}`);

  return `@${entry.entryType}{${entry.citeKey},\n${fields.join(',\n')}\n}`;
}

function mapCrossRefWork(item: Record<string, unknown>): BibEntry {
  const titles = Array.isArray(item.title) ? (item.title as string[]) : [];
  const title = sanitizeMetadataText(titles[0] || 'Untitled Work');

  const rawAuthors = Array.isArray(item.author) ? (item.author as Array<Record<string, string>>) : [];
  const authors = rawAuthors
    .map((a) => {
      const family = sanitizeMetadataText(a.family || '');
      const given = sanitizeMetadataText(a.given || '');
      if (family && given) return `${family}, ${given}`;
      return family || given;
    })
    .filter(Boolean);

  const issued = item.issued as { 'date-parts'?: number[][] } | undefined;
  const yearNum = issued?.['date-parts']?.[0]?.[0];
  const year = yearNum ? String(yearNum) : '';

  const container = Array.isArray(item['container-title'])
    ? sanitizeMetadataText(String(item['container-title'][0] || ''))
    : undefined;
  const doi = typeof item.DOI === 'string' ? sanitizeMetadataText(item.DOI) : undefined;
  const url = typeof item.URL === 'string' ? sanitizeMetadataText(item.URL) : undefined;
  const typeRaw = typeof item.type === 'string' ? item.type : '';
  const entryType =
    typeRaw === 'proceedings-article'
      ? 'inproceedings'
      : typeRaw === 'book' || typeRaw === 'monograph'
        ? 'book'
        : 'article';

  const citeKey = makeCiteKey(authors, year, title);
  const base: Omit<BibEntry, 'id' | 'rawBibTeX'> = {
    citeKey,
    entryType,
    title,
    authors,
    year,
    venue: container || undefined,
    doi,
    url,
    volume: typeof item.volume === 'string' ? sanitizeMetadataText(item.volume) : undefined,
    number: typeof item.issue === 'string' ? sanitizeMetadataText(item.issue) : undefined,
    pages: typeof item.page === 'string' ? sanitizeMetadataText(item.page) : undefined,
    publisher: typeof item.publisher === 'string' ? sanitizeMetadataText(item.publisher) : undefined,
  };

  return {
    id: crypto.randomUUID(),
    ...base,
    rawBibTeX: buildRawBibTeX(base),
  };
}

export class CitationProxyService {
  private readonly fetchFn: FetchImpl;

  constructor(fetchFn: FetchImpl = fetch) {
    this.fetchFn = fetchFn;
  }

  private async safeFetchText(urlString: string, accept: string): Promise<string> {
    let parsed: URL;
    try {
      parsed = new URL(urlString);
    } catch {
      throw new HttpError(400, 'Invalid upstream URL', 'INVALID_UPSTREAM_URL');
    }
    if (parsed.protocol !== 'https:' || !ALLOWED_CITATION_HOSTS.has(parsed.hostname)) {
      throw new HttpError(403, `Host '${parsed.hostname}' is not in citation allowlist`, 'HOST_NOT_ALLOWED');
    }

    const res = await this.fetchFn(parsed.toString(), {
      method: 'GET',
      headers: {
        Accept: accept,
        'User-Agent': 'LaTeXaP-WeB/0.3.2 (mailto:support@latexap.dev)',
      },
      redirect: 'error',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (res.status === 404) {
      throw new HttpError(404, 'Citation identifier not found', 'CITATION_NOT_FOUND');
    }
    if (!res.ok) {
      throw new HttpError(502, `Upstream citation provider error (${res.status})`, 'UPSTREAM_ERROR');
    }

    const contentLenHeader = res.headers.get('content-length');
    if (contentLenHeader && Number(contentLenHeader) > MAX_RESPONSE_BYTES) {
      throw new HttpError(502, 'Upstream response exceeds 2 MB safety limit', 'RESPONSE_TOO_LARGE');
    }

    if (!res.body) {
      const text = await res.text();
      if (Buffer.byteLength(text, 'utf8') > MAX_RESPONSE_BYTES) {
        throw new HttpError(502, 'Upstream response exceeds 2 MB safety limit', 'RESPONSE_TOO_LARGE');
      }
      return text;
    }

    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        totalBytes += value.byteLength;
        if (totalBytes > MAX_RESPONSE_BYTES) {
          await reader.cancel();
          throw new HttpError(502, 'Upstream response exceeds 2 MB safety limit', 'RESPONSE_TOO_LARGE');
        }
        chunks.push(value);
      }
    }

    const combined = Buffer.concat(chunks.map((c) => Buffer.from(c)));
    return combined.toString('utf8');
  }

  async searchCrossRef(query: string, rows = 10): Promise<BibEntry[]> {
    const cleanQuery = (query || '').trim();
    if (!cleanQuery) {
      throw new HttpError(400, 'Search query is required', 'MISSING_QUERY');
    }
    const clampedRows = Math.min(20, Math.max(1, Math.round(rows)));
    const url = `https://api.crossref.org/works?query=${encodeURIComponent(cleanQuery)}&rows=${clampedRows}`;
    const text = await this.safeFetchText(url, 'application/json');
    const json = JSON.parse(text) as { message?: { items?: Array<Record<string, unknown>> } };
    const items = json.message?.items ?? [];
    return items.map(mapCrossRefWork);
  }

  async lookupByIdentifier(rawIdentifier: string): Promise<BibEntry> {
    const id = (rawIdentifier || '').trim();
    if (!id) {
      throw new HttpError(400, 'Identifier (DOI, arXiv ID, or ISBN) is required', 'MISSING_IDENTIFIER');
    }

    // 1. DOI
    const doiClean = id.replace(/^https?:\/\/(dx\.)?doi\.org\//i, '').replace(/^doi:\s*/i, '').trim();
    if (/^10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+$/.test(doiClean)) {
      const url = `https://api.crossref.org/works/${encodeURIComponent(doiClean)}`;
      const text = await this.safeFetchText(url, 'application/json');
      const json = JSON.parse(text) as { message?: Record<string, unknown> };
      if (!json.message) {
        throw new HttpError(404, `DOI '${doiClean}' not found`, 'CITATION_NOT_FOUND');
      }
      return mapCrossRefWork(json.message);
    }

    // 2. arXiv ID
    const arxivClean = id.replace(/^https?:\/\/arxiv\.org\/(abs|pdf)\//i, '').replace(/^arXiv:\s*/i, '').replace(/\.pdf$/i, '').trim();
    if (/^\d{4}\.\d{4,5}(v\d+)?$/i.test(arxivClean) || /^[a-z-]+\/\d{7}(v\d+)?$/i.test(arxivClean)) {
      const url = `https://export.arxiv.org/api/query?id_list=${encodeURIComponent(arxivClean)}`;
      const xml = await this.safeFetchText(url, 'application/atom+xml');
      const entryMatch = xml.match(/<entry>([\s\S]*?)<\/entry>/i);
      if (!entryMatch) {
        throw new HttpError(404, `arXiv ID '${arxivClean}' not found`, 'CITATION_NOT_FOUND');
      }
      const entryXml = entryMatch[1];
      const titleMatch = entryXml.match(/<title>([\s\S]*?)<\/title>/i);
      const publishedMatch = entryXml.match(/<published>(\d{4})/i);
      const authorMatches = Array.from(entryXml.matchAll(/<author>\s*<name>([\s\S]*?)<\/name>/gi));
      const title = sanitizeMetadataText(titleMatch?.[1] || 'Untitled arXiv Preprint');
      const authors = authorMatches.map((m) => sanitizeMetadataText(m[1])).filter(Boolean);
      const year = publishedMatch?.[1] || '';
      const citeKey = makeCiteKey(authors, year, title);
      const base: Omit<BibEntry, 'id' | 'rawBibTeX'> = {
        citeKey,
        entryType: 'misc',
        title,
        authors,
        year,
        venue: `arXiv:${arxivClean}`,
        arxivId: arxivClean,
        url: `https://arxiv.org/abs/${arxivClean}`,
      };
      return {
        id: crypto.randomUUID(),
        ...base,
        rawBibTeX: buildRawBibTeX(base),
      };
    }

    // 3. ISBN
    const isbnClean = id.replace(/^isbn:\s*/i, '').replace(/[-\s]/g, '');
    if (/^(97[89])?\d{9}[\dXx]$/.test(isbnClean)) {
      const url = `https://openlibrary.org/isbn/${encodeURIComponent(isbnClean)}.json`;
      const text = await this.safeFetchText(url, 'application/json');
      const book = JSON.parse(text) as Record<string, unknown>;
      const title = sanitizeMetadataText(String(book.title || 'Untitled Book'));
      const publishDate = String(book.publish_date || '');
      const yearMatch = publishDate.match(/\d{4}/);
      const year = yearMatch ? yearMatch[0] : '';
      const publishers = Array.isArray(book.publishers) ? book.publishers.map((p) => sanitizeMetadataText(String(p))) : [];
      const citeKey = makeCiteKey(['Book'], year, title);
      const base: Omit<BibEntry, 'id' | 'rawBibTeX'> = {
        citeKey,
        entryType: 'book',
        title,
        authors: [],
        year,
        publisher: publishers[0],
        isbn: isbnClean,
      };
      return {
        id: crypto.randomUUID(),
        ...base,
        rawBibTeX: buildRawBibTeX(base),
      };
    }

    throw new HttpError(400, 'Identifier must be a valid DOI, arXiv ID, or ISBN', 'UNRECOGNIZED_IDENTIFIER');
  }
}
