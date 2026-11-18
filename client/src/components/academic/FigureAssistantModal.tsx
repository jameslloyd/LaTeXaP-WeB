import React, { useEffect, useRef, useState } from 'react';
import { ImagePlus, Loader2, X } from 'lucide-react';
import type { FigureInsertConfig } from '@shared/types';

export interface FigureAssistantModalProps {
  open: boolean;
  initialFile?: File | null;
  onClose: () => void;
  onUploadAndInsert: (
    primaryFile: File,
    secondaryFile: File | null,
    config: FigureInsertConfig
  ) => Promise<void>;
}

export const FigureAssistantModal: React.FC<FigureAssistantModalProps> = ({
  open,
  initialFile = null,
  onClose,
  onUploadAndInsert,
}) => {
  const [layoutMode, setLayoutMode] = useState<'single' | 'side-by-side'>('single');
  const [primaryFile, setPrimaryFile] = useState<File | null>(null);
  const [secondaryFile, setSecondaryFile] = useState<File | null>(null);
  const [primaryPreviewUrl, setPrimaryPreviewUrl] = useState<string | null>(null);
  const [widthPct, setWidthPct] = useState(80);
  const [placement, setPlacement] = useState('htbp');
  const [caption, setCaption] = useState('');
  const [label, setLabel] = useState('fig:overview');
  const [primarySubcaption, setPrimarySubcaption] = useState('Baseline');
  const [secondarySubcaption, setSecondarySubcaption] = useState('Proposed');
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const primaryInputRef = useRef<HTMLInputElement | null>(null);
  const secondaryInputRef = useRef<HTMLInputElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (initialFile) {
      setPrimaryFile(initialFile);
      const stem = initialFile.name.replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
      setLabel(`fig:${stem || 'figure'}`);
    }
    requestAnimationFrame(() => closeBtnRef.current?.focus());
  }, [initialFile, open]);

  useEffect(() => {
    if (!primaryFile || !primaryFile.type.startsWith('image/')) {
      setPrimaryPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(primaryFile);
    setPrimaryPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [primaryFile]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
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
  }, [open, onClose]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!primaryFile) {
      setError('Please select a primary image file (.png, .jpg, .pdf, .svg, .webp).');
      return;
    }
    if (layoutMode === 'side-by-side' && !secondaryFile) {
      setError('Please select a second image for side-by-side subfigures.');
      return;
    }
    if (!/^fig:[a-zA-Z0-9_-]+$/.test(label.trim())) {
      setError('Figure label must start with "fig:" and contain only letters, numbers, hyphens, or underscores.');
      return;
    }
    setError(null);
    setUploading(true);
    try {
      await onUploadAndInsert(primaryFile, layoutMode === 'side-by-side' ? secondaryFile : null, {
        primaryRelativePath: `figures/${primaryFile.name}`,
        secondaryRelativePath: secondaryFile ? `figures/${secondaryFile.name}` : null,
        widthFraction: Number((widthPct / 100).toFixed(2)),
        placement,
        caption: caption.trim() || 'Figure caption',
        label: label.trim(),
        primarySubcaption: primarySubcaption.trim() || 'Left',
        secondarySubcaption: secondarySubcaption.trim() || 'Right',
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload figure');
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
        aria-labelledby="figure-modal-title"
        className="modal-dialog"
        style={{ maxWidth: 600 }}
      >
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ImagePlus size={18} color="var(--accent-text)" aria-hidden="true" />
            <h2 id="figure-modal-title" className="modal-title">
              Relative Figure Assistant
            </h2>
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            className="btn btn-icon btn-ghost"
            aria-label="Close Figure Assistant"
            onClick={onClose}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {error && (
              <div role="alert" className="studio-card" style={{ background: 'var(--danger-bg)', color: 'var(--danger-text)' }}>
                {error}
              </div>
            )}

            <div className="segmented-control" style={{ alignSelf: 'flex-start' }}>
              <button
                type="button"
                className="segmented-control__btn"
                aria-pressed={layoutMode === 'single'}
                onClick={() => setLayoutMode('single')}
              >
                Single Figure
              </button>
              <button
                type="button"
                className="segmented-control__btn"
                aria-pressed={layoutMode === 'side-by-side'}
                onClick={() => setLayoutMode('side-by-side')}
              >
                Side-by-Side (2 Subfigures)
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: layoutMode === 'side-by-side' ? '1fr 1fr' : '1fr', gap: 10 }}>
              <div className="studio-card" style={{ marginTop: 0, textAlign: 'center' }}>
                <input
                  ref={primaryInputRef}
                  type="file"
                  accept=".png,.jpg,.jpeg,.pdf,.svg,.webp"
                  className="sr-only"
                  aria-label="Choose primary figure image"
                  onChange={(e) => setPrimaryFile(e.target.files?.[0] ?? null)}
                />
                {primaryPreviewUrl && (
                  <img
                    src={primaryPreviewUrl}
                    alt="Primary figure preview"
                    style={{ maxHeight: 110, maxWidth: '100%', borderRadius: 4, marginBottom: 6 }}
                  />
                )}
                <div style={{ fontSize: 12, fontWeight: 600 }}>
                  {primaryFile ? primaryFile.name : 'No primary figure selected'}
                </div>
                <button
                  type="button"
                  className="btn btn-sm"
                  style={{ marginTop: 6 }}
                  onClick={() => primaryInputRef.current?.click()}
                >
                  Choose Primary Image...
                </button>
                {layoutMode === 'side-by-side' && (
                  <input
                    type="text"
                    className="input"
                    style={{ marginTop: 8 }}
                    placeholder="Left subcaption"
                    value={primarySubcaption}
                    onChange={(e) => setPrimarySubcaption(e.target.value)}
                  />
                )}
              </div>

              {layoutMode === 'side-by-side' && (
                <div className="studio-card" style={{ marginTop: 0, textAlign: 'center' }}>
                  <input
                    ref={secondaryInputRef}
                    type="file"
                    accept=".png,.jpg,.jpeg,.pdf,.svg,.webp"
                    className="sr-only"
                    aria-label="Choose secondary figure image"
                    onChange={(e) => setSecondaryFile(e.target.files?.[0] ?? null)}
                  />
                  <div style={{ fontSize: 12, fontWeight: 600 }}>
                    {secondaryFile ? secondaryFile.name : 'No secondary figure selected'}
                  </div>
                  <button
                    type="button"
                    className="btn btn-sm"
                    style={{ marginTop: 6 }}
                    onClick={() => secondaryInputRef.current?.click()}
                  >
                    Choose Second Image...
                  </button>
                  <input
                    type="text"
                    className="input"
                    style={{ marginTop: 8 }}
                    placeholder="Right subcaption"
                    value={secondarySubcaption}
                    onChange={(e) => setSecondarySubcaption(e.target.value)}
                  />
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: 10 }}>
              <div>
                <label htmlFor="figure-width-range" style={{ display: 'block', fontSize: 11.5, marginBottom: 4 }}>
                  Width: <strong>{widthPct}%</strong> of <code>\textwidth</code>
                </label>
                <input
                  id="figure-width-range"
                  type="range"
                  min={25}
                  max={100}
                  step={5}
                  value={widthPct}
                  onChange={(e) => setWidthPct(Number(e.target.value))}
                  style={{ width: '100%' }}
                />
              </div>
              <div>
                <label htmlFor="figure-placement-select" style={{ display: 'block', fontSize: 11.5, marginBottom: 4 }}>
                  Placement
                </label>
                <select
                  id="figure-placement-select"
                  className="select"
                  value={placement}
                  onChange={(e) => setPlacement(e.target.value)}
                >
                  <option value="htbp">Here [htbp]</option>
                  <option value="t">Top [t]</option>
                  <option value="p">Page [p]</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 170px', gap: 10 }}>
              <div>
                <label htmlFor="figure-caption-input" style={{ display: 'block', fontSize: 11.5, marginBottom: 4 }}>
                  Caption
                </label>
                <input
                  id="figure-caption-input"
                  type="text"
                  className="input"
                  placeholder="Overview of experimental pipeline."
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="figure-label-input" style={{ display: 'block', fontSize: 11.5, marginBottom: 4 }}>
                  Label (fig:...)
                </label>
                <input
                  id="figure-label-input"
                  type="text"
                  className="input"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={uploading}>
              {uploading && <Loader2 size={13} className="spin-icon" aria-hidden="true" />}
              Upload to figures/ &amp; Insert
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
