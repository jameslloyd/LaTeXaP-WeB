import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import type {
  StorageProvider,
  StoredObjectData,
  StoredObjectEntry,
  StoredObjectMeta,
} from './storageProvider.js';

export interface B2Config {
  endpoint: string;
  region: string;
  bucketName: string;
  keyId: string;
  applicationKey: string;
}

export class B2S3StorageProvider implements StorageProvider {
  readonly driver = 'b2' as const;
  readonly bucketName: string;
  readonly endpointRegion: string;
  private readonly client: S3Client;

  constructor(cfg: B2Config) {
    this.bucketName = cfg.bucketName;
    this.endpointRegion = cfg.region;
    const normalizedEndpoint = cfg.endpoint.startsWith('http')
      ? cfg.endpoint
      : `https://${cfg.endpoint}`;

    this.client = new S3Client({
      endpoint: normalizedEndpoint,
      region: cfg.region,
      forcePathStyle: true,
      credentials: {
        accessKeyId: cfg.keyId,
        secretAccessKey: cfg.applicationKey,
      },
    });
  }

  async putObject(key: string, body: Buffer | string, contentType?: string): Promise<{ etag: string }> {
    const buffer = typeof body === 'string' ? Buffer.from(body, 'utf8') : body;
    const res = await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: buffer,
        ContentType: contentType || 'application/octet-stream',
      })
    );
    return { etag: (res.ETag || '').replace(/"/g, '') };
  }

  async getObject(key: string): Promise<StoredObjectData | null> {
    try {
      const res = await this.client.send(
        new GetObjectCommand({
          Bucket: this.bucketName,
          Key: key,
        })
      );
      if (!res.Body) return null;
      const bytes = await res.Body.transformToByteArray();
      return {
        body: Buffer.from(bytes),
        contentType: res.ContentType,
        etag: res.ETag?.replace(/"/g, ''),
      };
    } catch (err) {
      if (isNotFoundError(err)) return null;
      throw err;
    }
  }

  async headObject(key: string): Promise<StoredObjectMeta | null> {
    try {
      const res = await this.client.send(
        new HeadObjectCommand({
          Bucket: this.bucketName,
          Key: key,
        })
      );
      return {
        sizeBytes: res.ContentLength ?? 0,
        contentType: res.ContentType,
        etag: res.ETag?.replace(/"/g, ''),
        updatedAt: (res.LastModified ?? new Date()).toISOString(),
      };
    } catch (err) {
      if (isNotFoundError(err)) return null;
      throw err;
    }
  }

  async deleteObject(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      })
    );
  }

  async deletePrefix(prefix: string): Promise<void> {
    const objects = await this.listObjects(prefix);
    if (objects.length === 0) return;

    for (let i = 0; i < objects.length; i += 1000) {
      const chunk = objects.slice(i, i + 1000);
      await this.client.send(
        new DeleteObjectsCommand({
          Bucket: this.bucketName,
          Delete: {
            Objects: chunk.map((o) => ({ Key: o.key })),
            Quiet: true,
          },
        })
      );
    }
  }

  async listObjects(prefix: string): Promise<StoredObjectEntry[]> {
    const entries: StoredObjectEntry[] = [];
    let continuationToken: string | undefined;

    do {
      const res = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.bucketName,
          Prefix: prefix,
          ContinuationToken: continuationToken,
        })
      );
      for (const item of res.Contents ?? []) {
        if (!item.Key) continue;
        entries.push({
          key: item.Key,
          sizeBytes: item.Size ?? 0,
          etag: item.ETag?.replace(/"/g, ''),
          updatedAt: (item.LastModified ?? new Date()).toISOString(),
        });
      }
      continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined;
    } while (continuationToken);

    entries.sort((a, b) => a.key.localeCompare(b.key));
    return entries;
  }

  async checkConnection(): Promise<{ connected: boolean; latencyMs: number; errorMessage?: string }> {
    const start = performance.now();
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucketName }));
      return {
        connected: true,
        latencyMs: Math.max(1, Math.round(performance.now() - start)),
      };
    } catch (err) {
      return {
        connected: false,
        latencyMs: Math.max(1, Math.round(performance.now() - start)),
        errorMessage: err instanceof Error ? err.message : 'Backblaze B2 connection failed',
      };
    }
  }
}

function isNotFoundError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const anyErr = err as { name?: string; $metadata?: { httpStatusCode?: number } };
  return (
    anyErr.name === 'NoSuchKey' ||
    anyErr.name === 'NotFound' ||
    anyErr.$metadata?.httpStatusCode === 404
  );
}
