import type { NextFunction, Request, Response } from 'express';

export class HttpError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly details?: unknown;

  constructor(status: number, message: string, code?: string, details?: unknown) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function errorMiddleware(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof HttpError) {
    if (err.status === 409 && err.details && typeof err.details === 'object') {
      res.status(409).json(err.details);
      return;
    }
    res.status(err.status).json({
      error: err.message,
      code: err.code,
      details: err.details,
    });
    return;
  }

  // Multer file-size error or similar
  if (err && typeof err === 'object' && 'code' in err && (err as { code?: string }).code === 'LIMIT_FILE_SIZE') {
    res.status(413).json({
      error: 'Uploaded file exceeds maximum allowed size limit',
      code: 'FILE_TOO_LARGE',
    });
    return;
  }

  const isProd = process.env.NODE_ENV === 'production';
  const message =
    !isProd && err instanceof Error ? err.message : 'Internal server error';
  if (!isProd && process.env.NODE_ENV !== 'test') {
    console.error('[server error]', err);
  }
  res.status(500).json({
    error: message,
    code: 'INTERNAL_ERROR',
  });
}
