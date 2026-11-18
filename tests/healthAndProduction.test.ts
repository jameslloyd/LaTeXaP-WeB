import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../server/app.js';
import { loadConfig } from '../server/config.js';
import { LocalStorageProvider } from '../server/services/storage/localStorageProvider.js';

const tempDirs: string[] = [];
const ORIGINAL_ENV = { ...process.env };

async function makeTempDir(prefix: string): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  process.env = { ...ORIGINAL_ENV };
  await Promise.all(tempDirs.splice(0).map((d) => fs.rm(d, { recursive: true, force: true })));
});

describe('Healthcheck & Production Configuration', () => {
  it('exposes GET /api/health returning 200 OK JSON with status and storage metadata', async () => {
    const storageDir = await makeTempDir('latexap-health-storage-');
    const storage = new LocalStorageProvider(storageDir);
    const config = {
      ...loadConfig(),
      nodeEnv: 'production',
      isProduction: true,
      devAuthEnabled: false,
      jwtSecret: 'test-production-jwt-secret-key-at-least-32-bytes',
      storageLocalDir: storageDir,
    };

    const { app } = createApp({ config, storageProvider: storage });

    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body.ok).toBe(true);
    expect(res.body.status).toBe('ok');
    expect(res.body.storageDriver).toBe('local');
    expect(res.body.storageMode).toBe('local');
    expect(res.body.devAuthEnabled).toBe(false);
    expect(typeof res.body.timestamp).toBe('string');
    expect(Number.isNaN(Date.parse(res.body.timestamp))).toBe(false);
  });

  it('honors LOCAL_STORAGE_ROOT over STORAGE_LOCAL_DIR and enforces production JWT_SECRET requirement', () => {
    const customRoot = path.join(os.tmpdir(), 'latexap-custom-local-root');
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'prod-secret-minimum-sixteen-chars';
    process.env.LOCAL_STORAGE_ROOT = customRoot;
    process.env.STORAGE_LOCAL_DIR = path.join(os.tmpdir(), 'latexap-ignored-dir');
    delete process.env.ALLOW_DEV_AUTH;

    const prodConfig = loadConfig();
    expect(prodConfig.isProduction).toBe(true);
    expect(prodConfig.devAuthEnabled).toBe(false);
    expect(prodConfig.storageLocalDir).toBe(path.resolve(customRoot));

    delete process.env.JWT_SECRET;
    expect(() => loadConfig()).toThrow(/JWT_SECRET/);
  });

  it('serves built SPA static assets and index.html fallback in production while returning JSON 404 for unknown /api routes', async () => {
    const storageDir = await makeTempDir('latexap-prod-storage-');
    const clientDistDir = await makeTempDir('latexap-prod-dist-');
    await fs.mkdir(path.join(clientDistDir, 'assets'), { recursive: true });
    await fs.writeFile(
      path.join(clientDistDir, 'index.html'),
      '<!doctype html><html><body><div id="root">LaTeXaP SPA</div></body></html>',
      'utf8'
    );
    await fs.writeFile(
      path.join(clientDistDir, 'assets', 'app.js'),
      'console.log("latexap");',
      'utf8'
    );

    const storage = new LocalStorageProvider(storageDir);
    const config = {
      ...loadConfig(),
      nodeEnv: 'production',
      isProduction: true,
      devAuthEnabled: false,
      jwtSecret: 'test-production-jwt-secret-key-at-least-32-bytes',
      storageLocalDir: storageDir,
    };

    const { app } = createApp({
      config,
      storageProvider: storage,
      clientDistDir,
    });

    const rootRes = await request(app).get('/');
    expect(rootRes.status).toBe(200);
    expect(rootRes.text).toContain('LaTeXaP SPA');

    const assetRes = await request(app).get('/assets/app.js');
    expect(assetRes.status).toBe(200);
    expect(assetRes.text).toContain('console.log("latexap")');

    const spaRouteRes = await request(app).get('/projects/quantum-paper');
    expect(spaRouteRes.status).toBe(200);
    expect(spaRouteRes.text).toContain('LaTeXaP SPA');

    const missingApiRes = await request(app).get('/api/does-not-exist');
    expect(missingApiRes.status).toBe(404);
    expect(missingApiRes.body).toEqual({
      error: 'API route not found',
      code: 'NOT_FOUND',
    });
  });
});
