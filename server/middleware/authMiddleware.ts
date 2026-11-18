import type { NextFunction, Request, Response } from 'express';
import type { AuthUser } from '../../shared/types/auth.js';
import { AuthService, SESSION_COOKIE_NAME } from '../services/authService.js';
import { HttpError } from './errorMiddleware.js';

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

export function createRequireAuth(authService: AuthService) {
  return async (req: AuthenticatedRequest, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const token = req.cookies?.[SESSION_COOKIE_NAME] as string | undefined;
      if (!token) {
        throw new HttpError(401, 'Authentication required', 'UNAUTHENTICATED');
      }
      const user = await authService.verifySessionToken(token);
      if (!user) {
        throw new HttpError(401, 'Session expired or invalid', 'INVALID_SESSION');
      }
      req.user = user;
      next();
    } catch (err) {
      next(err);
    }
  };
}

export function getAuthenticatedUser(req: AuthenticatedRequest): AuthUser {
  if (!req.user) {
    throw new HttpError(401, 'Authentication required', 'UNAUTHENTICATED');
  }
  return req.user;
}
