import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type {
  StorageProvider,
  StoredObjectData,
  StoredObjectEntry,
  StoredObjectMeta,
} from './storageProvider.js';
import { HttpError } from '../../middleware/errorMiddleware.js';

interface SidecarMeta {
  contentType?: string;
  etag: string;
}

export class LocalStorageProvider implements StorageProvider {
  readonly driver = 'local' as const;
  readonly bucketName = 'local-fallback-store';
  readonly endpointRegion = 'local-filesystem';
  private readonly rootDir: string;

  constructor(rootDir: string) {
    this.rootDir = path.resolve(rootDir);
  }

  private normalizeKey(key: string): string {
    if (!key || typeof key !== 'string') {
      throw new HttpError(400, 'Storage key is required', 'INVALID_STORAGE_KEY');
    }
    if (key.startsWith('/') || key.startsWith('\\') || key.includes('..') || key.includes('\0') || key.includes('\\')) {
      throw new HttpError(400, 'Invalid storage key path', 'INVALID_STORAGE_KEY');
    }
    const parts = key.split('/').filter((p) => p.length > 0);
    if (parts.length === 0 || parts.some((p) => p === '.' || p === '..' || /[\x00-\x1f]/.test(p))) {
      throw new HttpError(400, 'Invalid storage key segment', 'INVALID_STORAGE_KEY');
    }
    return parts.join('/');
  }

  private resolveSafePath(key: string): { filePath: string; metaPath: string; normalizedKey: string } {
    const normalizedKey = this.normalizeKey(key);
    const filePath = path.resolve(this.rootDir, normalizedKey);
    if (filePath !== this.rootDir && !filePath.startsWith(this.rootDir + path.sep)) {
      throw new HttpError(400, 'Storage path escapes containment root', 'PATH_CONTAINMENT_ERROR');
    }
    const metaPath = `${filePath}.__meta.json`;
    return { filePath, metaPath, normalizedKey };
  }

  private async ensureNoSymlinkAncestors(targetPath: string): Promise<void> {
    const rel = path.relative(this.rootDir, targetPath);
    const segments = rel.split(path.sep).filter(Boolean);
    let current = this.rootDir;
    for (const seg of segments) {
      current = path.join(current, seg);
      try {
        const stat = await fs.lstat(current);
        if (stat.isSymbolicLink()) {
          throw new HttpError(400, 'Symbolic links are prohibited in local storage', 'SYMLINK_REJECTED');
        }
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
          break;
        }
        throw err;
      }
    }
  }

  async putObject(key: string, body: Buffer | string, contentType?: string): Promise<{ etag: string }> {
    const { filePath, metaPath } = this.resolveSafePath(key);
    const buffer = typeof body === 'string' ? Buffer.from(body, 'utf8') : body;
    const etag = crypto.createHash('sha256').update(buffer).digest('hex');

    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await this.ensureNoSymlinkAncestors(filePath);

    const tmpFile = `${filePath}.${crypto.randomBytes(6).toString('hex')}.tmp`;
    await fs.writeFile(tmpFile, buffer);
    await fs.rename(tmpFile, filePath);

    const meta: SidecarMeta = { contentType, etag };
    const tmpMeta = `${metaPath}.${crypto.randomBytes(6).toString('hex')}.tmp`;
    await fs.writeFile(tmpMeta, JSON.stringify(meta), 'utf8');
    await fs.rename(tmpMeta, metaPath);

    return { etag };
  }

  async getObject(key: string): Promise<StoredObjectData | null> {
    const { filePath, metaPath } = this.resolveSafePath(key);
    try {
      await this.ensureNoSymlinkAncestors(filePath);
      const stat = await fs.lstat(filePath);
      if (!stat.isFile()) return null;
      const body = await fs.readFile(filePath);
      let meta: SidecarMeta | null = null;
      try {
        const raw = await fs.readFile(metaPath, 'utf8');
        meta = JSON.parse(raw) as SidecarMeta;
      } catch {
        meta = null;
      }
      const etag = meta?.etag ?? crypto.createHash('sha256').update(body).digest('hex');
      return {
        body,
        contentType: meta?.contentType,
        etag,
      };
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw err;
    }
  }

  async headObject(key: string): Promise<StoredObjectMeta | null> {
    const { filePath, metaPath } = this.resolveSafePath(key);
    try {
      await this.ensureNoSymlinkAncestors(filePath);
      const stat = await fs.lstat(filePath);
      if (!stat.isFile()) return null;
      let meta: SidecarMeta | null = null;
      try {
        meta = JSON.parse(await fs.readFile(metaPath, 'utf8')) as SidecarMeta;
      } catch {
        meta = null;
      }
      return {
        sizeBytes: stat.size,
        contentType: meta?.contentType,
        etag: meta?.etag,
        updatedAt: stat.mtime.toISOString(),
      };
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw err;
    }
  }

  async deleteObject(key: string): Promise<void> {
    const { filePath, metaPath } = this.resolveSafePath(key);
    await fs.rm(filePath, { force: true });
    await fs.rm(metaPath, { force: true });
  }

  async deletePrefix(prefix: string): Promise<void> {
    const normalizedPrefix = this.normalizeKey(prefix.replace(/\/+$/, ''));
    const targetDir = path.resolve(this.rootDir, normalizedPrefix);
    if (targetDir !== this.rootDir && !targetDir.startsWith(this.rootDir + path.sep)) {
      throw new HttpError(400, 'Invalid prefix', 'PATH_CONTAINMENT_ERROR');
    }
    await fs.rm(targetDir, { recursive: true, force: true });
  }

  async listObjects(prefix: string): Promise<StoredObjectEntry[]> {
    const cleanPrefix = prefix.replace(/^\/+/, '');
    const results: StoredObjectEntry[] = [];

    const walk = async (dir: string): Promise<void> => {
      let entries;
      try {
        entries = await fs.readdir(dir, { withFileTypes: true });
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') return;
        throw err;
      }
      for (const entry of entries) {
        if (entry.isSymbolicLink()) continue;
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await walk(fullPath);
        } else if (entry.isFile() && !entry.name.endsWith('.__meta.json') && !entry.name.endsWith('.tmp')) {
          const relKey = path.relative(this.rootDir, fullPath).split(path.sep).join('/');
          if (relKey.startsWith(cleanPrefix)) {
            const stat = await fs.stat(fullPath);
            results.push({
              key: relKey,
              sizeBytes: stat.size,
              updatedAt: stat.mtime.toISOString(),
            });
          }
        }
      }
    };

    await walk(this.rootDir);
    results.sort((a, b) => a.key.localeCompare(b.key));
    return results;
  }

  async checkConnection(): Promise<{ connected: boolean; latencyMs: number; errorMessage?: string }> {
    const start = performance.now();
    try {
      await fs.mkdir(this.rootDir, { recursive: true });
      return {
        connected: true,
        latencyMs: Math.max(1, Math.round(performance.now() - start)),
      };
    } catch (err) {
      return {
        connected: false,
        latencyMs: Math.max(1, Math.round(performance.now() - start)),
        errorMessage: err instanceof Error ? err.message : 'Local storage inaccessible',
      };
    }
  }
}
