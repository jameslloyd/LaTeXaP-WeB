import crypto from 'node:crypto';
import { OAuth2Client } from 'google-auth-library';
import { SignJWT, jwtVerify } from 'jose';
import type { AuthUser } from '../../shared/types/auth.js';
import type { ServerConfig } from '../config.js';
import { HttpError } from '../middleware/errorMiddleware.js';

export const SESSION_COOKIE_NAME = 'latexap_session';

export interface GoogleTokenVerifier {
  verifyIdToken(idToken: string, audience: string): Promise<{
    sub: string;
    email: string;
    emailVerified: boolean;
    name?: string;
    picture?: string;
  }>;
}

class DefaultGoogleTokenVerifier implements GoogleTokenVerifier {
  private readonly client = new OAuth2Client();

  async verifyIdToken(idToken: string, audience: string) {
    const ticket = await this.client.verifyIdToken({
      idToken,
      audience,
    });
    const payload = ticket.getPayload();
    if (!payload) {
      throw new HttpError(401, 'Invalid Google ID token payload', 'INVALID_GOOGLE_TOKEN');
    }
    const iss = payload.iss;
    if (iss !== 'accounts.google.com' && iss !== 'https://accounts.google.com') {
      throw new HttpError(401, 'Invalid Google token issuer', 'INVALID_GOOGLE_ISSUER');
    }
    if (!payload.sub || !payload.email) {
      throw new HttpError(401, 'Google token missing required subject or email', 'INVALID_GOOGLE_CLAIMS');
    }
    return {
      sub: payload.sub,
      email: payload.email,
      emailVerified: Boolean(payload.email_verified),
      name: payload.name,
      picture: payload.picture,
    };
  }
}

export class AuthService {
  private readonly config: ServerConfig;
  private readonly secretKey: Uint8Array;
  private readonly googleVerifier: GoogleTokenVerifier;

  constructor(config: ServerConfig, googleVerifier?: GoogleTokenVerifier) {
    this.config = config;
    this.secretKey = new TextEncoder().encode(config.jwtSecret);
    this.googleVerifier = googleVerifier ?? new DefaultGoogleTokenVerifier();
  }

  async verifyGoogleLogin(idToken: string): Promise<AuthUser> {
    if (!this.config.googleClientId) {
      throw new HttpError(
        400,
        'Google OAuth is not configured on this server (GOOGLE_CLIENT_ID unset)',
        'GOOGLE_AUTH_UNCONFIGURED'
      );
    }
    if (!idToken || typeof idToken !== 'string' || idToken.trim().length < 16) {
      throw new HttpError(400, 'Missing or malformed Google ID token', 'INVALID_ID_TOKEN');
    }

    let claims;
    try {
      claims = await this.googleVerifier.verifyIdToken(idToken, this.config.googleClientId);
    } catch (err) {
      if (err instanceof HttpError) throw err;
      throw new HttpError(401, 'Google ID token verification failed', 'GOOGLE_VERIFY_FAILED');
    }

    if (!claims.emailVerified) {
      throw new HttpError(403, 'Google account email must be verified', 'EMAIL_NOT_VERIFIED');
    }

    const sanitizedSub = claims.sub.replace(/[^a-zA-Z0-9_-]/g, '_');
    return {
      userId: `google_${sanitizedSub}`,
      email: claims.email,
      name: claims.name?.trim() || claims.email.split('@')[0] || 'Google User',
      picture: claims.picture,
      authMode: 'google',
    };
  }

  loginDevPersona(email: string, name?: string): AuthUser {
    if (!this.config.devAuthEnabled) {
      throw new HttpError(403, 'Local Dev Auth is disabled in this environment', 'DEV_AUTH_DISABLED');
    }
    const normalizedEmail = (email || '').trim().toLowerCase();
    if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      throw new HttpError(400, 'A valid email address is required for dev login', 'INVALID_EMAIL');
    }

    const hash = crypto.createHash('sha256').update(normalizedEmail).digest('hex').slice(0, 16);
    const cleanName =
      name?.trim().replace(/[\r\n\0]/g, '').slice(0, 80) ||
      normalizedEmail.split('@')[0] ||
      'Developer';

    return {
      userId: `dev_${hash}`,
      email: normalizedEmail,
      name: cleanName,
      authMode: 'dev',
    };
  }

  async mintSessionToken(user: AuthUser): Promise<string> {
    return new SignJWT({
      userId: user.userId,
      email: user.email,
      name: user.name,
      picture: user.picture ?? null,
      authMode: user.authMode,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(user.userId)
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(this.secretKey);
  }

  async verifySessionToken(token: string): Promise<AuthUser | null> {
    if (!token) return null;
    try {
      const { payload } = await jwtVerify(token, this.secretKey, {
        algorithms: ['HS256'],
      });
      const userId = typeof payload.userId === 'string' ? payload.userId : payload.sub;
      const email = typeof payload.email === 'string' ? payload.email : null;
      const name = typeof payload.name === 'string' ? payload.name : null;
      const authMode = payload.authMode === 'google' || payload.authMode === 'dev' ? payload.authMode : null;
      if (!userId || !email || !name || !authMode) {
        return null;
      }
      return {
        userId,
        email,
        name,
        picture: typeof payload.picture === 'string' ? payload.picture : undefined,
        authMode,
      };
    } catch {
      return null;
    }
  }
}
