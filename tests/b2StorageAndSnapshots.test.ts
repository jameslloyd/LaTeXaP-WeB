import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../server/app.js';
import { loadConfig } from '../server/config.js';
import { CitationProxyService } from '../server/services/citationProxyService.js';
import { LocalStorageProvider } from '../server/services/storage/localStorageProvider.js';

const tempDirs: string[] = [];

async function makeTempDir(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'latexap-b2-test-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((d) => fs.rm(d, { recursive: true, force: true })));
});

// Minimal valid 1x1 PNG buffer
const VALID_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64'
);

// Minimal valid TTF header (0x00010000 + 1 table)
const VALID_TTF = Buffer.from([
  0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x10, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
]);

describe('Backblaze B2 Local Fallback, Snapshots, Conflicts, Assets & Fonts', () => {
  it('enforces path containment and rejects symlinks in LocalStorageProvider', async () => {
    const dir = await makeTempDir();
    const provider = new LocalStorageProvider(dir);

    await expect(provider.putObject('../escape.txt', 'bad')).rejects.toThrow();
    await expect(provider.putObject('/abs.txt', 'bad')).rejects.toThrow();
    await expect(provider.putObject('users/u1/\0bad.txt', 'bad')).rejects.toThrow();

    const outsideFile = path.join(os.tmpdir(), `outside-${Date.now()}.txt`);
    await fs.writeFile(outsideFile, 'secret');
    await fs.mkdir(path.join(dir, 'users/u1'), { recursive: true });
    await fs.symlink(outsideFile, path.join(dir, 'users/u1/link.txt'));

    await expect(provider.getObject('users/u1/link.txt')).rejects.toThrow(/Symbolic links/);
    await fs.rm(outsideFile, { force: true });
  });

  it('supports project CRUD, snapshots, no-op skip, 409 conflicts, forward restore, figures & custom fonts', async () => {
    const dir = await makeTempDir();
    const storage = new LocalStorageProvider(dir);
    const config = {
      ...loadConfig(),
      nodeEnv: 'test',
      isProduction: false,
      jwtSecret: 'test-jwt-secret-key-at-least-32-bytes-long',
    };
    const { app } = createApp({ config, storageProvider: storage });
    const agent = request.agent(app);

    await agent.post('/api/auth/dev-login').send({ email: 'ada@latexap.dev', name: 'Ada' });

    // Storage status diagnostics (never leaks keys)
    const statusRes = await agent.get('/api/projects/storage/status');
    expect(statusRes.status).toBe(200);
    expect(statusRes.body.storageDriver).toBe('local');
    expect(statusRes.body.connected).toBe(true);
    expect(JSON.stringify(statusRes.body)).not.toContain('B2_APPLICATION_KEY');

    // Create project
    const createRes = await agent.post('/api/projects').send({
      displayName: 'CS229 Final Paper',
      slug: 'cs229-final',
      mainTexContent: '\\documentclass{article}\n\\begin{document}\nV1\n\\end{document}\n',
      bibContent: '',
    });
    expect(createRes.status).toBe(201);
    expect(createRes.body.project.version).toBe(1);

    // No-op save does not create duplicate empty snapshot
    const noopRes = await agent.put('/api/projects/cs229-final/save').send({
      files: createRes.body.files,
      expectedVersion: 1,
    });
    expect(noopRes.status).toBe(200);
    expect(noopRes.body.skippedNoChanges).toBe(true);
    expect(noopRes.body.snapshot).toBeNull();

    // Real save increments version and records snapshot
    const saveV2 = await agent.put('/api/projects/cs229-final/save').send({
      files: {
        'main.tex': '\\documentclass{article}\n\\begin{document}\nV2 edited\n\\end{document}\n',
        'references.bib': '',
      },
      expectedVersion: 1,
      message: 'Draft: Added methodology',
    });
    expect(saveV2.status).toBe(200);
    expect(saveV2.body.project.version).toBe(2);
    expect(saveV2.body.skippedNoChanges).toBe(false);
    expect(saveV2.body.snapshot.message).toBe('Draft: Added methodology');

    // Stale expectedVersion triggers 409 Conflict
    const conflictRes = await agent.put('/api/projects/cs229-final/save').send({
      files: {
        'main.tex': '\\documentclass{article}\n\\begin{document}\nStale tab edit\n\\end{document}\n',
        'references.bib': '',
      },
      expectedVersion: 1,
    });
    expect(conflictRes.status).toBe(409);
    expect(conflictRes.body.serverVersion).toBe(2);
    expect(conflictRes.body.conflictFiles).toContain('main.tex');

    // Snapshot list & detail diff
    const snapsRes = await agent.get('/api/projects/cs229-final/snapshots');
    expect(snapsRes.status).toBe(200);
    expect(snapsRes.body.snapshots).toHaveLength(2);
    const initialSnapId = snapsRes.body.snapshots[1].snapshotId;

    const detailRes = await agent.get(`/api/projects/cs229-final/snapshots/${initialSnapId}`);
    expect(detailRes.status).toBe(200);
    expect(detailRes.body.diffs.some((d: { status: string }) => d.status === 'modified')).toBe(true);

    // Forward restore creates new snapshot without erasing history
    const restoreRes = await agent.post(
      `/api/projects/cs229-final/snapshots/${initialSnapId}/restore`
    );
    expect(restoreRes.status).toBe(200);
    expect(restoreRes.body.project.version).toBe(3);
    expect(restoreRes.body.files['main.tex']).toContain('V1');

    const snapsAfterRestore = await agent.get('/api/projects/cs229-final/snapshots');
    expect(snapsAfterRestore.body.snapshots).toHaveLength(3);

    // Figure upload + magic byte validation
    const badPng = await agent
      .post('/api/projects/cs229-final/assets')
      .attach('file', Buffer.from('not a png'), 'evil.png');
    expect(badPng.status).toBe(400);

    const goodPng = await agent
      .post('/api/projects/cs229-final/assets')
      .attach('file', VALID_PNG, '../plot.png');
    expect(goodPng.status).toBe(201);
    expect(goodPng.body.relativePath).toBe('figures/plot.png');

    const downloadPng = await agent.get('/api/projects/cs229-final/assets/figures/plot.png');
    expect(downloadPng.status).toBe(200);
    expect(Buffer.from(downloadPng.body).equals(VALID_PNG)).toBe(true);

    // Custom font upload + rejection of unsupported format
    const badFont = await agent
      .post('/api/fonts')
      .attach('file', Buffer.from('wOF2'), 'bad.woff2');
    expect(badFont.status).toBe(400);

    const goodFont = await agent
      .post('/api/fonts')
      .attach('file', VALID_TTF, 'FiraCode-Regular.ttf');
    expect(goodFont.status).toBe(201);
    expect(goodFont.body.font.format).toBe('ttf');

    const fontBin = await agent.get(`/api/fonts/${goodFont.body.font.id}/binary`);
    expect(fontBin.status).toBe(200);
    expect(Buffer.from(fontBin.body).equals(VALID_TTF)).toBe(true);

    // Duplicate & delete project
    const dupRes = await agent
      .post('/api/projects/cs229-final/duplicate')
      .send({ displayName: 'CS229 Copy', slug: 'cs229-copy' });
    expect(dupRes.status).toBe(201);
    expect(dupRes.body.project.slug).toBe('cs229-copy');

    const delRes = await agent.delete('/api/projects/cs229-copy');
    expect(delRes.status).toBe(200);
  });

  it('sanitizes external CrossRef/arXiv metadata and enforces allowlist in CitationProxyService', async () => {
    const fakeFetch: typeof fetch = async (input) => {
      const url = String(input);
      if (url.includes('api.crossref.org')) {
        return new Response(
          JSON.stringify({
            message: {
              items: [
                {
                  title: ['TeX \\write18{rm -rf /} Study'],
                  author: [{ given: 'Donald', family: 'Knuth' }],
                  issued: { 'date-parts': [[1984]] },
                  'container-title': ['Computers & Typesetting'],
                  DOI: '10.1000/tex',
                  type: 'journal-article',
                },
              ],
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        );
      }
      return new Response('Not Found', { status: 404 });
    };

    const service = new CitationProxyService(fakeFetch);
    const entries = await service.searchCrossRef('texbook', 5);
    expect(entries).toHaveLength(1);
    expect(entries[0].title).not.toContain('\\');
    expect(entries[0].title).not.toContain('{');
    expect(entries[0].title).not.toContain('write18');
    expect(entries[0].citeKey).toBe('knuth1984study');

    await expect(service.lookupByIdentifier('not-a-valid-id')).rejects.toThrow();
  });
});
