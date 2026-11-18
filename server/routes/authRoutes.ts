import { Router } from 'express';
import type { ServerConfig } from '../config.js';
import { AuthService, SESSION_COOKIE_NAME } from '../services/authService.js';

export function createAuthRouter(config: ServerConfig, authService: AuthService): Router {
  const router = Router();

  const cookieOptions = {
    httpOnly: true,
    sameSite: 'lax' as const,
    path: '/',
    secure: config.isProduction,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };

  router.get('/config', (_req, res) => {
    res.json({
      googleClientId: config.googleClientId,
      devAuthEnabled: config.devAuthEnabled,
      storageDriver: config.storageDriver,
    });
  });

  router.post('/google', async (req, res, next) => {
    try {
      const idToken = typeof req.body?.idToken === 'string' ? req.body.idToken : '';
      const user = await authService.verifyGoogleLogin(idToken);
      const jwt = await authService.mintSessionToken(user);
      res.cookie(SESSION_COOKIE_NAME, jwt, cookieOptions);
      res.json({ user });
    } catch (err) {
      next(err);
    }
  });

  router.post('/dev-login', async (req, res, next) => {
    try {
      const email = typeof req.body?.email === 'string' ? req.body.email : '';
      const name = typeof req.body?.name === 'string' ? req.body.name : undefined;
      const user = authService.loginDevPersona(email, name);
      const jwt = await authService.mintSessionToken(user);
      res.cookie(SESSION_COOKIE_NAME, jwt, cookieOptions);
      res.json({ user });
    } catch (err) {
      next(err);
    }
  });

  router.get('/me', async (req, res) => {
    const token = req.cookies?.[SESSION_COOKIE_NAME] as string | undefined;
    if (!token) {
      res.json({ user: null });
      return;
    }
    const user = await authService.verifySessionToken(token);
    res.json({ user });
  });

  router.post('/logout', (_req, res) => {
    res.clearCookie(SESSION_COOKIE_NAME, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: config.isProduction,
    });
    res.json({ ok: true });
  });

  return router;
}
