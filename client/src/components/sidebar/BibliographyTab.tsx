import React, { useMemo, useRef, useState } from 'react';
import { BookOpen, Loader2, Plus, Search, Upload } from 'lucide-react';
import type { BibEntry, BibliographyStylePreset, CitationCommandStyle } from '@shared/types';

const BIB_STYLES: Array<{ id: BibliographyStylePreset; label: string }> = [
  { id: 'apa', label: 'APA' },
  { id: 'ieee', label: 'IEEE' },
  { id: 'acm', label: 'ACM' },
  { id: 'mla', label: 'MLA' },
  { id: 'chicago', label: 'Chicago' },
  { id: 'nature', label: 'Nature' },
];

const CITE_COMMANDS: CitationCommandStyle[] = ['cite', 'parencite', 'textcite', 'autocite', 'footcite'];

export interface BibliographyTabProps {
  sourceText: string;
  bibEntries: BibEntry[];
  bibSearchResults: BibEntry[];
  isSearchingCitations: boolean;
  selectedBibliographyStyle: BibliographyStylePreset;
  onChangeBibliographyStyle: (style: BibliographyStylePreset) => void;
  onSearchCitations: (query: string) => Promise<void>;
  onLookupIdentifier: (identifier: string) => Promise<void>;
  onImportBibEntry: (entry: BibEntry) => void;
  onImportBibFile: (file: File) => Promise<void>;
  onInsertCitation: (entry: BibEntry, style: CitationCommandStyle, pageLocator?: string) => void;
  onInsertText: (text: string, backtrackOffset?: number) => void;
}

