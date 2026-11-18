import React, { useEffect, useRef, useState } from 'react';
import { History, Loader2, RotateCcw, X } from 'lucide-react';
import type { SnapshotDetail, SnapshotManifest } from '@shared/types';

export interface ProjectHistoryModalProps {
  open: boolean;
  projectName: string;
  snapshots: SnapshotManifest[];
  onClose: () => void;
  onPreviewSnapshot: (snapshotId: string) => Promise<SnapshotDetail>;
  onRestoreSnapshot: (snapshotId: string) => Promise<void>;
}

export const ProjectHistoryModal: React.FC<ProjectHistoryModalProps> = ({
  open,
  projectName,
  snapshots,
  onClose,
  onPreviewSnapshot,
  onRestoreSnapshot,
}) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<SnapshotDetail | null>(null);
  const [selectedFile, setSelectedFile] = useState<string>('main.tex');
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setConfirmRestore(false);
    if (snapshots.length > 0) {
      setSelectedId(snapshots[0].snapshotId);
    } else {
      setSelectedId(null);
      setDetail(null);
    }
    requestAnimationFrame(() => closeBtnRef.current?.focus());
  }, [open, snapshots]);

  useEffect(() => {
    if (!open || !selectedId) return;
    let cancelled = false;
    setLoadingDetail(true);
    onPreviewSnapshot(selectedId)
      .then((res) => {
        if (!cancelled) {
          setDetail(res);
          const keys = Object.keys(res.files);
          if (keys.length > 0) {
            setSelectedFile((prev) => (res.files[prev] ? prev : keys[0]));
          }
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingDetail(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, selectedId, onPreviewSnapshot]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        if (confirmRestore) {
          setConfirmRestore(false);
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
  }, [confirmRestore, open, onClose]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="history-modal-title"
        className="modal-dialog"
        style={{ maxWidth: 820, height: 560 }}
      >
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <History size={18} color="var(--accent-text)" aria-hidden="true" />
            <h2 id="history-modal-title" className="modal-title">
              Version History — {projectName}
            </h2>
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            className="btn btn-icon btn-ghost"
            aria-label="Close version history"
            onClick={onClose}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <div className="modal-body" style={{ display: 'flex', gap: 14, padding: 0, overflow: 'hidden' }}>
          {/* Left Snapshot List */}
          <div
            style={{
              width: 260,
              borderRight: '1px solid var(--border-subtle)',
              overflowY: 'auto',
              padding: 10,
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            {snapshots.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: 12, padding: 8 }}>
                No saved snapshots yet. Press Mod+S to save your first snapshot.
              </div>
            ) : (
              snapshots.map((snap) => {
                const active = snap.snapshotId === selectedId;
                return (
                  <button
                    key={snap.snapshotId}
                    type="button"
                    className="studio-card"
                    onClick={() => {
                      setSelectedId(snap.snapshotId);
                      setConfirmRestore(false);
                    }}
                    style={{
                      textAlign: 'left',
                      cursor: 'pointer',
                      marginTop: 0,
                      borderColor: active ? 'var(--accent-solid)' : 'var(--border-subtle)',
                      background: active ? 'var(--accent-subtle)' : 'var(--bg-surface-elevated)',
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: 12 }}>{snap.message}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
                      {new Date(snap.createdAt).toLocaleString()}
                    </div>
                    <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 2 }}>
                      <code>{snap.snapshotId.slice(0, 14)}</code> • {snap.changedFiles.length} file(s)
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Right Preview & Diff */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', padding: 14, overflow: 'hidden' }}>
            {loadingDetail && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)' }}>
                <Loader2 size={15} className="spin-icon" aria-hidden="true" />
                <span>Loading snapshot diff...</span>
              </div>
            )}

            {!loadingDetail && detail && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, gap: 8 }}>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {Object.keys(detail.files).map((fileKey) => (
                      <button
                        key={fileKey}
                        type="button"
                        className={`btn btn-sm ${selectedFile === fileKey ? 'btn-primary' : ''}`}
                        onClick={() => setSelectedFile(fileKey)}
                      >
                        {fileKey}
                      </button>
                    ))}
                  </div>
                  {detail.diffs.find((d) => d.relativePath === selectedFile) && (
                    <span className="badge badge-neutral">
                      +{detail.diffs.find((d) => d.relativePath === selectedFile)!.additions} / -
                      {detail.diffs.find((d) => d.relativePath === selectedFile)!.deletions} lines
                    </span>
                  )}
                </div>

                <pre
                  className="code-preview"
                  style={{ flex: 1, margin: 0, overflowY: 'auto', fontSize: 11.5 }}
                >
                  {detail.files[selectedFile] ?? ''}
                </pre>

                {confirmRestore && (
                  <div
                    role="alertdialog"
                    aria-label="Confirm snapshot restore"
                    className="studio-card"
                    style={{
                      marginTop: 10,
                      borderColor: 'var(--warning-border)',
                      background: 'var(--warning-bg)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                    }}
                  >
                    <span style={{ fontSize: 12, fontWeight: 600 }}>
                      Restore files to this snapshot? This creates a new forward snapshot (history is preserved).
                    </span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        disabled={restoring}
                        onClick={async () => {
                          setRestoring(true);
                          await onRestoreSnapshot(detail.snapshot.snapshotId);
                          setRestoring(false);
                          onClose();
                        }}
                      >
                        {restoring ? <Loader2 size={12} className="spin-icon" aria-hidden="true" /> : null}
                        Confirm Restore
                      </button>
                      <button type="button" className="btn btn-sm" onClick={() => setConfirmRestore(false)}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn" onClick={onClose}>
            Close
          </button>
          {detail && !confirmRestore && (
            <button type="button" className="btn btn-primary" onClick={() => setConfirmRestore(true)}>
              <RotateCcw size={13} aria-hidden="true" />
              Restore This Version
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
