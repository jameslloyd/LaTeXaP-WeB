import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../server/app.js';
import { loadConfig } from '../server/config.js';
import type { GoogleTokenVerifier } from '../server/services/authService.js';
import { LocalStorageProvider } from '../server/services/storage/localStorageProvider.js';

const tempDirs: string[] = [];

async function makeTempStorage(): Promise<LocalStorageProvider> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'latexap-auth-test-'));
  tempDirs.push(dir);
  return new LocalStorageProvider(dir);
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((d) => fs.rm(d, { recursive: true, force: true })));
});

describe('Google & Dev Auth + Multi-User Tenant Isolation', () => {
  it('supports dev auth login, HttpOnly cookie session, and strict cross-tenant isolation', async () => {
    const storage = await makeTempStorage();
    const config = {
      ...loadConfig(),
      nodeEnv: 'test',
      isProduction: false,
      googleClientId: null,
      devAuthEnabled: true,
      jwtSecret: 'test-jwt-secret-key-at-least-32-bytes-long',
    };
    const { app } = createApp({ config, storageProvider: storage });

    // Unauthenticated access rejected
    const unauth = await request(app).get('/api/projects');
    expect(unauth.status).toBe(401);

    const cfgRes = await request(app).get('/api/auth/config');
    expect(cfgRes.status).toBe(200);
    expect(cfgRes.body).toEqual({
      googleClientId: null,
      devAuthEnabled: true,
      storageDriver: 'local',
    });

    // User A (Ada) logs in
    const adaAgent = request.agent(app);
    const adaLogin = await adaAgent
      .post('/api/auth/dev-login')
      .send({ email: 'ada@latexap.dev', name: 'Ada Lovelace' });
    expect(adaLogin.status).toBe(200);
    expect(adaLogin.body.user.userId).toMatch(/^dev_[a-f0-9]{16}$/);
    expect(adaLogin.headers['set-cookie']?.[0]).toContain('HttpOnly');

    // Ada creates a private project
    const adaCreate = await adaAgent.post('/api/projects').send({
      displayName: 'Ada Secret Manuscript',
      slug: 'ada-secret',
      mainTexContent: '\\documentclass{article}\\begin{document}Ada Private\\end{document}',
    });
    expect(adaCreate.status).toBe(201);
    expect(adaCreate.body.project.slug).toBe('ada-secret');

    // User B (Gauss) logs in
    const gaussAgent = request.agent(app);
    const gaussLogin = await gaussAgent
      .post('/api/auth/dev-login')
      .send({ email: 'gauss@latexap.dev', name: 'Carl Gauss' });
    expect(gaussLogin.status).toBe(200);
    expect(gaussLogin.body.user.userId).not.toBe(adaLogin.body.user.userId);

    // Gauss sees 0 projects and cannot access Ada's project
    const gaussList = await gaussAgent.get('/api/projects');
    expect(gaussList.status).toBe(200);
    expect(gaussList.body.projects).toHaveLength(0);

    const gaussReadAda = await gaussAgent.get('/api/projects/ada-secret');
    expect(gaussReadAda.status).toBe(404);

    const gaussSaveAda = await gaussAgent.put('/api/projects/ada-secret/save').send({
      files: { 'main.tex': 'hacked' },
      expectedVersion: 1,
    });
    expect(gaussSaveAda.status).toBe(404);

    const gaussDeleteAda = await gaussAgent.delete('/api/projects/ada-secret');
    expect(gaussDeleteAda.status).toBe(404);

    // Logout clears session
    const logoutRes = await adaAgent.post('/api/auth/logout');
    expect(logoutRes.status).toBe(200);
    const afterLogout = await adaAgent.get('/api/auth/me');
    expect(afterLogout.body.user).toBeNull();
  });

  it('verifies Google OIDC ID tokens, rejects unverified email, and guards dev-login in production', async () => {
    const storage = await makeTempStorage();
    const mockVerifier: GoogleTokenVerifier = {
      async verifyIdToken(idToken: string) {
        if (idToken === 'valid-google-id-token-123456') {
          return {
            sub: '1082930011223344',
            email: 'scholar@university.edu',
            emailVerified: true,
            name: 'Google Scholar',
            picture: 'https://example.com/avatar.png',
          };
        }
        if (idToken === 'unverified-email-token-123456') {
          return {
            sub: '999888777',
            email: 'unverified@example.com',
            emailVerified: false,
            name: 'Unverified',
          };
        }
        throw new Error('Invalid token');
      },
    };

    const prodConfig = {
      ...loadConfig(),
      nodeEnv: 'production',
      isProduction: true,
      googleClientId: 'test-client-id.apps.googleusercontent.com',
      devAuthEnabled: false,
      jwtSecret: 'prod-jwt-secret-key-at-least-32-bytes-long',
    };

    const { app } = createApp({
      config: prodConfig,
      storageProvider: storage,
      googleVerifier: mockVerifier,
    });

    // Dev login must be blocked in production with Google Auth configured
    const blockedDev = await request(app)
      .post('/api/auth/dev-login')
      .send({ email: 'ada@latexap.dev' });
    expect(blockedDev.status).toBe(403);

    // Unverified Google email rejected
    const unverifiedRes = await request(app)
      .post('/api/auth/google')
      .send({ idToken: 'unverified-email-token-123456' });
    expect(unverifiedRes.status).toBe(403);

    // Bad token rejected
    const badRes = await request(app)
      .post('/api/auth/google')
      .send({ idToken: 'bad-token-000000000000000' });
    expect(badRes.status).toBe(401);

    // Valid Google token succeeds
    const validRes = await request(app)
      .post('/api/auth/google')
      .send({ idToken: 'valid-google-id-token-123456' });
    expect(validRes.status).toBe(200);
    expect(validRes.body.user.userId).toBe('google_1082930011223344');
    expect(validRes.body.user.authMode).toBe('google');
  });
});
