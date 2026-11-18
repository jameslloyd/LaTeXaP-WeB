import type {
  ApiErrorResponse,
  AuthConfigResponse,
  AuthUserResponse,
  CitationLookupResponse,
  CitationSearchResponse,
  CreateProjectInput,
  CreateProjectResponse,
  DevLoginRequest,
  DuplicateProjectRequest,
  FontResponse,
  GetProjectResponse,
  GetSnapshotDetailResponse,
  GoogleLoginRequest,
  ListFontsResponse,
  ListProjectsResponse,
  ListSnapshotsResponse,
  ProjectConflictInfo,
  RenameFontRequest,
  RenameProjectRequest,
  RestoreSnapshotResponse,
  RubricTargetConfig,
  SaveProjectRequest,
  SaveProjectResponse,
  StorageStatusResponse,
  UploadAssetResponse,
} from '@shared/types/index.js';
import type { AcademicProjectDescriptor } from '@shared/types/project.js';

export class ApiHttpError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly details?: unknown;

  constructor(status: number, message: string, code?: string, details?: unknown) {
    super(message);
    this.name = 'ApiHttpError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export class ProjectConflictError extends ApiHttpError {
  readonly conflict: ProjectConflictInfo;

  constructor(conflict: ProjectConflictInfo) {
    super(409, 'Project version conflict detected', 'PROJECT_CONFLICT', conflict);
    this.name = 'ProjectConflictError';
    this.conflict = conflict;
  }
}

async function requestJson<T>(url: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, {
    ...init,
    headers,
    credentials: 'include',
  });

  if (response.status === 409) {
    const conflictBody = (await response.json()) as ProjectConflictInfo;
    throw new ProjectConflictError(conflictBody);
  }

  if (!response.ok) {
    let errorBody: ApiErrorResponse | null = null;
    try {
      errorBody = (await response.json()) as ApiErrorResponse;
    } catch {
      errorBody = null;
    }
    throw new ApiHttpError(
      response.status,
      errorBody?.error ?? `Request failed (${response.status})`,
      errorBody?.code,
      errorBody?.details
    );
  }

  return (await response.json()) as T;
}

