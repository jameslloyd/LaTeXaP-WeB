import React, { useEffect, useRef, useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import type { AcademicPaperSize, BibliographyStylePreset, PaperSetupConfig } from '@shared/types';

const WIZARD_TEMPLATES = [
  { id: 'apa7-student', label: 'APA 7th Student Paper', badge: 'APA 7' },
  { id: 'ieee-conference', label: 'IEEE Conference', badge: 'IEEE' },
  { id: 'acm-article', label: 'ACM acmart', badge: 'ACM' },
  { id: 'mla-essay', label: 'MLA Essay', badge: 'MLA' },
  { id: 'stem-lab-report', label: 'STEM Lab Report', badge: 'STEM' },
  { id: 'university-thesis', label: 'University Thesis', badge: 'Thesis' },
  { id: 'expl3-showcase', label: 'LaTeX3 Showcase', badge: 'expl3' },
];

export interface PaperWizardModalProps {
  open: boolean;
  initialTemplateId?: string;
  isDirty: boolean;
  onClose: () => void;
  onApply: (config: PaperSetupConfig) => Promise<void>;
}

export const PaperWizardModal: React.FC<PaperWizardModalProps> = ({
  open,
  initialTemplateId,
  isDirty,
  onClose,
  onApply,
}) => {
  const [templateId, setTemplateId] = useState(initialTemplateId || 'apa7-student');
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [institution, setInstitution] = useState('');
  const [courseOrVenue, setCourseOrVenue] = useState('');
  const [date, setDate] = useState('\\today');
  const [paperSize, setPaperSize] = useState<AcademicPaperSize>('letterpaper');
  const [baseFontSizePt, setBaseFontSizePt] = useState<number>(11);
  const [lineSpacing, setLineSpacing] = useState<'single' | 'onehalf' | 'double'>('double');
  const [bibliographyStyle, setBibliographyStyle] = useState<BibliographyStylePreset>('apa');
  const [anonymizedBlindReview, setAnonymizedBlindReview] = useState(false);
  const [targetProseWords, setTargetProseWords] = useState('');
  const [maxPageCount, setMaxPageCount] = useState('');
  const [titleError, setTitleError] = useState<string | null>(null);
  const [confirmOverwrite, setConfirmOverwrite] = useState(false);

  const titleInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    if (initialTemplateId) setTemplateId(initialTemplateId);
    setTitleError(null);
    setConfirmOverwrite(false);
    requestAnimationFrame(() => titleInputRef.current?.focus());
  }, [initialTemplateId, open]);

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

  if (!open) return null;

  const doApply = async () => {
    const config: PaperSetupConfig = {
      templateId,
      title: title.trim(),
      author: author.trim() || 'Author Name',
      institution: institution.trim(),
      courseOrVenue: courseOrVenue.trim(),
      date: date.trim() || '\\today',
      paperSize,
      baseFontSizePt,
      lineSpacing,
      doubleSpacing: lineSpacing === 'double',
      anonymizedBlindReview,
      bibliographyStyle,
      targetProseWords: targetProseWords ? Number(targetProseWords) : null,
      maxPageCount: maxPageCount ? Number(maxPageCount) : null,
    };
    await onApply(config);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setTitleError('Document Title is required.');
      titleInputRef.current?.focus();
      return;
    }
    if (isDirty && !confirmOverwrite) {
      setConfirmOverwrite(true);
      return;
    }
    await doApply();
  };

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="paper-wizard-title"
        className="modal-dialog"
        style={{ maxWidth: 680, height: 560 }}
      >
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sparkles size={18} color="var(--accent-text)" aria-hidden="true" />
            <h2 id="paper-wizard-title" className="modal-title">
              Academic Paper Setup Wizard
            </h2>
          </div>
          <button
            type="button"
            className="btn btn-icon btn-ghost"
            aria-label="Close Paper Setup Wizard"
            onClick={onClose}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          <div className="modal-body" style={{ display: 'flex', gap: 16, padding: 0, overflow: 'hidden' }}>
            {/* Left Template Picker */}
            <div
              style={{
                width: 210,
                borderRight: '1px solid var(--border-subtle)',
                padding: 12,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              <div className="sidebar-section-heading">Template</div>
              {WIZARD_TEMPLATES.map((tpl) => {
                const selected = templateId === tpl.id;
                return (
                  <button
                    key={tpl.id}
                    type="button"
                    className={`btn ${selected ? 'btn-primary' : ''}`}
                    style={{ justifyContent: 'space-between', height: 34 }}
                    onClick={() => setTemplateId(tpl.id)}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{tpl.label}</span>
                    <span className="badge badge-neutral" style={{ fontSize: 9.5 }}>
                      {tpl.badge}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Right Metadata & Formatting */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label htmlFor="wizard-title-input" style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>
                  Document Title *
                </label>
                <input
                  ref={titleInputRef}
                  id="wizard-title-input"
                  type="text"
                  className="input"
                  placeholder="Accelerated Optimization Under Generalized Smoothness"
                  value={title}
                  aria-invalid={Boolean(titleError)}
                  aria-describedby={titleError ? 'wizard-title-error' : undefined}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    setTitleError(null);
                  }}
                />
                {titleError && (
                  <div id="wizard-title-error" className="field-error" role="alert">
                    {titleError}
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label htmlFor="wizard-author-input" style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>
                    Author(s)
                  </label>
                  <input
                    id="wizard-author-input"
                    type="text"
                    className="input"
                    placeholder="Ada Lovelace"
                    value={author}
                    onChange={(e) => setAuthor(e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="wizard-inst-input" style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>
                    Institution
                  </label>
                  <input
                    id="wizard-inst-input"
                    type="text"
                    className="input"
                    placeholder="Stanford University"
                    value={institution}
                    onChange={(e) => setInstitution(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label htmlFor="wizard-course-input" style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>
                    Course / Venue
                  </label>
                  <input
                    id="wizard-course-input"
                    type="text"
                    className="input"
                    placeholder="CS 229 / NeurIPS"
                    value={courseOrVenue}
                    onChange={(e) => setCourseOrVenue(e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="wizard-date-input" style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>
                    Date
                  </label>
                  <input
                    id="wizard-date-input"
                    type="text"
                    className="input"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <div>
                  <label htmlFor="wizard-paper-size" style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>
                    Paper Size
                  </label>
                  <select
                    id="wizard-paper-size"
                    className="select"
                    value={paperSize}
                    onChange={(e) => setPaperSize(e.target.value as AcademicPaperSize)}
                  >
                    <option value="letterpaper">US Letter</option>
                    <option value="a4paper">A4</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="wizard-font-pt" style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>
                    Body Size
                  </label>
                  <select
                    id="wizard-font-pt"
                    className="select"
                    value={baseFontSizePt}
                    onChange={(e) => setBaseFontSizePt(Number(e.target.value))}
                  >
                    <option value={10}>10 pt</option>
                    <option value={11}>11 pt</option>
                    <option value={12}>12 pt</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="wizard-spacing" style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>
                    Line Spacing
                  </label>
                  <select
                    id="wizard-spacing"
                    className="select"
                    value={lineSpacing}
                    onChange={(e) => setLineSpacing(e.target.value as 'single' | 'onehalf' | 'double')}
                  >
                    <option value="single">Single</option>
                    <option value="onehalf">1.5×</option>
                    <option value="double">Double</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <div>
                  <label htmlFor="wizard-bib-style" style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>
                    Citation Style
                  </label>
                  <select
                    id="wizard-bib-style"
                    className="select"
                    value={bibliographyStyle}
                    onChange={(e) => setBibliographyStyle(e.target.value as BibliographyStylePreset)}
                  >
                    <option value="apa">APA</option>
                    <option value="ieee">IEEE</option>
                    <option value="acm">ACM</option>
                    <option value="mla">MLA</option>
                    <option value="chicago">Chicago</option>
                    <option value="nature">Nature</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="wizard-target-words" style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>
                    Target Words
                  </label>
                  <input
                    id="wizard-target-words"
                    type="number"
                    min={0}
                    className="input"
                    placeholder="2500"
                    value={targetProseWords}
                    onChange={(e) => setTargetProseWords(e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="wizard-max-pages" style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>
                    Max Pages
                  </label>
                  <input
                    id="wizard-max-pages"
                    type="number"
                    min={1}
                    className="input"
                    placeholder="8"
                    value={maxPageCount}
                    onChange={(e) => setMaxPageCount(e.target.value)}
                  />
                </div>
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginTop: 4 }}>
                <input
                  type="checkbox"
                  checked={anonymizedBlindReview}
                  onChange={(e) => setAnonymizedBlindReview(e.target.checked)}
                />
                <span>Anonymized Blind Review (adds <code>lineno</code> &amp; masks author)</span>
              </label>

              {confirmOverwrite && (
                <div
                  role="alertdialog"
                  aria-label="Confirm replacing unsaved edits"
                  className="studio-card"
                  style={{ borderColor: 'var(--warning-border)', background: 'var(--warning-bg)' }}
                >
                  <div style={{ fontWeight: 600, marginBottom: 6 }}>
                    Replace unsaved edits in current document?
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => void doApply()}>
                      Replace &amp; Generate Paper
                    </button>
                    <button type="button" className="btn btn-sm" onClick={() => setConfirmOverwrite(false)}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Generate Paper Starter
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
