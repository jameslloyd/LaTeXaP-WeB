import type { RubricTargetConfig } from './academic.js';
import type { StorageDriver } from './auth.js';

export type ProjectSyncState =
  | 'idle'
  | 'saving'
  | 'saved'
  | 'offline-fallback'
  | 'conflict'
  | 'error';

export interface UserWorkspaceManifest {
  schemaVersion: number;
  userId: string;
  activeProjectSlug: string | null;
  updatedAt: string;
}

export interface AcademicProjectDescriptor {
  id: string;
  slug: string;
  displayName: string;
  mainTexFile: string;
  bibFile: string;
  templateId: string;
  version: number;
  rubricTargets: RubricTargetConfig;
  createdAt: string;
  updatedAt: string;
  lastSnapshotId?: string | null;
  lastSnapshotAt?: string | null;
}

export interface ProjectBinaryAsset {
  relativePath: string;
  sizeBytes: number;
  contentType: string;
  sha256: string;
  updatedAt: string;
  url: string;
}

export interface SnapshotManifest {
  snapshotId: string;
  parentSnapshotId: string | null;
  message: string;
  authorName: string;
  createdAt: string;
  changedFiles: string[];
  fileHashes: Record<string, string>;
}

export interface FileDiffSummary {
  relativePath: string;
  status: 'added' | 'modified' | 'deleted' | 'unchanged';
  additions: number;
  deletions: number;
  unifiedDiff: string;
}

export interface SnapshotDetail {
  snapshot: SnapshotManifest;
  files: Record<string, string>;
  diffs: FileDiffSummary[];
}

export interface ProjectConflictInfo {
  slug: string;
  expectedVersion: number;
  serverVersion: number;
  serverFiles: Record<string, string>;
  conflictFiles: string[];
}

export type ConflictResolutionChoice = 'keep-both' | 'keep-local' | 'use-cloud';

export interface StorageStatusInfo {
  storageDriver: StorageDriver;
  bucketName: string;
  endpointRegion: string;
  userPrefix: string;
  connected: boolean;
  latencyMs?: number;
  errorMessage?: string;
}

export interface CreateProjectInput {
  displayName: string;
  slug?: string;
  templateId?: string;
  mainTexContent?: string;
  bibContent?: string;
  rubricTargets?: RubricTargetConfig;
}
