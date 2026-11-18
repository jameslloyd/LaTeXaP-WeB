import type { AuthConfig, AuthUser } from './auth.js';
import type { BibEntry, RubricTargetConfig } from './academic.js';
import type { CustomFontRecord } from './fonts.js';
import type {
  AcademicProjectDescriptor,
  ProjectBinaryAsset,
  ProjectConflictInfo,
  SnapshotDetail,
  SnapshotManifest,
  StorageStatusInfo,
  UserWorkspaceManifest,
} from './project.js';

export interface ApiErrorResponse {
  error: string;
  code?: string;
  details?: unknown;
}

export type AuthConfigResponse = AuthConfig;

export interface AuthUserResponse {
  user: AuthUser | null;
}

export interface GoogleLoginRequest {
  idToken: string;
}

export interface DevLoginRequest {
  email: string;
  name?: string;
}

export interface ListProjectsResponse {
  workspace: UserWorkspaceManifest;
  projects: AcademicProjectDescriptor[];
}

export interface GetProjectResponse {
  project: AcademicProjectDescriptor;
  files: Record<string, string>;
  binaryAssets: ProjectBinaryAsset[];
}

export interface CreateProjectResponse {
  project: AcademicProjectDescriptor;
  files: Record<string, string>;
}

export interface RenameProjectRequest {
  displayName: string;
}

export interface DuplicateProjectRequest {
  displayName: string;
  slug?: string;
}

export interface SaveProjectRequest {
  files: Record<string, string>;
  expectedVersion: number;
  message?: string;
  forceOverwrite?: boolean;
}

export interface SaveProjectResponse {
  project: AcademicProjectDescriptor;
  snapshot: SnapshotManifest | null;
  skippedNoChanges: boolean;
}

export type ConflictProjectResponse = ProjectConflictInfo;

export interface UploadAssetResponse {
  relativePath: string;
  sizeBytes: number;
  contentType: string;
  url: string;
}

export interface ListSnapshotsResponse {
  snapshots: SnapshotManifest[];
}

export type GetSnapshotDetailResponse = SnapshotDetail;

export interface RestoreSnapshotResponse {
  project: AcademicProjectDescriptor;
  snapshot: SnapshotManifest;
  files: Record<string, string>;
}

export type UpdateRubricRequest = RubricTargetConfig;

export type StorageStatusResponse = StorageStatusInfo;

export interface ListFontsResponse {
  fonts: CustomFontRecord[];
}

export interface FontResponse {
  font: CustomFontRecord;
}

export interface RenameFontRequest {
  displayName: string;
}

export interface CitationSearchResponse {
  entries: BibEntry[];
}

export interface CitationLookupResponse {
  entry: BibEntry;
}
