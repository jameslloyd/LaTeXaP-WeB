export type AuthMode = 'google' | 'dev';

export type StorageDriver = 'b2' | 'local';

export interface AuthConfig {
  googleClientId: string | null;
  devAuthEnabled: boolean;
  storageDriver: StorageDriver;
}

export interface AuthUser {
  userId: string;
  email: string;
  name: string;
  picture?: string;
  authMode: AuthMode;
}

export interface HealthResponse {
  ok: boolean;
  status: 'ok';
  storageDriver: StorageDriver;
  storageMode: StorageDriver;
  devAuthEnabled: boolean;
  timestamp: string;
}