export const apiClient = {
  // Auth
  getAuthConfig(): Promise<AuthConfigResponse> {
    return requestJson<AuthConfigResponse>('/api/auth/config');
  },

  getMe(): Promise<AuthUserResponse> {
    return requestJson<AuthUserResponse>('/api/auth/me');
  },

  loginWithGoogle(body: GoogleLoginRequest): Promise<AuthUserResponse> {
    return requestJson<AuthUserResponse>('/api/auth/google', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  loginWithDevPersona(body: DevLoginRequest): Promise<AuthUserResponse> {
    return requestJson<AuthUserResponse>('/api/auth/dev-login', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  logout(): Promise<{ ok: boolean }> {
    return requestJson<{ ok: boolean }>('/api/auth/logout', {
      method: 'POST',
    });
  },

  // Projects & B2 Storage
  listProjects(): Promise<ListProjectsResponse> {
    return requestJson<ListProjectsResponse>('/api/projects');
  },

  getStorageStatus(): Promise<StorageStatusResponse> {
    return requestJson<StorageStatusResponse>('/api/projects/storage/status');
  },

  createProject(input: CreateProjectInput): Promise<CreateProjectResponse> {
    return requestJson<CreateProjectResponse>('/api/projects', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  getProject(slug: string): Promise<GetProjectResponse> {
    return requestJson<GetProjectResponse>(`/api/projects/${encodeURIComponent(slug)}`);
  },

  renameProject(slug: string, body: RenameProjectRequest): Promise<{ project: AcademicProjectDescriptor }> {
    return requestJson<{ project: AcademicProjectDescriptor }>(`/api/projects/${encodeURIComponent(slug)}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  },

  duplicateProject(slug: string, body: DuplicateProjectRequest): Promise<CreateProjectResponse> {
    return requestJson<CreateProjectResponse>(`/api/projects/${encodeURIComponent(slug)}/duplicate`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  deleteProject(slug: string): Promise<{ ok: boolean }> {
    return requestJson<{ ok: boolean }>(`/api/projects/${encodeURIComponent(slug)}`, {
      method: 'DELETE',
    });
  },

  saveProject(slug: string, body: SaveProjectRequest): Promise<SaveProjectResponse> {
    return requestJson<SaveProjectResponse>(`/api/projects/${encodeURIComponent(slug)}/save`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  },

  async uploadProjectAsset(slug: string, file: File, targetDir = 'figures'): Promise<UploadAssetResponse> {
    const form = new FormData();
    form.append('file', file);
    form.append('targetDir', targetDir);
    return requestJson<UploadAssetResponse>(`/api/projects/${encodeURIComponent(slug)}/assets`, {
      method: 'POST',
      body: form,
    });
  },

  async fetchBinaryAsset(url: string): Promise<Uint8Array> {
    const response = await fetch(url, { credentials: 'include' });
    if (!response.ok) {
      throw new ApiHttpError(response.status, `Failed to load binary asset (${response.status})`);
    }
    const buf = await response.arrayBuffer();
    return new Uint8Array(buf);
  },

  deleteProjectAsset(slug: string, relativePath: string): Promise<{ ok: boolean }> {
    const encodedPath = relativePath
      .split('/')
      .map((part) => encodeURIComponent(part))
      .join('/');
    return requestJson<{ ok: boolean }>(`/api/projects/${encodeURIComponent(slug)}/assets/${encodedPath}`, {
      method: 'DELETE',
    });
  },

  listSnapshots(slug: string): Promise<ListSnapshotsResponse> {
    return requestJson<ListSnapshotsResponse>(`/api/projects/${encodeURIComponent(slug)}/snapshots`);
  },

  getSnapshotDetail(slug: string, snapshotId: string): Promise<GetSnapshotDetailResponse> {
    return requestJson<GetSnapshotDetailResponse>(
      `/api/projects/${encodeURIComponent(slug)}/snapshots/${encodeURIComponent(snapshotId)}`
    );
  },

  restoreSnapshot(slug: string, snapshotId: string): Promise<RestoreSnapshotResponse> {
    return requestJson<RestoreSnapshotResponse>(
      `/api/projects/${encodeURIComponent(slug)}/snapshots/${encodeURIComponent(snapshotId)}/restore`,
      { method: 'POST' }
    );
  },

  updateRubricTargets(slug: string, rubric: RubricTargetConfig): Promise<{ project: AcademicProjectDescriptor }> {
    return requestJson<{ project: AcademicProjectDescriptor }>(
      `/api/projects/${encodeURIComponent(slug)}/rubric`,
      {
        method: 'PATCH',
        body: JSON.stringify(rubric),
      }
    );
  },

  // Custom Fonts
  listFonts(): Promise<ListFontsResponse> {
    return requestJson<ListFontsResponse>('/api/fonts');
  },

  uploadFont(file: File, displayName?: string, familyName?: string, isMonospace?: boolean): Promise<FontResponse> {
    const form = new FormData();
    form.append('file', file);
    if (displayName) form.append('displayName', displayName);
    if (familyName) form.append('familyName', familyName);
    if (typeof isMonospace === 'boolean') form.append('isMonospace', String(isMonospace));
    return requestJson<FontResponse>('/api/fonts', {
      method: 'POST',
      body: form,
    });
  },

  renameFont(fontId: string, body: RenameFontRequest): Promise<FontResponse> {
    return requestJson<FontResponse>(`/api/fonts/${encodeURIComponent(fontId)}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  },

  deleteFont(fontId: string): Promise<{ ok: boolean }> {
    return requestJson<{ ok: boolean }>(`/api/fonts/${encodeURIComponent(fontId)}`, {
      method: 'DELETE',
    });
  },

  async fetchFontBinary(fontId: string): Promise<Uint8Array> {
    const response = await fetch(`/api/fonts/${encodeURIComponent(fontId)}/binary`, {
      credentials: 'include',
    });
    if (!response.ok) {
      throw new ApiHttpError(response.status, `Failed to load font binary (${response.status})`);
    }
    return new Uint8Array(await response.arrayBuffer());
  },

  // Citations
  searchCitations(query: string, rows = 10): Promise<CitationSearchResponse> {
    const params = new URLSearchParams({ q: query, rows: String(rows) });
    return requestJson<CitationSearchResponse>(`/api/citations/search?${params.toString()}`);
  },

  lookupCitation(identifier: string): Promise<CitationLookupResponse> {
    const params = new URLSearchParams({ identifier });
    return requestJson<CitationLookupResponse>(`/api/citations/lookup?${params.toString()}`);
  },
};
