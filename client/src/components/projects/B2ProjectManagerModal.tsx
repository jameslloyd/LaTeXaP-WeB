import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Cloud, CloudOff, Copy, Edit3, FolderPlus, Loader2, RefreshCw, Trash2, X } from 'lucide-react';
import type { AcademicProjectDescriptor, CreateProjectInput, StorageStatusInfo } from '@shared/types';

export interface B2ProjectManagerModalProps {
  open: boolean;
  initialMode?: 'projects' | 'storage' | 'create';
  projects: AcademicProjectDescriptor[];
  activeProject: AcademicProjectDescriptor | null;
  storageStatus: StorageStatusInfo | null;
  isDirty: boolean;
  onClose: () => void;
  onCreateProject: (input: CreateProjectInput) => Promise<void>;
  onSwitchProject: (slug: string) => Promise<void>;
  onSaveAndSwitchProject: (slug: string) => Promise<void>;
  onRenameProject: (slug: string, displayName: string) => Promise<void>;
  onDuplicateProject: (slug: string, displayName: string) => Promise<void>;
  onDeleteProject: (slug: string) => Promise<void>;
  onTestStorage: () => Promise<StorageStatusInfo>;
  onSyncNow: () => Promise<void>;
  onOpenWizardAfterCreate: () => void;
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

export const B2ProjectManagerModal: React.FC<B2ProjectManagerModalProps> = ({
  open,
  initialMode = 'projects',
  projects,
  activeProject,
  storageStatus,
  isDirty,
  onClose,
  onCreateProject,
  onSwitchProject,
  onSaveAndSwitchProject,
  onRenameProject,
  onDuplicateProject,
  onDeleteProject,
  onTestStorage,
  onSyncNow,
  onOpenWizardAfterCreate,
}) => {
  const [tab, setTab] = useState<'projects' | 'storage' | 'create'>(initialMode);
  const [newName, setNewName] = useState('');
  const [newSlug, setNewSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [startPoint, setStartPoint] = useState<'wizard' | 'blank' | 'duplicate'>('blank');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [pendingSwitchSlug, setPendingSwitchSlug] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<AcademicProjectDescriptor | null>(null);
  const [renamingSlug, setRenamingSlug] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    if (!open) return;
    setTab(initialMode);
    setError(null);
    setPendingSwitchSlug(null);
    setPendingDelete(null);
    setRenamingSlug(null);
    if (initialMode === 'create') {
      requestAnimationFrame(() => nameInputRef.current?.focus());
    } else {
      requestAnimationFrame(() => closeBtnRef.current?.focus());
    }
  }, [initialMode, open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        if (pendingSwitchSlug) {
          setPendingSwitchSlug(null);
        } else if (pendingDelete) {
          setPendingDelete(null);
        } else if (renamingSlug) {
          setRenamingSlug(null);
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
  }, [open, onClose, pendingDelete, pendingSwitchSlug, renamingSlug]);

  if (!open) return null;

  const effectiveSlug = slugEdited ? slugify(newSlug) : slugify(newName);
  const slugConflict = Boolean(effectiveSlug && projects.some((p) => p.slug === effectiveSlug));

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) {
      setError('Project name is required.');
      return;
    }
    if (!effectiveSlug || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(effectiveSlug)) {
      setError('Slug must use lowercase letters, numbers, and hyphens.');
      return;
    }
    if (slugConflict) {
      setError(`A project with slug "${effectiveSlug}" already exists.`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onCreateProject({
        displayName: newName.trim(),
        slug: effectiveSlug,
        templateId: startPoint === 'duplicate' ? activeProject?.templateId : 'expl3-showcase',
      });
      setNewName('');
      setNewSlug('');
      setSlugEdited(false);
      onClose();
      if (startPoint === 'wizard') {
        onOpenWizardAfterCreate();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project');
    } finally {
      setBusy(false);
    }
  };

  const handleSwitch = async (slug: string) => {
    if (slug === activeProject?.slug) {
      onClose();
      return;
    }
    if (isDirty) {
      setPendingSwitchSlug(slug);
      return;
    }
    setBusy(true);
    try {
      await onSwitchProject(slug);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to switch project');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="b2-modal-title"
        className="modal-dialog"
        style={{ maxWidth: 620 }}
      >
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Cloud size={18} color="var(--accent-text)" aria-hidden="true" />
            <h2 id="b2-modal-title" className="modal-title">
              Backblaze B2 Cloud Projects &amp; Storage
            </h2>
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            className="btn btn-icon btn-ghost"
            aria-label="Close Backblaze B2 project manager"
            onClick={onClose}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div
          role="tablist"
          aria-label="Project Manager Sections"
          style={{
            display: 'flex',
            gap: 6,
            padding: '8px 18px',
            borderBottom: '1px solid var(--border-subtle)',
            background: 'var(--bg-surface-subtle)',
          }}
        >
          {(
            [
              { id: 'projects', label: `My Projects (${projects.length})` },
              { id: 'create', label: 'New Project' },
              { id: 'storage', label: 'B2 Connection & Status' },
            ] as const
          ).map((t, idx, arr) => {
            const selected = tab === t.id;
            return (
              <button
                key={t.id}
                ref={(el) => {
                  tabRefs.current[idx] = el;
                }}
                type="button"
                role="tab"
                aria-selected={selected}
                tabIndex={selected ? 0 : -1}
                className={`btn btn-sm ${selected ? 'btn-primary' : ''}`}
                onClick={() => setTab(t.id)}
                onKeyDown={(e) => {
                  let nextIdx: number | null = null;
                  if (e.key === 'ArrowRight') nextIdx = (idx + 1) % arr.length;
                  else if (e.key === 'ArrowLeft') nextIdx = (idx - 1 + arr.length) % arr.length;
                  else if (e.key === 'Home') nextIdx = 0;
                  else if (e.key === 'End') nextIdx = arr.length - 1;
                  if (nextIdx !== null) {
                    e.preventDefault();
                    setTab(arr[nextIdx].id);
                    tabRefs.current[nextIdx]?.focus();
                  }
                }}
              >
                {t.id === 'create' && <FolderPlus size={12} aria-hidden="true" />}
                {t.label}
              </button>
            );
          })}
        </div>

        <div className="modal-body">
          {error && (
            <div
              role="alert"
              className="studio-card"
              style={{ background: 'var(--danger-bg)', color: 'var(--danger-text)', marginBottom: 12 }}
            >
              {error}
            </div>
          )}

          {pendingSwitchSlug && (
            <div
              role="alertdialog"
              aria-label="Unsaved changes before switching project"
              className="studio-card"
              style={{ borderColor: 'var(--warning-border)', background: 'var(--warning-bg)', marginBottom: 12 }}
            >
              <div style={{ fontWeight: 600, marginBottom: 8 }}>
                Save changes to &ldquo;{activeProject?.displayName}&rdquo; before switching?
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    await onSaveAndSwitchProject(pendingSwitchSlug);
                    setBusy(false);
                    onClose();
                  }}
                >
                  Save &amp; Switch
                </button>
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    await onSwitchProject(pendingSwitchSlug);
                    setBusy(false);
                    onClose();
                  }}
                >
                  Discard &amp; Switch
                </button>
                <button type="button" className="btn btn-sm" onClick={() => setPendingSwitchSlug(null)}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {pendingDelete && (
            <div
              role="alertdialog"
              aria-label="Confirm project deletion"
              className="studio-card"
              style={{ borderColor: 'var(--danger-border)', background: 'var(--danger-bg)', marginBottom: 12 }}
            >
              <div style={{ fontWeight: 600, marginBottom: 8 }}>
                Delete &ldquo;{pendingDelete.displayName}&rdquo;? This removes all files and snapshots from your B2 workspace.
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    await onDeleteProject(pendingDelete.slug);
                    setPendingDelete(null);
                    setBusy(false);
                  }}
                >
                  Delete Permanently
                </button>
                <button type="button" className="btn btn-sm" onClick={() => setPendingDelete(null)}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {tab === 'projects' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {projects.map((proj) => {
                const isActive = proj.slug === activeProject?.slug;
                return (
                  <div
                    key={proj.slug}
                    className="studio-card"
                    style={{
                      marginTop: 0,
                      borderColor: isActive ? 'var(--accent-solid)' : 'var(--border-subtle)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ minWidth: 0 }}>
                        {renamingSlug === proj.slug ? (
                          <form
                            style={{ display: 'flex', gap: 6 }}
                            onSubmit={async (e) => {
                              e.preventDefault();
                              if (!renameValue.trim()) return;
                              await onRenameProject(proj.slug, renameValue.trim());
                              setRenamingSlug(null);
                            }}
                          >
                            <input
                              type="text"
                              className="input"
                              value={renameValue}
                              onChange={(e) => setRenameValue(e.target.value)}
                              autoFocus
                            />
                            <button type="submit" className="btn btn-primary btn-sm">
                              Save
                            </button>
                            <button type="button" className="btn btn-sm" onClick={() => setRenamingSlug(null)}>
                              Cancel
                            </button>
                          </form>
                        ) : (
                          <>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <strong style={{ fontSize: 13 }}>{proj.displayName}</strong>
                              {isActive && <span className="badge badge-info">Active</span>}
                              <span className="badge badge-neutral">v{proj.version}</span>
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                              <code>{proj.slug}</code> • Updated {new Date(proj.updatedAt).toLocaleString()}
                            </div>
                          </>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                        {!isActive && (
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={() => void handleSwitch(proj.slug)}
                          >
                            Open
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn btn-icon btn-sm"
                          aria-label={`Rename ${proj.displayName}`}
                          title="Rename project"
                          onClick={() => {
                            setRenamingSlug(proj.slug);
                            setRenameValue(proj.displayName);
                          }}
                        >
                          <Edit3 size={12} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          className="btn btn-icon btn-sm"
                          aria-label={`Duplicate ${proj.displayName}`}
                          title="Duplicate project"
                          onClick={() => void onDuplicateProject(proj.slug, `${proj.displayName} (Copy)`)}
                        >
                          <Copy size={12} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          className="btn btn-icon btn-sm"
                          aria-label={`Delete ${proj.displayName}`}
                          title="Delete project"
                          onClick={() => setPendingDelete(proj)}
                        >
                          <Trash2 size={12} aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {tab === 'create' && (
            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label htmlFor="new-project-name" style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>
                  Project Name *
                </label>
                <input
                  ref={nameInputRef}
                  id="new-project-name"
                  type="text"
                  className="input"
                  placeholder="NeurIPS Workshop Paper"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  required
                />
              </div>

              <div>
                <label htmlFor="new-project-slug" style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>
                  Cloud Workspace Slug
                </label>
                <input
                  id="new-project-slug"
                  type="text"
                  className="input"
                  value={slugEdited ? newSlug : effectiveSlug}
                  aria-invalid={slugConflict}
                  onChange={(e) => {
                    setSlugEdited(true);
                    setNewSlug(e.target.value);
                  }}
                />
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  Namespace: <code>{storageStatus?.userPrefix ?? 'users/<userId>/'}{effectiveSlug || '...'}/</code>
                </div>
                {slugConflict && (
                  <div className="field-error" role="alert">
                    A project with this slug already exists.
                  </div>
                )}
              </div>

              <fieldset style={{ border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 10 }}>
                <legend style={{ fontWeight: 600, fontSize: 12, padding: '0 4px' }}>Starting Point</legend>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="startPoint"
                      checked={startPoint === 'wizard'}
                      onChange={() => setStartPoint('wizard')}
                    />
                    <span>Academic Paper Setup Wizard...</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="startPoint"
                      checked={startPoint === 'blank'}
                      onChange={() => setStartPoint('blank')}
                    />
                    <span>LaTeX3 (expl3 + xparse) Starter Document</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="startPoint"
                      checked={startPoint === 'duplicate'}
                      onChange={() => setStartPoint('duplicate')}
                    />
                    <span>Copy Current Document Structure</span>
                  </label>
                </div>
              </fieldset>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button type="button" className="btn" onClick={() => setTab('projects')}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={busy || slugConflict}>
                  {busy ? <Loader2 size={14} className="spin-icon" aria-hidden="true" /> : null}
                  Create Project in B2
                </button>
              </div>
            </form>
          )}

          {tab === 'storage' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="studio-card" style={{ marginTop: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <strong>Storage Driver</strong>
                  {storageStatus?.storageDriver === 'b2' ? (
                    <span className="badge badge-success">
                      <CheckCircle2 size={12} aria-hidden="true" />
                      Connected to Backblaze B2
                    </span>
                  ) : (
                    <span className="badge badge-warning">
                      <CloudOff size={12} aria-hidden="true" />
                      Local Filesystem Fallback
                    </span>
                  )}
                </div>
                {storageStatus?.storageDriver !== 'b2' && (
                  <p style={{ margin: '0 0 8px 0', fontSize: 12, color: 'var(--text-muted)' }}>
                    Backblaze B2 environment variables are not configured on the server. Projects and snapshots are persisted safely on the server filesystem under your isolated user namespace.
                  </p>
                )}
                <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: '140px 1fr', gap: '6px 10px', fontSize: 12 }}>
                  <dt style={{ color: 'var(--text-muted)' }}>Bucket Name</dt>
                  <dd style={{ margin: 0 }}><code>{storageStatus?.bucketName ?? 'local-fallback-store'}</code></dd>
                  <dt style={{ color: 'var(--text-muted)' }}>Endpoint Region</dt>
                  <dd style={{ margin: 0 }}><code>{storageStatus?.endpointRegion ?? 'local-fs'}</code></dd>
                  <dt style={{ color: 'var(--text-muted)' }}>User Prefix</dt>
                  <dd style={{ margin: 0 }}><code>{storageStatus?.userPrefix ?? 'users/<userId>/'}</code></dd>
                  <dt style={{ color: 'var(--text-muted)' }}>Active Project</dt>
                  <dd style={{ margin: 0 }}>
                    {activeProject ? `${activeProject.displayName} (v${activeProject.version})` : 'None'}
                  </dd>
                </dl>
              </div>

              {testResult && (
                <div role="status" className="studio-card" style={{ background: 'var(--success-bg)', color: 'var(--success-text)' }}>
                  {testResult}
                </div>
              )}

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  className="btn"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    const status = await onTestStorage();
                    setTestResult(
                      status.connected
                        ? `Connected (${status.storageDriver}) • ${status.latencyMs ?? 1} ms`
                        : status.errorMessage ?? 'Connection check failed'
                    );
                    setBusy(false);
                  }}
                >
                  <RefreshCw size={13} aria-hidden="true" />
                  Test B2 Connection
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busy || !activeProject}
                  onClick={async () => {
                    setBusy(true);
                    await onSyncNow();
                    setBusy(false);
                    setTestResult('Project synced to storage.');
                  }}
                >
                  Sync Now
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
