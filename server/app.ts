import fs from 'node:fs';
import path from 'node:path';
import cookieParser from 'cookie-parser';
import express, { type Express } from 'express';
import { loadConfig, type ServerConfig } from './config.js';
import { createRequireAuth } from './middleware/authMiddleware.js';
import { errorMiddleware } from './middleware/errorMiddleware.js';
import { createAuthRouter } from './routes/authRoutes.js';
import { createCitationRouter } from './routes/citationRoutes.js';
import { createFontRouter } from './routes/fontRoutes.js';
import { createProjectRouter } from './routes/projectRoutes.js';
import { AuthService, type GoogleTokenVerifier } from './services/authService.js';
import { CitationProxyService, type FetchImpl } from './services/citationProxyService.js';
import { FontStorageService } from './services/fontStorageService.js';
import { ProjectService } from './services/projectService.js';
import { B2S3StorageProvider } from './services/storage/b2S3StorageProvider.js';
import { LocalStorageProvider } from './services/storage/localStorageProvider.js';
import type { StorageProvider } from './services/storage/storageProvider.js';

export interface AppDependencies {
  config?: ServerConfig;
  storageProvider?: StorageProvider;
  googleVerifier?: GoogleTokenVerifier;
  citationFetch?: FetchImpl;
}

export function createStorageProvider(config: ServerConfig): StorageProvider {
  if (
    config.storageDriver === 'b2' &&
    config.b2Endpoint &&
    config.b2BucketName &&
    config.b2KeyId &&
    config.b2ApplicationKey
  ) {
    return new B2S3StorageProvider({
      endpoint: config.b2Endpoint,
      region: config.b2Region,
      bucketName: config.b2BucketName,
      keyId: config.b2KeyId,
      applicationKey: config.b2ApplicationKey,
    });
  }
  return new LocalStorageProvider(config.storageLocalDir);
}

export function createApp(deps: AppDependencies = {}): {
  app: Express;
  config: ServerConfig;
  storageProvider: StorageProvider;
  authService: AuthService;
} {
  const config = deps.config ?? loadConfig();
  const storageProvider = deps.storageProvider ?? createStorageProvider(config);
  const authService = new AuthService(config, deps.googleVerifier);
  const projectService = new ProjectService(storageProvider);
  const fontService = new FontStorageService(storageProvider);
  const citationService = new CitationProxyService(deps.citationFetch);
  const requireAuth = createRequireAuth(authService);

  const app = express();
  app.disable('x-powered-by');

  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  app.use(cookieParser());
  app.use(express.json({ limit: '15mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      storageDriver: storageProvider.driver,
      devAuthEnabled: config.devAuthEnabled,
      timestamp: new Date().toISOString(),
    });
  });

  app.use('/api/auth', createAuthRouter(config, authService));
  app.use('/api/projects', requireAuth, createProjectRouter(projectService));
  app.use('/api/fonts', requireAuth, createFontRouter(fontService));
  app.use('/api/citations', requireAuth, createCitationRouter(citationService));

  // Serve built client assets in production
  const clientDistDir = path.resolve(process.cwd(), 'dist-client');
  if (config.isProduction && fs.existsSync(clientDistDir)) {
    app.use(express.static(clientDistDir));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/')) {
        next();
        return;
      }
      res.sendFile(path.join(clientDistDir, 'index.html'));
    });
  }

  app.use(errorMiddleware);

  return { app, config, storageProvider, authService };
}
