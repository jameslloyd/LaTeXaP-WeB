import React, { useEffect, useState } from 'react';
import { Gauge, X } from 'lucide-react';
import type { AcademicDocumentStats, RubricTargetConfig } from '@shared/types';

export interface RubricTargetsPopoverProps {
  open: boolean;
  stats: AcademicDocumentStats;
  targets: RubricTargetConfig;
  onClose: () => void;
  onSaveTargets: (targets: RubricTargetConfig) => Promise<void>;
}

export const RubricTargetsPopover: React.FC<RubricTargetsPopoverProps> = ({
  open,
  stats,
  targets,
  onClose,
  onSaveTargets,
}) => {
  const [targetWords, setTargetWords] = useState('');
  const [maxPages, setMaxPages] = useState('');
  const [maxAbstract, setMaxAbstract] = useState('');
  const [studentMode, setStudentMode] = useState(targets.studentModeHideExpl3);

  useEffect(() => {
    if (!open) return;
    setTargetWords(targets.targetProseWords ? String(targets.targetProseWords) : '');
    setMaxPages(targets.maxPageCount ? String(targets.maxPageCount) : '');
    setMaxAbstract(targets.maxAbstractWords ? String(targets.maxAbstractWords) : '');
    setStudentMode(targets.studentModeHideExpl3);
  }, [open, targets]);

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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSaveTargets({
      targetProseWords: targetWords ? Number(targetWords) : null,
      maxPageCount: maxPages ? Number(maxPages) : null,
      maxAbstractWords: maxAbstract ? Number(maxAbstract) : null,
      studentModeHideExpl3: studentMode,
    });
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="rubric-popover-title"
      className="popover-panel"
      style={{
        top: 'auto',
        bottom: 'calc(100% + 6px)',
        right: 12,
        width: 310,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <strong id="rubric-popover-title" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Gauge size={14} aria-hidden="true" />
          Rubric Word &amp; Page Budgets
        </strong>
        <button type="button" className="btn btn-icon btn-ghost btn-sm" aria-label="Close rubric budgets" onClick={onClose}>
          <X size={14} aria-hidden="true" />
        </button>
      </div>

      <div
        className="studio-card"
        style={{ marginTop: 0, marginBottom: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 11.5 }}
      >
        <div>Body Words: <strong>{stats.proseWordCount}</strong></div>
        <div>Abstract: <strong>{stats.abstractWordCount}</strong></div>
        <div>Math Blocks: <strong>{stats.mathBlockCount}</strong></div>
        <div>Citations: <strong>{stats.referenceCount}</strong></div>
        <div>PDF Pages: <strong>{stats.pageCount}</strong></div>
        <div>Est. Read: <strong>{stats.estimatedReadingMinutes}m</strong></div>
      </div>

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div>
            <label htmlFor="rubric-words-input" style={{ display: 'block', fontSize: 11, marginBottom: 3 }}>
              Target Words
            </label>
            <input
              id="rubric-words-input"
              type="number"
              min={0}
              className="input"
              placeholder="e.g. 2500"
              value={targetWords}
              onChange={(e) => setTargetWords(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="rubric-pages-input" style={{ display: 'block', fontSize: 11, marginBottom: 3 }}>
              Max Pages
            </label>
            <input
              id="rubric-pages-input"
              type="number"
              min={1}
              className="input"
              placeholder="e.g. 8"
              value={maxPages}
              onChange={(e) => setMaxPages(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label htmlFor="rubric-abstract-input" style={{ display: 'block', fontSize: 11, marginBottom: 3 }}>
            Max Abstract Words
          </label>
          <input
            id="rubric-abstract-input"
            type="number"
            min={0}
            className="input"
            placeholder="e.g. 250"
            value={maxAbstract}
            onChange={(e) => setMaxAbstract(e.target.value)}
          />
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12 }}>
          <input
            type="checkbox"
            checked={studentMode}
            onChange={(e) => setStudentMode(e.target.checked)}
          />
          <span>Student Mode (hide expl3 macro badges)</span>
        </label>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 4 }}>
          <button type="button" className="btn btn-sm" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary btn-sm">
            Apply Targets
          </button>
        </div>
      </form>
    </div>
  );
};
