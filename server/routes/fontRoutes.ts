import { Router } from 'express';
import multer from 'multer';
import { getAuthenticatedUser, type AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { HttpError } from '../middleware/errorMiddleware.js';
import type { FontStorageService } from '../services/fontStorageService.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 64 * 1024 * 1024,
  },
});

export function createFontRouter(fontService: FontStorageService): Router {
  const router = Router();

  router.get('/', async (req: AuthenticatedRequest, res, next) => {
    try {
      const user = getAuthenticatedUser(req);
      const fonts = await fontService.listFonts(user.userId);
      res.json({ fonts });
    } catch (err) {
      next(err);
    }
  });

  router.post('/', upload.single('file'), async (req: AuthenticatedRequest, res, next) => {
    try {
      const user = getAuthenticatedUser(req);
      if (!req.file) {
        throw new HttpError(400, 'Multipart file field "file" is required', 'MISSING_FILE');
      }
      const displayName = typeof req.body?.displayName === 'string' ? req.body.displayName : undefined;
      const familyName = typeof req.body?.familyName === 'string' ? req.body.familyName : undefined;
      const isMonospace =
        req.body?.isMonospace === 'true'
          ? true
          : req.body?.isMonospace === 'false'
            ? false
            : undefined;
      const font = await fontService.uploadFont(user.userId, req.file.originalname, req.file.buffer, {
        displayName,
        familyName,
        isMonospace,
      });
      res.status(201).json({ font });
    } catch (err) {
      next(err);
    }
  });

  router.patch('/:fontId', async (req: AuthenticatedRequest, res, next) => {
    try {
      const user = getAuthenticatedUser(req);
      const fontId = String(req.params.fontId || '');
      const font = await fontService.renameFont(
        user.userId,
        fontId,
        String(req.body?.displayName ?? '')
      );
      res.json({ font });
    } catch (err) {
      next(err);
    }
  });

  router.delete('/:fontId', async (req: AuthenticatedRequest, res, next) => {
    try {
      const user = getAuthenticatedUser(req);
      const fontId = String(req.params.fontId || '');
      await fontService.deleteFont(user.userId, fontId);
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  router.get('/:fontId/binary', async (req: AuthenticatedRequest, res, next) => {
    try {
      const user = getAuthenticatedUser(req);
      const fontId = String(req.params.fontId || '');
      const fontData = await fontService.getFontBinary(user.userId, fontId);
      res.setHeader('Content-Type', fontData.contentType);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.send(fontData.body);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
