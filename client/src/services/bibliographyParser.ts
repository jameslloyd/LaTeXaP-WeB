import type {
  BibEntry,
  BibliographyStylePreset,
  CitationCommandStyle,
} from '@shared/types/academic.js';
import { AcademicSanitizer } from './academicToolsGenerator.js';

export function parseBibTeX(bibText: string): BibEntry[] {
  const entries: BibEntry[] = [];
  if (!bibText || !bibText.trim()) return entries;

  const entryHeaderRe = /@([a-zA-Z]+)\s*\{\s*([^,\s]+)\s*,/g;
  const matches = Array.from(bibText.matchAll(entryHeaderRe));

  for (let i = 0; i < matches.length; i += 1) {
    const m = matches[i];
    const startIdx = m.index ?? 0;
    const entryType = m[1].toLowerCase();
    const citeKey = m[2].trim();

    // Find matching closing brace for the entry
    let depth = 0;
    let endIdx = bibText.length;
    const openBraceIdx = bibText.indexOf('{', startIdx);
    for (let pos = openBraceIdx; pos < bibText.length; pos += 1) {
      if (bibText[pos] === '{') depth += 1;
      else if (bibText[pos] === '}') {
        depth -= 1;
        if (depth === 0) {
          endIdx = pos + 1;
          break;
        }
      }
    }

    const rawBibTeX = bibText.slice(startIdx, endIdx).trim();
    const body = rawBibTeX.slice(rawBibTeX.indexOf(',') + 1, -1);

    const readField = (fieldName: string): string => {
      const re = new RegExp(`(?:^|,)\\s*${fieldName}\\s*=\\s*(?:\\{([\\s\\S]*?)\\}|"([^"]*)"|(\\d+))`, 'im');
      const fm = body.match(re);
      return (fm?.[1] || fm?.[2] || fm?.[3] || '').replace(/\s+/g, ' ').trim();
    };

    const authorRaw = readField('author');
    const authors = authorRaw
      ? authorRaw.split(/\s+and\s+/i).map((a) => a.trim()).filter(Boolean)
      : [];

    entries.push({
      id: `${citeKey}-${i}`,
      citeKey,
      entryType,
      title: readField('title') || citeKey,
      authors,
      year: readField('year') || '',
      venue: readField('journal') || readField('booktitle') || readField('publisher') || undefined,
      doi: readField('doi') || undefined,
      url: readField('url') || undefined,
      isbn: readField('isbn') || undefined,
      arxivId: readField('eprint') || undefined,
      pages: readField('pages') || undefined,
      volume: readField('volume') || undefined,
      number: readField('number') || undefined,
      publisher: readField('publisher') || undefined,
      rawBibTeX,
    });
  }

  return entries;
}

export function extractDocumentLabels(
  texSource: string
): Array<{ key: string; line: number; kind: string }> {
  const results: Array<{ key: string; line: number; kind: string }> = [];
  const lines = (texSource || '').split(/\r?\n/);

  for (let i = 0; i < lines.length; i += 1) {
    const lineNum = i + 1;
    for (const m of lines[i].matchAll(/\\label\{([^}]+)\}/g)) {
      const key = m[1].trim();
      const kind = key.includes(':') ? key.split(':')[0] : 'ref';
      results.push({ key, line: lineNum, kind });
    }
  }
  return results;
}

export function extractCitedKeys(texSource: string): string[] {
  const keys = new Set<string>();
  for (const m of (texSource || '').matchAll(
    /\\(?:cite|parencite|textcite|autocite|footcite)(?:\[[^\]]*\])?\{([^}]+)\}/g
  )) {
    for (const k of m[1].split(',').map((s) => s.trim()).filter(Boolean)) {
      keys.add(k);
    }
  }
  return Array.from(keys);
}

export function formatCitationCommand(
  key: string,
  style: CitationCommandStyle,
  pageLocator?: string
): string {
  const safeKey = AcademicSanitizer.sanitizeIdentifier(key, 'citation');
  const safeLocator = AcademicSanitizer.sanitizeCitationLocator(pageLocator ?? '');
  return safeLocator ? `\\${style}[${safeLocator}]{${safeKey}}` : `\\${style}{${safeKey}}`;
}

export function formatBibliographyPreview(
  entry: BibEntry,
  style: BibliographyStylePreset
): string {
  const authorsText = entry.authors.length > 0 ? entry.authors.join('; ') : 'Unknown Author';
  const year = entry.year || 'n.d.';
  if (style === 'ieee' || style === 'nature') {
    return `${authorsText}, "${entry.title}," ${entry.venue || 'Preprint'}, ${year}.`;
  }
  return `${authorsText} (${year}). ${entry.title}.${entry.venue ? ` ${entry.venue}.` : ''}`;
}
