import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, FileText, Loader2, ShieldCheck, Sparkles, UserCheck } from 'lucide-react';
import type { AuthConfig } from '@shared/types';

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (options: {
            client_id: string;
            callback: (response: { credential?: string }) => void;
          }) => void;
          renderButton: (
            element: HTMLElement,
            options: { theme?: string; size?: string; width?: number; text?: string }
          ) => void;
          prompt: () => void;
        };
      };
    };
  }
}

export interface AuthGateViewProps {
  authConfig: AuthConfig | null;
  authLoading: boolean;
  authError: string | null;
  onGoogleToken: (idToken: string) => Promise<void>;
  onDevLogin: (email: string, name?: string) => Promise<void>;
}

const DEMO_PERSONAS = [
  { name: 'Ada Lovelace', email: 'ada@latexap.dev', role: 'Author • LaTeX3 Researcher' },
  { name: 'Carl Gauss', email: 'gauss@latexap.dev', role: 'Co-Author • Applied Math' },
];

export const AuthGateView: React.FC<AuthGateViewProps> = ({
  authConfig,
  authLoading,
  authError,
  onGoogleToken,
  onDevLogin,
}) => {
  const googleBtnRef = useRef<HTMLDivElement | null>(null);
  const [showCustomDev, setShowCustomDev] = useState(false);
  const [customEmail, setCustomEmail] = useState('');
  const [customName, setCustomName] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [gsiReady, setGsiReady] = useState(false);

  useEffect(() => {
    const clientId = authConfig?.googleClientId;
    if (!clientId) return;

    let cancelled = false;

    const initGsi = () => {
      if (cancelled || !window.google?.accounts?.id) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (response) => {
          if (response.credential) {
            void onGoogleToken(response.credential);
          }
        },
      });
      if (googleBtnRef.current) {
        googleBtnRef.current.innerHTML = '';
        window.google.accounts.id.renderButton(googleBtnRef.current, {
          theme: 'outline',
          size: 'large',
          width: 340,
          text: 'signin_with',
        });
      }
      setGsiReady(true);
    };

    if (window.google?.accounts?.id) {
      initGsi();
      return () => {
        cancelled = true;
      };
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = initGsi;
    document.head.appendChild(script);

    return () => {
      cancelled = true;
    };
  }, [authConfig?.googleClientId, onGoogleToken]);

  const handleCustomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = customEmail.trim();
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      setEmailError('Please enter a valid email address.');
      return;
    }
    setEmailError(null);
    await onDevLogin(trimmedEmail, customName.trim() || undefined);
  };

  return (
    <main className="auth-gate" aria-label="Sign in to LaTeXaP-WeB">
      <section className="auth-card" aria-labelledby="auth-gate-title">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div
            className="toolbar-brand__mark"
            style={{ width: 40, height: 40, fontSize: 16, borderRadius: 10 }}
            aria-hidden="true"
          >
            TeX
          </div>
          <div>
            <h1 id="auth-gate-title" style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>
              LaTeXaP-WeB
            </h1>
            <p style={{ margin: '2px 0 0 0', color: 'var(--text-muted)', fontSize: 13 }}>
              Modern LaTeX3 &amp; Academic Paper Studio
            </p>
          </div>
        </div>

        <ul
          style={{
            margin: '0 0 20px 0',
            padding: '12px 14px',
            listStyle: 'none',
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-surface-subtle)',
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            fontSize: 12.5,
          }}
        >
          <li style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sparkles size={15} color="var(--accent-text)" aria-hidden="true" />
            <span>100% client-side browser PDF rendering &amp; bidirectional SyncTeX</span>
          </li>
          <li style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShieldCheck size={15} color="var(--success-text)" aria-hidden="true" />
            <span>
              Multi-project cloud workspaces in{' '}
              {authConfig?.storageDriver === 'b2' ? 'Backblaze B2' : 'Backblaze B2 (Local Fallback)'}
            </span>
          </li>
          <li style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileText size={15} color="var(--warning-text)" aria-hidden="true" />
            <span>Academic Paper Wizard, DOI/CrossRef citations, tables &amp; Pre-Flight checks</span>
          </li>
        </ul>

        {authError && (
          <div
            role="alert"
            aria-live="assertive"
            className="studio-card"
            style={{
              marginBottom: 16,
              background: 'var(--danger-bg)',
              borderColor: 'var(--danger-border)',
              color: 'var(--danger-text)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 8,
            }}
          >
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} aria-hidden="true" />
            <span>{authError}</span>
          </div>
        )}

        {authConfig?.googleClientId && (
          <div style={{ marginBottom: 16 }}>
            <div
              ref={googleBtnRef}
              style={{
                display: 'flex',
                justifyContent: 'center',
                minHeight: 42,
              }}
            />
            {!gsiReady && (
              <button
                type="button"
                className="btn btn-primary"
                style={{ width: '100%', height: 40, fontSize: 13 }}
                disabled={authLoading}
                onClick={() => window.google?.accounts?.id?.prompt()}
              >
                {authLoading ? (
                  <>
                    <Loader2 size={15} className="spin-icon" aria-hidden="true" />
                    Signing in with Google...
                  </>
                ) : (
                  'Sign in with Google'
                )}
              </button>
            )}
          </div>
        )}

        {authConfig?.devAuthEnabled && (
          <div
            style={{
              padding: 14,
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              background: 'var(--bg-surface-elevated)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                marginBottom: 10,
                fontSize: 12,
                color: 'var(--info-text)',
              }}
            >
              <CheckCircle2 size={14} aria-hidden="true" />
              <span>
                {authConfig.googleClientId
                  ? 'Local Developer / Evaluation Login enabled'
                  : 'Google OAuth is running in Local Dev Mode (GOOGLE_CLIENT_ID not configured).'}
              </span>
            </div>

            <button
              type="button"
              className="btn btn-primary"
              style={{ width: '100%', height: 38, fontSize: 13, marginBottom: 10 }}
              disabled={authLoading}
              onClick={() => void onDevLogin(DEMO_PERSONAS[0].email, DEMO_PERSONAS[0].name)}
            >
              {authLoading ? (
                <>
                  <Loader2 size={15} className="spin-icon" aria-hidden="true" />
                  Signing in...
                </>
              ) : (
                <>
                  <UserCheck size={15} aria-hidden="true" />
                  Continue with Demo Google Account (Ada Lovelace)
                </>
              )}
            </button>

            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
              {DEMO_PERSONAS.map((persona) => (
                <button
                  key={persona.email}
                  type="button"
                  className="btn btn-sm"
                  style={{ flex: 1 }}
                  disabled={authLoading}
                  onClick={() => void onDevLogin(persona.email, persona.name)}
                >
                  {persona.name}
                </button>
              ))}
            </div>

            <button
              type="button"
              className="btn btn-ghost btn-sm"
              style={{ width: '100%', color: 'var(--accent-text)' }}
              aria-expanded={showCustomDev}
              onClick={() => setShowCustomDev((prev) => !prev)}
            >
              {showCustomDev ? 'Hide custom dev account' : 'Sign in as Another Demo User...'}
            </button>

            {showCustomDev && (
              <form
                onSubmit={handleCustomSubmit}
                style={{
                  marginTop: 10,
                  paddingTop: 10,
                  borderTop: '1px solid var(--border-subtle)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                <div>
                  <label htmlFor="dev-name-input" style={{ display: 'block', fontSize: 11.5, marginBottom: 4 }}>
                    Display Name
                  </label>
                  <input
                    id="dev-name-input"
                    type="text"
                    className="input"
                    placeholder="Emmy Noether"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="dev-email-input" style={{ display: 'block', fontSize: 11.5, marginBottom: 4 }}>
                    Email Address *
                  </label>
                  <input
                    id="dev-email-input"
                    type="email"
                    className="input"
                    placeholder="noether@latexap.dev"
                    value={customEmail}
                    aria-invalid={Boolean(emailError)}
                    aria-describedby={emailError ? 'dev-email-error' : undefined}
                    onChange={(e) => {
                      setCustomEmail(e.target.value);
                      setEmailError(null);
                    }}
                    required
                  />
                  {emailError && (
                    <div id="dev-email-error" className="field-error" role="alert">
                      {emailError}
                    </div>
                  )}
                </div>
                <button type="submit" className="btn" disabled={authLoading}>
                  Sign In with Custom Dev Account
                </button>
              </form>
            )}
          </div>
        )}

        {!authConfig && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16 }}>
            <Loader2 size={16} className="spin-icon" aria-hidden="true" />
            <span>Connecting to authentication service...</span>
          </div>
        )}
      </section>
    </main>
  );
};
