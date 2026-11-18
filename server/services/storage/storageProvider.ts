import type { StorageDriver } from '../../../shared/types/auth.js';

export interface StoredObjectData {
  body: Buffer;
  contentType?: string;
  etag?: string;
}

export interface StoredObjectMeta {
  sizeBytes: number;
  contentType?: string;
  etag?: string;
  updatedAt: string;
}

export interface StoredObjectEntry {
  key: string;
  sizeBytes: number;
  etag?: string;
  updatedAt: string;
}

export interface StorageProvider {
  readonly driver: StorageDriver;
  readonly bucketName: string;
  readonly endpointRegion: string;

  putObject(key: string, body: Buffer | string, contentType?: string): Promise<{ etag: string }>;
  getObject(key: string): Promise<StoredObjectData | null>;
  headObject(key: string): Promise<StoredObjectMeta | null>;
  deleteObject(key: string): Promise<void>;
  deletePrefix(prefix: string): Promise<void>;
  listObjects(prefix: string): Promise<StoredObjectEntry[]>;
  checkConnection(): Promise<{ connected: boolean; latencyMs: number; errorMessage?: string }>;
}
