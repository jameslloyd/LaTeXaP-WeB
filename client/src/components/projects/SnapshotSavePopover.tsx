import React, { useEffect, useRef, useState } from 'react';
import { Camera, Loader2, X } from 'lucide-react';

export interface SnapshotSavePopoverProps {
  open: boolean;
  projectName: string;
  changedFiles: string[];
  onClose: () => void;
  onSaveSnapshot: (message: string) => Promise<void>;
}

const PREFIX_CHIPS = ['Draft:', 'Revisions:', 'Citations:', 'Submission:'];

function defaultMessage(projectName: string): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
  return `Save ${projectName || 'Project'} — ${stamp}`;
}

export const SnapshotSavePopover: React.FC<SnapshotSavePopoverProps> = ({
  open,
  projectName,
  changedFiles,
  onClose,
  onSaveSnapshot,
}) => {
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setMessage(defaultMessage(projectName));
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  }, [open, projectName]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSaveSnapshot(message.trim() || defaultMessage(projectName));
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="snapshot-popover-title"
      className="popover-panel popover-panel--left"
      style={{ width: 360 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <strong id="snapshot-popover-title" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Camera size={14} aria-hidden="true" />
          Save &amp; Snapshot Version
        </strong>
        <button type="button" className="btn btn-icon btn-ghost btn-sm" aria-label="Close snapshot popover" onClick={onClose}>
          <X size={14} aria-hidden="true" />
        </button>
      </div>

      <div style={{ marginBottom: 8, fontSize: 11.5, color: 'var(--text-muted)' }}>
        Files included: {changedFiles.length > 0 ? changedFiles.join(', ') : 'main.tex, references.bib'}
      </div>

      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
        {PREFIX_CHIPS.map((chip) => (
          <button
            key={chip}
            type="button"
            className="btn btn-sm"
            onClick={() => {
              setMessage((prev) => `${chip} ${prev.replace(/^(Draft|Revisions|Citations|Submission):\s*/, '')}`);
              inputRef.current?.focus();
            }}
          >
            {chip}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit}>
        <label htmlFor="snapshot-label-input" className="sr-only">
          Snapshot message
        </label>
        <input
          ref={inputRef}
          id="snapshot-label-input"
          type="text"
          className="input"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
              void handleSubmit(e);
            }
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 10 }}>
          <button type="button" className="btn btn-sm" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
            {saving && <Loader2 size={12} className="spin-icon" aria-hidden="true" />}
            Save &amp; Snapshot
          </button>
        </div>
      </form>
    </div>
  );
};
