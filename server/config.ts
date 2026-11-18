import crypto from 'node:crypto';
import path from 'node:path';
import type { StorageDriver } from '../shared/types/auth.js';

export interface ServerConfig {
  port: number;
  nodeEnv: string;
  isProduction: boolean;
  jwtSecret: string;
  googleClientId: string | null;
  devAuthEnabled: boolean;
  storageDriver: StorageDriver;
  b2Endpoint: string | null;
  b2Region: string;
  b2BucketName: string | null;
  b2KeyId: string | null;
  b2ApplicationKey: string | null;
  storageLocalDir: string;
}

let cachedDevJwtSecret: string | null = null;

function getOrCreateJwtSecret(nodeEnv: string): string {
  const envSecret = process.env.JWT_SECRET?.trim();
  if (envSecret && envSecret.length >= 16) {
    return envSecret;
  }
  if (nodeEnv === 'production') {
    throw new Error('JWT_SECRET environment variable (min 16 chars) is required in production');
  }
  if (!cachedDevJwtSecret) {
    cachedDevJwtSecret = crypto.randomBytes(32).toString('hex');
    if (nodeEnv !== 'test') {
      console.warn('[config] JWT_SECRET not set; using ephemeral development session key.');
    }
  }
  return cachedDevJwtSecret;
}

function parseRegionFromEndpoint(endpoint: string | null, fallbackRegion: string): string {
  if (!endpoint) return fallbackRegion;
  const match = endpoint.match(/s3\.([a-z0-9-]+)\.backblazeb2\.com/i);
  return match?.[1] ?? fallbackRegion;
}

export function loadConfig(): ServerConfig {
  const nodeEnv = process.env.NODE_ENV?.trim() || 'development';
  const isProduction = nodeEnv === 'production';
  const port = Number.parseInt(process.env.PORT || '4000', 10) || 4000;
  const googleClientId = process.env.GOOGLE_CLIENT_ID?.trim() || null;
  const allowDevAuthEnv = process.env.ALLOW_DEV_AUTH?.trim().toLowerCase();

  // Production guard: fail closed in production unless ALLOW_DEV_AUTH is explicitly 'true'
  const devAuthEnabled = isProduction
    ? allowDevAuthEnv === 'true'
    : allowDevAuthEnv !== 'false';

  const b2Endpoint = process.env.B2_ENDPOINT?.trim() || null;
  const b2BucketName = process.env.B2_BUCKET_NAME?.trim() || null;
  const b2KeyId = process.env.B2_KEY_ID?.trim() || null;
  const b2ApplicationKey = process.env.B2_APPLICATION_KEY?.trim() || null;
  const b2Region = parseRegionFromEndpoint(
    b2Endpoint,
    process.env.B2_REGION?.trim() || 'us-west-004'
  );

  const hasAllB2 = Boolean(b2Endpoint && b2BucketName && b2KeyId && b2ApplicationKey);
  const storageDriver: StorageDriver = hasAllB2 ? 'b2' : 'local';

  const storageLocalDir = path.resolve(
    process.cwd(),
    process.env.STORAGE_LOCAL_DIR?.trim() || '.data/b2-local-storage'
  );

  return {
    port,
    nodeEnv,
    isProduction,
    jwtSecret: getOrCreateJwtSecret(nodeEnv),
    googleClientId,
    devAuthEnabled,
    storageDriver,
    b2Endpoint,
    b2Region,
    b2BucketName,
    b2KeyId,
    b2ApplicationKey,
    storageLocalDir,
  };
}
