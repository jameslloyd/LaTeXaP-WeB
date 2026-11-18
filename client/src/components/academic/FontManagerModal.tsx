import React, { useEffect, useRef, useState } from 'react';
import { Edit3, Loader2, Trash2, Type, Upload, X } from 'lucide-react';
import type { CustomFontRecord, LaTeXFontRole } from '@shared/types';

export interface FontManagerModalProps {
  open: boolean;
  customFonts: CustomFontRecord[];
  onClose: () => void;
  onUploadFont: (file: File, displayName?: string) => Promise<CustomFontRecord>;
  onRenameFont: (fontId: string, displayName: string) => Promise<void>;
  onDeleteFont: (fontId: string) => Promise<void>;
  onApplyFontToDocument: (fontNameOrFile: string, role: LaTeXFontRole, customCommandName?: string) => void;
}

export const FontManagerModal: React.FC<FontManagerModalProps> = ({
  open,
  customFonts,
  onClose,
  onUploadFont,
  onRenameFont,
  onDeleteFont,
  onApplyFontToDocument,
}) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [specimenSize, setSpecimenSize] = useState(20);
  const [specimenText, setSpecimenText] = useState('The quick brown fox jumps over 12345 — ∑ ∫ α β λ');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState('');
  const [loadedFamilies, setLoadedFamilies] = useState<Record<string, string>>({});

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    if (customFonts.length > 0 && !selectedId) {
      setSelectedId(customFonts[0].id);
    }
    requestAnimationFrame(() => closeBtnRef.current?.focus());
  }, [customFonts, open, selectedId]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        if (renamingId) {
          setRenamingId(null);
        } else {
          onClose();
        }
        return;
      }
      if (e.key === 'Tab' && dialogRef.current) {
        const focusables = Array.from(
          dialogRef.current.querySelectorAll<HTMLElement>(
            'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'
          )
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, renamingId]);

  // Register selected font in browser FontFace API for live specimen preview
  const selectedFont = customFonts.find((f) => f.id === selectedId) ?? customFonts[0] ?? null;

  useEffect(() => {
    if (!open || !selectedFont || loadedFamilies[selectedFont.id]) return;
    if (typeof FontFace === 'undefined') return;
    const familyAlias = `LaTeXaPPreview_${selectedFont.id.replace(/[^a-zA-Z0-9]/g, '')}`;
    const ff = new FontFace(familyAlias, `url(/api/fonts/${encodeURIComponent(selectedFont.id)}/binary)`);
    ff.load()
      .then((loaded) => {
        document.fonts.add(loaded);
        setLoadedFamilies((prev) => ({ ...prev, [selectedFont.id]: familyAlias }));
      })
      .catch(() => {
        // Fallback to system serif/mono if binary preview unavailable
      });
  }, [loadedFamilies, open, selectedFont]);

  if (!open) return null;

  const handleUpload = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const created = await onUploadFont(file);
      setSelectedId(created.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Font upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="font-manager-title"
        className="modal-dialog"
        style={{ maxWidth: 760, height: 540 }}
      >
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Type size={18} color="var(--accent-text)" aria-hidden="true" />
            <h2 id="font-manager-title" className="modal-title">
              Custom Font Manager &amp; Specimen Preview
            </h2>
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            className="btn btn-icon btn-ghost"
            aria-label="Close Font Manager"
            onClick={onClose}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <div className="modal-body" style={{ display: 'flex', gap: 14, padding: 0, overflow: 'hidden' }}>
          {/* Left Font List */}
          <div
            style={{
              width: 250,
              borderRight: '1px solid var(--border-subtle)',
              padding: 12,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              overflowY: 'auto',
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".ttf,.otf,.ttc"
              className="sr-only"
              aria-label="Upload custom font"
              onChange={(e) => void handleUpload(e.target.files?.[0])}
            />
            <button
              type="button"
              className="btn btn-primary"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? <Loader2 size={13} className="spin-icon" aria-hidden="true" /> : <Upload size={13} aria-hidden="true" />}
              Import .ttf / .otf / .ttc
            </button>

            {error && (
              <div role="alert" className="studio-card" style={{ background: 'var(--danger-bg)', color: 'var(--danger-text)', fontSize: 11.5 }}>
                {error}
              </div>
            )}

            {customFonts.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: 6 }}>
                No custom fonts uploaded yet. Imported fonts sync to your Backblaze B2 library and work in client-side PDF builds.
              </div>
            ) : (
              customFonts.map((font) => (
                <button
                  key={font.id}
                  type="button"
                  className="studio-card"
                  onClick={() => setSelectedId(font.id)}
                  style={{
                    textAlign: 'left',
                    marginTop: 0,
                    cursor: 'pointer',
                    borderColor: selectedFont?.id === font.id ? 'var(--accent-solid)' : 'var(--border-subtle)',
                    background: selectedFont?.id === font.id ? 'var(--accent-subtle)' : 'var(--bg-surface-elevated)',
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: 12 }}>{font.displayName}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {font.format.toUpperCase()} • {font.styleName}
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Right Specimen Preview & Role Actions */}
          <div style={{ flex: 1, padding: 16, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {!selectedFont ? (
              <div style={{ margin: 'auto', color: 'var(--text-muted)', textAlign: 'center' }}>
                Select or import a font to inspect its specimen and insert <code>fontspec</code> commands.
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  {renamingId === selectedFont.id ? (
                    <form
                      style={{ display: 'flex', gap: 6, flex: 1 }}
                      onSubmit={async (e) => {
                        e.preventDefault();
                        if (renameVal.trim()) {
                          await onRenameFont(selectedFont.id, renameVal.trim());
                        }
                        setRenamingId(null);
                      }}
                    >
                      <input
                        type="text"
                        className="input"
                        value={renameVal}
                        onChange={(e) => setRenameVal(e.target.value)}
                        autoFocus
                      />
                      <button type="submit" className="btn btn-primary btn-sm">Save</button>
                      <button type="button" className="btn btn-sm" onClick={() => setRenamingId(null)}>Cancel</button>
                    </form>
                  ) : (
                    <div>
                      <h3 style={{ margin: 0, fontSize: 15 }}>{selectedFont.displayName}</h3>
                      <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                        Family: <code>{selectedFont.familyName}</code> • File: <code>{selectedFont.fileName}</code>
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 4 }}>
                    <button
                      type="button"
                      className="btn btn-icon btn-sm"
                      aria-label={`Rename ${selectedFont.displayName}`}
                      onClick={() => {
                        setRenamingId(selectedFont.id);
                        setRenameVal(selectedFont.displayName);
                      }}
                    >
                      <Edit3 size={13} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className="btn btn-icon btn-danger btn-sm"
                      aria-label={`Remove ${selectedFont.displayName}`}
                      onClick={() => void onDeleteFont(selectedFont.id)}
                    >
                      <Trash2 size={13} aria-hidden="true" />
                    </button>
                  </div>
                </div>

                <div>
                  <label htmlFor="specimen-size-slider" style={{ display: 'block', fontSize: 11.5, marginBottom: 4 }}>
                    Specimen Size: <strong>{specimenSize} pt</strong>
                  </label>
                  <input
                    id="specimen-size-slider"
                    type="range"
                    min={10}
                    max={36}
                    value={specimenSize}
                    onChange={(e) => setSpecimenSize(Number(e.target.value))}
                    style={{ width: '100%' }}
                  />
                </div>

                <input
                  type="text"
                  className="input"
                  aria-label="Specimen sample text"
                  value={specimenText}
                  onChange={(e) => setSpecimenText(e.target.value)}
                />

                <div
                  className="studio-card"
                  style={{
                    minHeight: 110,
                    display: 'flex',
                    alignItems: 'center',
                    fontFamily: loadedFamilies[selectedFont.id]
                      ? `"${loadedFamilies[selectedFont.id]}", serif`
                      : selectedFont.isMonospace
                        ? 'var(--font-mono)'
                        : 'var(--font-serif)',
                    fontSize: `${specimenSize}px`,
                    lineHeight: 1.35,
                  }}
                >
                  {specimenText}
                </div>

                <div>
                  <div className="sidebar-section-heading">Apply fontspec Role to Document</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => {
                        onApplyFontToDocument(selectedFont.familyName, 'main');
                        onClose();
                      }}
                    >
                      \setmainfont
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() => {
                        onApplyFontToDocument(selectedFont.familyName, 'sans');
                        onClose();
                      }}
                    >
                      \setsansfont
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() => {
                        onApplyFontToDocument(selectedFont.familyName, 'mono');
                        onClose();
                      }}
                    >
                      \setmonofont
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() => {
                        onApplyFontToDocument(selectedFont.familyName, 'customFamily', 'mycustomfont');
                        onClose();
                      }}
                    >
                      \newfontfamily
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