export const BibliographyTab: React.FC<BibliographyTabProps> = ({
  sourceText,
  bibEntries,
  bibSearchResults,
  isSearchingCitations,
  selectedBibliographyStyle,
  onChangeBibliographyStyle,
  onSearchCitations,
  onLookupIdentifier,
  onImportBibEntry,
  onImportBibFile,
  onInsertCitation,
  onInsertText,
}) => {
  const bibFileRef = useRef<HTMLInputElement | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [filterInput, setFilterInput] = useState('');
  const [pageLocators, setPageLocators] = useState<Record<string, string>>({});
  const [searchError, setSearchError] = useState<string | null>(null);
  const [duplicateCandidate, setDuplicateCandidate] = useState<BibEntry | null>(null);
  const [resultAnnouncement, setResultAnnouncement] = useState('');

  const handleLookupOrSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchInput.trim();
    if (!q) return;
    setSearchError(null);
    try {
      const looksLikeId =
        /^10\.\d{4,}\//.test(q) ||
        /^arxiv:/i.test(q) ||
        /^\d{4}\.\d{4,5}(v\d+)?$/.test(q) ||
        /^(97[89])?\d{9}[\dXx]$/.test(q.replace(/[-\s]/g, ''));
      if (looksLikeId) {
        await onLookupIdentifier(q);
        setResultAnnouncement('Citation identifier lookup completed');
      } else {
        await onSearchCitations(q);
        setResultAnnouncement('CrossRef citation search completed');
      }
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Citation lookup failed');
    }
  };

  const handleAddResult = (entry: BibEntry) => {
    const exists = bibEntries.some((b) => b.citeKey === entry.citeKey);
    if (exists) {
      setDuplicateCandidate(entry);
      return;
    }
    onImportBibEntry(entry);
  };

  const labelsInDoc = useMemo(() => {
    const lines = sourceText.split('\n');
    const found: Array<{ label: string; line: number }> = [];
    lines.forEach((ln, idx) => {
      for (const m of ln.matchAll(/\\label\{([^}]+)\}/g)) {
        found.push({ label: m[1], line: idx + 1 });
      }
    });
    const q = filterInput.trim().toLowerCase();
    return q ? found.filter((l) => l.label.toLowerCase().includes(q)) : found;
  }, [filterInput, sourceText]);

  const filteredSaved = useMemo(() => {
    const q = filterInput.trim().toLowerCase();
    if (!q) return bibEntries;
    return bibEntries.filter(
      (e) =>
        e.citeKey.toLowerCase().includes(q) ||
        e.title.toLowerCase().includes(q) ||
        e.authors.some((a) => a.toLowerCase().includes(q)) ||
        e.year.includes(q)
    );
  }, [bibEntries, filterInput]);

  const isKeyCited = (key: string) => {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`\\\\[a-zA-Z]*cite[a-zA-Z]*\\*?(\\[[^\\]]*\\])*\\{[^}]*\\b${escaped}\\b`);
    return re.test(sourceText);
  };

  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const file = e.dataTransfer.files?.[0];
        if (file && file.name.toLowerCase().endsWith('.bib')) {
          void onImportBibFile(file);
        }
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <h2 className="sidebar-section-heading" style={{ margin: 0 }}>
          Bibliography &amp; Citations
        </h2>
        <button type="button" className="btn btn-sm" onClick={() => bibFileRef.current?.click()}>
          <Upload size={11} aria-hidden="true" />
          Import .bib
        </button>
        <input
          ref={bibFileRef}
          type="file"
          accept=".bib"
          className="sr-only"
          aria-label="Import BibTeX file"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onImportBibFile(f);
          }}
        />
      </div>

      {/* Style Switcher */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }} role="group" aria-label="Bibliography style">
        {BIB_STYLES.map((st) => (
          <button
            key={st.id}
            type="button"
            className={`btn btn-sm ${selectedBibliographyStyle === st.id ? 'btn-primary' : ''}`}
            aria-pressed={selectedBibliographyStyle === st.id}
            onClick={() => onChangeBibliographyStyle(st.id)}
          >
            {st.label}
          </button>
        ))}
      </div>

      {/* CrossRef / DOI / arXiv / ISBN Search */}
      <form onSubmit={handleLookupOrSearch} style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
        <label htmlFor="bib-crossref-input" className="sr-only">
          Search DOI, arXiv ID, ISBN, or Paper Title
        </label>
        <input
          id="bib-crossref-input"
          type="text"
          className="input"
          placeholder="DOI, arXiv ID, ISBN, or Title..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        <button type="submit" className="btn btn-primary" disabled={isSearchingCitations} aria-label="Search citations">
          {isSearchingCitations ? (
            <Loader2 size={14} className="spin-icon" aria-hidden="true" />
          ) : (
            <Search size={14} aria-hidden="true" />
          )}
        </button>
      </form>

      <div className="sr-only" aria-live="polite">
        {resultAnnouncement}
      </div>

      {searchError && (
        <div role="alert" className="studio-card" style={{ background: 'var(--danger-bg)', color: 'var(--danger-text)', marginBottom: 10 }}>
          {searchError}
        </div>
      )}

      {duplicateCandidate && (
        <div
          role="alertdialog"
          aria-label="Duplicate citation key"
          className="studio-card"
          style={{ borderColor: 'var(--warning-border)', background: 'var(--warning-bg)', marginBottom: 10 }}
        >
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
            Key <code>{duplicateCandidate.citeKey}</code> already exists.
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => {
                onImportBibEntry(duplicateCandidate);
                setDuplicateCandidate(null);
              }}
            >
              Replace
            </button>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => {
                const altKey = `${duplicateCandidate.citeKey}b`;
                onImportBibEntry({
                  ...duplicateCandidate,
                  citeKey: altKey,
                  rawBibTeX: duplicateCandidate.rawBibTeX.replace(duplicateCandidate.citeKey, altKey),
                });
                setDuplicateCandidate(null);
              }}
            >
              Keep Both
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDuplicateCandidate(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Search Results */}
      {bibSearchResults.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div className="sidebar-section-heading">Lookup Results ({bibSearchResults.length})</div>
          {bibSearchResults.slice(0, 5).map((res) => (
            <div key={res.id} className="studio-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6, alignItems: 'flex-start' }}>
                <strong style={{ fontSize: 12 }}>{res.title}</strong>
                <button type="button" className="btn btn-primary btn-sm" onClick={() => handleAddResult(res)}>
                  <Plus size={11} aria-hidden="true" />
                  Add
                </button>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
                {res.authors.slice(0, 2).join(', ')} ({res.year}) • <code>{res.citeKey}</code>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filter Saved Library & Labels */}
      <div style={{ marginBottom: 10 }}>
        <label htmlFor="bib-filter-input" className="sr-only">
          Filter citations and labels
        </label>
        <input
          id="bib-filter-input"
          type="search"
          className="input"
          placeholder="Filter citations & labels..."
          value={filterInput}
          onChange={(e) => setFilterInput(e.target.value)}
        />
      </div>

      <div className="sidebar-section-heading">Saved Citations ({filteredSaved.length})</div>
      {filteredSaved.length === 0 ? (
        <div className="studio-card" style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 12 }}>
          <BookOpen size={14} aria-hidden="true" style={{ marginRight: 6, verticalAlign: 'text-bottom' }} />
          Drop a <code>.bib</code> file here or search CrossRef/DOI above.
        </div>
      ) : (
        <div style={{ marginBottom: 12 }}>
          {filteredSaved.map((entry) => {
            const cited = isKeyCited(entry.citeKey);
            return (
              <div key={entry.citeKey} className="studio-card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                  <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, fontWeight: 700 }}>
                    {entry.citeKey}
                  </code>
                  {!cited && (
                    <span className="badge badge-warning" style={{ fontSize: 10 }}>
                      Uncited
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12, fontWeight: 500, marginTop: 3 }}>{entry.title}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', margin: '2px 0 6px 0' }}>
                  {entry.authors.slice(0, 2).join(', ')} • {entry.year}
                </div>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 6 }}>
                  <input
                    type="text"
                    className="input"
                    aria-label={`Page locator for ${entry.citeKey}`}
                    placeholder="p. 12"
                    value={pageLocators[entry.citeKey] ?? ''}
                    onChange={(e) =>
                      setPageLocators((prev) => ({ ...prev, [entry.citeKey]: e.target.value }))
                    }
                    style={{ width: 76, padding: '3px 6px', fontSize: 11 }}
                  />
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                    {CITE_COMMANDS.map((cmd) => (
                      <button
                        key={cmd}
                        type="button"
                        className="btn btn-sm"
                        style={{ padding: '0 5px', fontSize: 10.5 }}
                        onClick={() => onInsertCitation(entry, cmd, pageLocators[entry.citeKey])}
                      >
                        \{cmd}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Cross-Reference Labels */}
      <div className="sidebar-section-heading">Cross-Reference Labels ({labelsInDoc.length})</div>
      {labelsInDoc.length === 0 ? (
        <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>No <code>\label{'{...}'}</code> anchors found.</div>
      ) : (
        labelsInDoc.map((lbl) => (
          <div
            key={`${lbl.label}-${lbl.line}`}
            className="studio-card"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, padding: '6px 8px' }}
          >
            <div style={{ minWidth: 0 }}>
              <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5 }}>{lbl.label}</code>
              <span style={{ fontSize: 10.5, color: 'var(--text-muted)', marginLeft: 6 }}>L{lbl.line}</span>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <button type="button" className="btn btn-sm" onClick={() => onInsertText(`\\ref{${lbl.label}}`, 0)}>
                \ref
              </button>
              <button type="button" className="btn btn-sm" onClick={() => onInsertText(`\\cref{${lbl.label}}`, 0)}>
                \cref
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
};
