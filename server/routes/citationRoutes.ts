import { Router } from 'express';
import type { CitationProxyService } from '../services/citationProxyService.js';

export function createCitationRouter(citationService: CitationProxyService): Router {
  const router = Router();

  router.get('/search', async (req, res, next) => {
    try {
      const q = String(req.query.q ?? '');
      const rows = Number.parseInt(String(req.query.rows ?? '10'), 10) || 10;
      const entries = await citationService.searchCrossRef(q, rows);
      res.json({ entries });
    } catch (err) {
      next(err);
    }
  });

  router.get('/lookup', async (req, res, next) => {
    try {
      const identifier = String(req.query.identifier ?? '');
      const entry = await citationService.lookupByIdentifier(identifier);
      res.json({ entry });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
