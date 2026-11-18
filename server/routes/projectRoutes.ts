import { Router } from 'express';
import multer from 'multer';
import { getAuthenticatedUser, type AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { HttpError } from '../middleware/errorMiddleware.js';
import type { ProjectService } from '../services/projectService.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024,
  },
});

export function createProjectRouter(projectService: ProjectService): Router {
  const router = Router();

  router.get('/', async (req: AuthenticatedRequest, res, next) => {
    try {
      const user = getAuthenticatedUser(req);
      const data = await projectService.listProjects(user.userId);
      res.json(data);
    } catch (err) {
      next(err);
    }
  });

  router.get('/storage/status', async (req: AuthenticatedRequest, res, next) => {
    try {
      const user = getAuthenticatedUser(req);
      const status = await projectService.getStorageStatus(user.userId);
      res.json(status);
    } catch (err) {
      next(err);
    }
  });

  router.post('/', async (req: AuthenticatedRequest, res, next) => {
    try {
      const user = getAuthenticatedUser(req);
      const created = await projectService.createProject(user.userId, user.name, req.body ?? {});
      res.status(201).json(created);
    } catch (err) {
      next(err);
    }
  });

  router.get('/:slug', async (req: AuthenticatedRequest, res, next) => {
    try {
      const user = getAuthenticatedUser(req);
      const slug = String(req.params.slug || '');
      const project = await projectService.getProject(user.userId, slug);
      res.json(project);
    } catch (err) {
      next(err);
    }
  });

  router.patch('/:slug', async (req: AuthenticatedRequest, res, next) => {
    try {
      const user = getAuthenticatedUser(req);
      const slug = String(req.params.slug || '');
      const project = await projectService.renameProject(
        user.userId,
        slug,
        String(req.body?.displayName ?? '')
      );
      res.json({ project });
    } catch (err) {
      next(err);
    }
  });

  router.post('/:slug/duplicate', async (req: AuthenticatedRequest, res, next) => {
    try {
      const user = getAuthenticatedUser(req);
      const slug = String(req.params.slug || '');
      const duplicated = await projectService.duplicateProject(
        user.userId,
        slug,
        user.name,
        String(req.body?.displayName ?? ''),
        typeof req.body?.slug === 'string' ? req.body.slug : undefined
      );
      res.status(201).json(duplicated);
    } catch (err) {
      next(err);
    }
  });

  router.delete('/:slug', async (req: AuthenticatedRequest, res, next) => {
    try {
      const user = getAuthenticatedUser(req);
      const slug = String(req.params.slug || '');
      await projectService.deleteProject(user.userId, slug);
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  router.put('/:slug/save', async (req: AuthenticatedRequest, res, next) => {
    try {
      const user = getAuthenticatedUser(req);
      const slug = String(req.params.slug || '');
      const result = await projectService.saveProject(user.userId, user.name, slug, req.body ?? {});
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  router.post('/:slug/assets', upload.single('file'), async (req: AuthenticatedRequest, res, next) => {
    try {
      const user = getAuthenticatedUser(req);
      if (!req.file) {
        throw new HttpError(400, 'Multipart file field "file" is required', 'MISSING_FILE');
      }
      const slug = String(req.params.slug || '');
      const result = await projectService.uploadAsset(
        user.userId,
        slug,
        req.file.originalname,
        req.file.buffer
      );
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  });

  router.get('/:slug/assets/*', async (req: AuthenticatedRequest, res, next) => {
    try {
      const user = getAuthenticatedUser(req);
      const slug = String(req.params.slug || '');
      const relPath = String((req.params as Record<string, string>)[0] || '');
      const asset = await projectService.getAsset(user.userId, slug, relPath);
      res.setHeader('Content-Type', asset.contentType);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.send(asset.body);
    } catch (err) {
      next(err);
    }
  });

  router.delete('/:slug/assets/*', async (req: AuthenticatedRequest, res, next) => {
    try {
      const user = getAuthenticatedUser(req);
      const slug = String(req.params.slug || '');
      const relPath = String((req.params as Record<string, string>)[0] || '');
      await projectService.deleteAsset(user.userId, slug, relPath);
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  router.get('/:slug/snapshots', async (req: AuthenticatedRequest, res, next) => {
    try {
      const user = getAuthenticatedUser(req);
      const slug = String(req.params.slug || '');
      const snapshots = await projectService.listSnapshots(user.userId, slug);
      res.json({ snapshots });
    } catch (err) {
      next(err);
    }
  });

  router.get('/:slug/snapshots/:snapshotId', async (req: AuthenticatedRequest, res, next) => {
    try {
      const user = getAuthenticatedUser(req);
      const slug = String(req.params.slug || '');
      const snapshotId = String(req.params.snapshotId || '');
      const detail = await projectService.getSnapshotDetail(user.userId, slug, snapshotId);
      res.json(detail);
    } catch (err) {
      next(err);
    }
  });

  router.post('/:slug/snapshots/:snapshotId/restore', async (req: AuthenticatedRequest, res, next) => {
    try {
      const user = getAuthenticatedUser(req);
      const slug = String(req.params.slug || '');
      const snapshotId = String(req.params.snapshotId || '');
      const restored = await projectService.restoreSnapshot(
        user.userId,
        user.name,
        slug,
        snapshotId
      );
      res.json(restored);
    } catch (err) {
      next(err);
    }
  });

  router.patch('/:slug/rubric', async (req: AuthenticatedRequest, res, next) => {
    try {
      const user = getAuthenticatedUser(req);
      const slug = String(req.params.slug || '');
      const project = await projectService.updateRubricTargets(user.userId, slug, req.body ?? {});
      res.json({ project });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
