import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BookMarked, Plus, Search, X } from 'lucide-react';
import type { BibEntry, CitationCommandStyle } from '@shared/types';

export interface CitationPickerPopoverProps {
  open: boolean;
  bibEntries: BibEntry[];
  bibSearchResults: BibEntry[];
  isSearching: boolean;
  selectedStyle: CitationCommandStyle;
  onClose: () => void;
  onSearch: (query: string) => Promise<void>;
  onLookup: (identifier: string) => Promise<void>;
  onImportEntry: (entry: BibEntry) => void;
  onInsertCitation: (entry: BibEntry, style: CitationCommandStyle, pageLocator?: string) => void;
}

export const CitationPickerPopover: React.FC<CitationPickerPopoverProps> = ({
  open,
  bibEntries,
  bibSearchResults,
  isSearching,
  selectedStyle,
  onClose,
  onSearch,
  onLookup,
  onImportEntry,
  onInsertCitation,
}) => {
  const [query, setQuery] = useState('');
  const [style, setStyle] = useState<CitationCommandStyle>(selectedStyle);
  const [locator, setLocator] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setStyle(selectedStyle);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [open, selectedStyle]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const filteredLocal = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return bibEntries;
    return bibEntries.filter(
      (e) =>
        e.citeKey.toLowerCase().includes(q) ||
        e.title.toLowerCase().includes(q) ||
        e.authors.some((a) => a.toLowerCase().includes(q))
    );
  }, [bibEntries, query]);

  if (!open) return null;

  const handleCrossRef = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    if (/^10\.\d{4,}\//.test(q) || /^arxiv:/i.test(q)) {
      await onLookup(q);
    } else {
      await onSearch(q);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="cite-picker-title"
      className="popover-panel"
      style={{ width: 380, maxHeight: 460, display: 'flex', flexDirection: 'column', gap: 8 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <strong id="cite-picker-title" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <BookMarked size={14} aria-hidden="true" />
          Quick Citation Picker
        </strong>
        <button type="button" className="btn btn-icon btn-ghost btn-sm" aria-label="Close citation picker" onClick={onClose}>
          <X size={14} aria-hidden="true" />
        </button>
      </div>

      <form onSubmit={handleCrossRef} style={{ display: 'flex', gap: 6 }}>
        <input
          ref={inputRef}
          type="text"
          className="input"
          placeholder="Filter library or search CrossRef / DOI..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button type="submit" className="btn btn-primary btn-sm" disabled={isSearching} aria-label="Search CrossRef">
          <Search size={12} aria-hidden="true" />
        </button>
      </form>

      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <select
          aria-label="Citation command style"
          className="select"
          value={style}
          onChange={(e) => setStyle(e.target.value as CitationCommandStyle)}
          style={{ width: 130 }}
        >
          <option value="cite">\cite</option>
          <option value="parencite">\parencite</option>
          <option value="textcite">\textcite</option>
          <option value="autocite">\autocite</option>
          <option value="footcite">\footcite</option>
        </select>
        <input
          type="text"
          className="input"
          aria-label="Optional page locator"
          placeholder="Page locator (e.g. p. 42)"
          value={locator}
          onChange={(e) => setLocator(e.target.value)}
        />
      </div>

      <div style={{ overflowY: 'auto', maxHeight: 280, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {filteredLocal.map((entry) => (
          <div key={entry.citeKey} className="studio-card" style={{ marginTop: 0, padding: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
              <code style={{ fontWeight: 700, fontSize: 11.5 }}>{entry.citeKey}</code>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => {
                  onInsertCitation(entry, style, locator);
                  onClose();
                }}
              >
                Insert \{style}
              </button>
            </div>
            <div style={{ fontSize: 11.5, marginTop: 3 }}>{entry.title}</div>
          </div>
        ))}

        {bibSearchResults.length > 0 && (
          <>
            <div className="sidebar-section-heading" style={{ marginTop: 6 }}>
              CrossRef Results
            </div>
            {bibSearchResults.slice(0, 4).map((res) => (
              <div key={res.id} className="studio-card" style={{ marginTop: 0, padding: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                  <strong style={{ fontSize: 11.5 }}>{res.title}</strong>
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => {
                      onImportEntry(res);
                      onInsertCitation(res, style, locator);
                      onClose();
                    }}
                  >
                    <Plus size={11} aria-hidden="true" />
                    Add &amp; Cite
                  </button>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {res.authors[0] ?? 'Author'} ({res.year})
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
};
