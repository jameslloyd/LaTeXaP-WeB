import React, { useEffect, useRef, useState } from 'react';
import { Cloud, LogOut, RefreshCw, Shield, User } from 'lucide-react';
import type { AuthConfig, AuthUser, ProjectSyncState, StorageStatusInfo } from '@shared/types';

export interface UserMenuPopoverProps {
  user: AuthUser;
  authConfig: AuthConfig | null;
  storageStatus: StorageStatusInfo | null;
  syncState: ProjectSyncState;
  isDirty: boolean;
  onOpenStorageModal: () => void;
  onSwitchDevUser: (email: string, name?: string) => Promise<void>;
  onSaveAndLogout: () => Promise<void>;
  onLogout: () => Promise<void>;
}

export const UserMenuPopover: React.FC<UserMenuPopoverProps> = ({
  user,
  authConfig,
  storageStatus,
  syncState,
  isDirty,
  onOpenStorageModal,
  onSwitchDevUser,
  onSaveAndLogout,
  onLogout,
}) => {
  const [open, setOpen] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
        setConfirmSignOut(false);
        triggerRef.current?.focus();
      }
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setConfirmSignOut(false);
      }
    };
    window.addEventListener('keydown', handleKey);
    window.addEventListener('mousedown', handleClickOutside);
    return () => {
      window.removeEventListener('keydown', handleKey);
      window.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open]);

  const initials = user.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');

  const handleSignOutClick = async () => {
    if (isDirty) {
      setConfirmSignOut(true);
      return;
    }
    setOpen(false);
    await onLogout();
  };

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <button
        ref={triggerRef}
        type="button"
        className="btn"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Account menu for ${user.name}`}
        onClick={() => setOpen((prev) => !prev)}
        style={{ padding: '0 8px 0 4px', gap: 6 }}
      >
        {user.picture && user.picture.startsWith('https://') ? (
          <img
            src={user.picture}
            alt=""
            referrerPolicy="no-referrer"
            width={20}
            height={20}
            style={{ borderRadius: '50%', objectFit: 'cover' }}
          />
        ) : (
          <span
            aria-hidden="true"
            style={{
              width: 20,
              height: 20,
              borderRadius: '50%',
              background: 'var(--accent-solid)',
              color: 'var(--accent-solid-text)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 10,
              fontWeight: 700,
            }}
          >
            {initials || <User size={12} />}
          </span>
        )}
        <span style={{ maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {user.name}
        </span>
        <span className="badge badge-neutral" style={{ fontSize: 10, padding: '1px 5px' }}>
          {user.authMode === 'google' ? 'Google' : 'Demo'}
        </span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="false"
          aria-label="Account and session menu"
          className="popover-panel"
          style={{ width: 310 }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div
              aria-hidden="true"
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: 'var(--accent-solid)',
                color: 'var(--accent-solid-text)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {initials || 'U'}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user.name}
              </div>
              <div
                style={{
                  fontSize: 11.5,
                  color: 'var(--text-muted)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {user.email}
              </div>
            </div>
          </div>

          <div
            className="studio-card"
            style={{
              padding: '8px 10px',
              marginBottom: 10,
              fontSize: 11.5,
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Session</span>
              <span className="badge badge-success">
                <Shield size={11} aria-hidden="true" />
                Active ({user.authMode === 'google' ? 'Google OAuth' : 'Dev Mode'})
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>User ID</span>
              <code style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5 }}>{user.userId}</code>
            </div>
          </div>

          <button
            type="button"
            className="btn"
            style={{ width: '100%', justifyContent: 'space-between', marginBottom: 8 }}
            onClick={() => {
              setOpen(false);
              onOpenStorageModal();
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Cloud size={14} aria-hidden="true" />
              Backblaze B2 Storage
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {storageStatus?.storageDriver === 'b2' ? 'B2 Cloud' : 'Local Fallback'} ({syncState})
            </span>
          </button>

          {authConfig?.devAuthEnabled && (
            <div
              style={{
                paddingTop: 8,
                marginBottom: 8,
                borderTop: '1px solid var(--border-subtle)',
              }}
            >
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>
                Switch Demo Account (Multi-User Isolation)
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  type="button"
                  className="btn btn-sm"
                  style={{ flex: 1 }}
                  disabled={user.email === 'ada@latexap.dev'}
                  onClick={() => {
                    setOpen(false);
                    void onSwitchDevUser('ada@latexap.dev', 'Ada Lovelace');
                  }}
                >
                  <RefreshCw size={11} aria-hidden="true" />
                  Ada
                </button>
                <button
                  type="button"
                  className="btn btn-sm"
                  style={{ flex: 1 }}
                  disabled={user.email === 'gauss@latexap.dev'}
                  onClick={() => {
                    setOpen(false);
                    void onSwitchDevUser('gauss@latexap.dev', 'Carl Gauss');
                  }}
                >
                  <RefreshCw size={11} aria-hidden="true" />
                  Gauss
                </button>
              </div>
            </div>
          )}

          {!confirmSignOut ? (
            <button
              type="button"
              className="btn btn-danger"
              style={{ width: '100%' }}
              onClick={() => void handleSignOutClick()}
            >
              <LogOut size={14} aria-hidden="true" />
              Sign Out
            </button>
          ) : (
            <div
              role="alertdialog"
              aria-label="Unsaved changes before sign out"
              className="studio-card"
              style={{
                borderColor: 'var(--warning-border)',
                background: 'var(--warning-bg)',
                color: 'var(--warning-text)',
              }}
            >
              <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 8 }}>
                Save project to Backblaze B2 before signing out?
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={async () => {
                    setConfirmSignOut(false);
                    setOpen(false);
                    await onSaveAndLogout();
                  }}
                >
                  Save &amp; Sign Out
                </button>
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={async () => {
                    setConfirmSignOut(false);
                    setOpen(false);
                    await onLogout();
                  }}
                >
                  Sign Out Without Saving
                </button>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => setConfirmSignOut(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
