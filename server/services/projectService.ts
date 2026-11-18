import crypto from 'node:crypto';
import type {
  AcademicProjectDescriptor,
  CreateProjectInput,
  FileDiffSummary,
  ProjectBinaryAsset,
  ProjectConflictInfo,
  RubricTargetConfig,
  SaveProjectRequest,
  SaveProjectResponse,
  SnapshotDetail,
  SnapshotManifest,
  StorageStatusInfo,
  UserWorkspaceManifest,
} from '../../shared/types/index.js';
import { HttpError } from '../middleware/errorMiddleware.js';
import type { StorageProvider } from './storage/storageProvider.js';

const SLUG_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const MAX_FIGURE_BYTES = 50 * 1024 * 1024;
const ALLOWED_FIGURE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'pdf', 'svg', 'webp']);
const ALLOWED_TEXT_EXTENSIONS = new Set(['tex', 'bib', 'cls', 'sty', 'txt', 'md', 'csv']);

const DEFAULT_RUBRIC: RubricTargetConfig = {
  targetProseWords: null,
  maxPageCount: null,
  maxAbstractWords: null,
  studentModeHideExpl3: false,
};

const DEFAULT_MAIN_TEX = `\\documentclass[11pt,letterpaper]{article}
\\usepackage{expl3,xparse}
\\usepackage{amsmath,booktabs,graphicx}

\\title{Untitled LaTeXaP Document}
\\author{Research Author}
\\date{\\today}

\\begin{document}
\\maketitle

\\begin{abstract}
Write your abstract here.
\\end{abstract}

\\section{Introduction}
Start writing your LaTeX3 document here.

\\end{document}
`;

export function validateSlug(raw: string): string {
  const slug = (raw || '').trim();
  if (!slug || slug.length > 64 || !SLUG_REGEX.test(slug)) {
    throw new HttpError(
      400,
      'Project slug must be 1–64 lowercase alphanumeric characters or hyphens (e.g. "cs229-paper")',
      'INVALID_SLUG'
    );
  }
  return slug;
}

export function slugifyDisplayName(displayName: string): string {
  const base = displayName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 56);
  return base || `project-${crypto.randomBytes(3).toString('hex')}`;
}

export function validateRelativeProjectPath(
  rawPath: string,
  options: { allowFigures?: boolean; allowText?: boolean } = { allowFigures: false, allowText: true }
): string {
  const trimmed = (rawPath || '').trim();
  if (
    !trimmed ||
    trimmed.startsWith('/') ||
    trimmed.startsWith('\\') ||
    trimmed.includes('..') ||
    trimmed.includes('\\') ||
    trimmed.includes(':') ||
    trimmed.includes('\0') ||
    /[\x00-\x1f]/.test(trimmed)
  ) {
    throw new HttpError(400, `Invalid project file path: ${rawPath}`, 'INVALID_PATH');
  }

  const segments = trimmed.split('/');
  if (
    segments.some(
      (seg) =>
        !seg ||
        seg === '.' ||
        seg === '..' ||
        seg.startsWith('.')
    )
  ) {
    throw new HttpError(400, `Hidden or invalid path segment in: ${rawPath}`, 'INVALID_PATH');
  }

  const normalized = segments.join('/');
  if (normalized === 'project.json' || normalized === 'workspace.json') {
    throw new HttpError(400, `Reserved metadata filename: ${normalized}`, 'RESERVED_PATH');
  }

  const ext = normalized.includes('.') ? normalized.split('.').pop()!.toLowerCase() : '';
  if (normalized.startsWith('figures/')) {
    if (!options.allowFigures) {
      throw new HttpError(400, 'Use asset endpoint for figures/', 'INVALID_PATH');
    }
    if (!ALLOWED_FIGURE_EXTENSIONS.has(ext)) {
      throw new HttpError(400, `Unsupported figure extension: .${ext}`, 'UNSUPPORTED_FIGURE_TYPE');
    }
    return normalized;
  }

  if (!options.allowText) {
    throw new HttpError(400, 'Asset must reside under figures/', 'INVALID_PATH');
  }

  if (!ALLOWED_TEXT_EXTENSIONS.has(ext)) {
    throw new HttpError(400, `Unsupported text file extension: .${ext}`, 'UNSUPPORTED_TEXT_TYPE');
  }

  return normalized;
}

export function sanitizeFigureFileName(rawName: string): string {
  const leaf = rawName.split(/[\\/]/).pop() || 'figure.png';
  const dotIdx = leaf.lastIndexOf('.');
  const rawStem = dotIdx > 0 ? leaf.slice(0, dotIdx) : leaf;
  const rawExt = dotIdx > 0 ? leaf.slice(dotIdx + 1).toLowerCase() : 'png';
  const safeStem =
    rawStem
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 64) || 'figure';
  const safeExt = ALLOWED_FIGURE_EXTENSIONS.has(rawExt) ? rawExt : 'png';
  return `${safeStem}.${safeExt}`;
}

export function validateImageMagicBytes(buffer: Buffer, ext: string): void {
  if (buffer.length === 0) {
    throw new HttpError(400, 'Uploaded asset file is empty', 'EMPTY_FILE');
  }
  if (buffer.length > MAX_FIGURE_BYTES) {
    throw new HttpError(413, 'Figure exceeds 50 MB limit', 'FILE_TOO_LARGE');
  }

  if (ext === 'png') {
    const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    if (buffer.length < 8 || !buffer.subarray(0, 8).equals(sig)) {
      throw new HttpError(400, 'Invalid PNG file signature', 'INVALID_FILE_MAGIC');
    }
  } else if (ext === 'jpg' || ext === 'jpeg') {
    if (buffer.length < 3 || buffer[0] !== 0xff || buffer[1] !== 0xd8 || buffer[2] !== 0xff) {
      throw new HttpError(400, 'Invalid JPEG file signature', 'INVALID_FILE_MAGIC');
    }
  } else if (ext === 'pdf') {
    if (!buffer.subarray(0, 5).equals(Buffer.from('%PDF-'))) {
      throw new HttpError(400, 'Invalid PDF file signature', 'INVALID_FILE_MAGIC');
    }
  } else if (ext === 'webp') {
    if (
      buffer.length < 12 ||
      !buffer.subarray(0, 4).equals(Buffer.from('RIFF')) ||
      !buffer.subarray(8, 12).equals(Buffer.from('WEBP'))
    ) {
      throw new HttpError(400, 'Invalid WEBP file signature', 'INVALID_FILE_MAGIC');
    }
  } else if (ext === 'svg') {
    const fullSvg = buffer.toString('utf8');
    const lowerSvg = fullSvg.toLowerCase();
    if (!lowerSvg.includes('<svg')) {
      throw new HttpError(400, 'Invalid SVG file content', 'INVALID_FILE_MAGIC');
    }
    const unsafeSvgPattern =
      /<script\b|<\/script\b|\bon[a-z]+\s*=|javascript:|vbscript:|data:text\/html|<foreignobject\b|<iframe\b|<object\b|<embed\b/i;
    if (unsafeSvgPattern.test(fullSvg)) {
      throw new HttpError(400, 'SVG contains disallowed active or script content', 'UNSAFE_SVG');
    }
  }
}

function sha256Hex(content: string | Buffer): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function formatDefaultSnapshotMessage(displayName: string, now: Date): string {
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(now.getUTCDate()).padStart(2, '0');
  const hh = String(now.getUTCHours()).padStart(2, '0');
  const min = String(now.getUTCMinutes()).padStart(2, '0');
  return `Update ${displayName} — ${yyyy}-${mm}-${dd} ${hh}:${min}`;
}

function computeLineDiff(relativePath: string, currentText: string | undefined, targetText: string | undefined): FileDiffSummary {
  if (currentText === undefined && targetText === undefined) {
    return { relativePath, status: 'unchanged', additions: 0, deletions: 0, unifiedDiff: '' };
  }
  if (currentText === undefined && targetText !== undefined) {
    const lines = targetText.split('\n');
    return {
      relativePath,
      status: 'added',
      additions: lines.length,
      deletions: 0,
      unifiedDiff: lines.map((l) => `+ ${l}`).join('\n'),
    };
  }
  if (currentText !== undefined && targetText === undefined) {
    const lines = currentText.split('\n');
    return {
      relativePath,
      status: 'deleted',
      additions: 0,
      deletions: lines.length,
      unifiedDiff: lines.map((l) => `- ${l}`).join('\n'),
    };
  }
  if (currentText === targetText) {
    return { relativePath, status: 'unchanged', additions: 0, deletions: 0, unifiedDiff: '' };
  }

  const a = (currentText ?? '').split('\n');
  const b = (targetText ?? '').split('\n');
  const diffLines: string[] = [`--- current/${relativePath}`, `+++ snapshot/${relativePath}`];
  let additions = 0;
  let deletions = 0;
  const maxLen = Math.max(a.length, b.length);
  for (let i = 0; i < maxLen; i += 1) {
    if (a[i] === b[i]) continue;
    if (a[i] !== undefined) {
      diffLines.push(`- ${a[i]}`);
      deletions += 1;
    }
    if (b[i] !== undefined) {
      diffLines.push(`+ ${b[i]}`);
      additions += 1;
    }
  }
  return {
    relativePath,
    status: 'modified',
    additions,
    deletions,
    unifiedDiff: diffLines.join('\n'),
  };
}

function figureContentType(ext: string): string {
  switch (ext) {
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'pdf':
      return 'application/pdf';
    case 'svg':
      return 'image/svg+xml';
    case 'webp':
      return 'image/webp';
    default:
      return 'application/octet-stream';
  }
}

export class ProjectService {
  private readonly storage: StorageProvider;

  constructor(storage: StorageProvider) {
    this.storage = storage;
  }

  private userPrefix(userId: string): string {
    return `users/${userId}`;
  }

  private workspaceKey(userId: string): string {
    return `${this.userPrefix(userId)}/workspace.json`;
  }

  private projectPrefix(userId: string, slug: string): string {
    return `${this.userPrefix(userId)}/projects/${slug}`;
  }

  private projectDescriptorKey(userId: string, slug: string): string {
    return `${this.projectPrefix(userId, slug)}/project.json`;
  }

  private snapshotIndexKey(userId: string, slug: string): string {
    return `${this.projectPrefix(userId, slug)}/.snapshots/index.json`;
  }

  async getStorageStatus(userId: string): Promise<StorageStatusInfo> {
    const check = await this.storage.checkConnection();
    return {
      storageDriver: this.storage.driver,
      bucketName: this.storage.bucketName,
      endpointRegion: this.storage.endpointRegion,
      userPrefix: `${this.userPrefix(userId)}/projects/`,
      connected: check.connected,
      latencyMs: check.latencyMs,
      errorMessage: check.errorMessage,
    };
  }

  private async readWorkspace(userId: string): Promise<UserWorkspaceManifest> {
    const obj = await this.storage.getObject(this.workspaceKey(userId));
    if (!obj) {
      return {
        schemaVersion: 1,
        userId,
        activeProjectSlug: null,
        updatedAt: new Date().toISOString(),
      };
    }
    return JSON.parse(obj.body.toString('utf8')) as UserWorkspaceManifest;
  }

  private async writeWorkspace(manifest: UserWorkspaceManifest): Promise<void> {
    manifest.updatedAt = new Date().toISOString();
    await this.storage.putObject(
      this.workspaceKey(manifest.userId),
      JSON.stringify(manifest, null, 2),
      'application/json'
    );
  }

  private async readProjectDescriptor(userId: string, slug: string): Promise<AcademicProjectDescriptor> {
    const validSlug = validateSlug(slug);
    const obj = await this.storage.getObject(this.projectDescriptorKey(userId, validSlug));
    if (!obj) {
      throw new HttpError(404, `Project '${validSlug}' not found`, 'PROJECT_NOT_FOUND');
    }
    return JSON.parse(obj.body.toString('utf8')) as AcademicProjectDescriptor;
  }

  private async readSnapshotIndex(userId: string, slug: string): Promise<SnapshotManifest[]> {
    const obj = await this.storage.getObject(this.snapshotIndexKey(userId, slug));
    if (!obj) return [];
    return JSON.parse(obj.body.toString('utf8')) as SnapshotManifest[];
  }

  private async writeSnapshot(
    userId: string,
    slug: string,
    authorName: string,
    message: string,
    files: Record<string, string>,
    changedFiles: string[],
    parentSnapshotId: string | null
  ): Promise<SnapshotManifest> {
    const snapshotId = `snap_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const createdAt = new Date().toISOString();
    const fileHashes: Record<string, string> = {};
    for (const [relPath, content] of Object.entries(files)) {
      fileHashes[relPath] = sha256Hex(content);
    }

    const manifest: SnapshotManifest = {
      snapshotId,
      parentSnapshotId,
      message,
      authorName,
      createdAt,
      changedFiles,
      fileHashes,
    };

    const snapPrefix = `${this.projectPrefix(userId, slug)}/.snapshots/${snapshotId}`;
    await this.storage.putObject(
      `${snapPrefix}/manifest.json`,
      JSON.stringify(manifest, null, 2),
      'application/json'
    );
    await Promise.all(
      Object.entries(files).map(([relPath, content]) =>
        this.storage.putObject(`${snapPrefix}/files/${relPath}`, content, 'text/plain; charset=utf-8')
      )
    );

    const index = await this.readSnapshotIndex(userId, slug);
    const updatedIndex = [manifest, ...index];
    await this.storage.putObject(
      this.snapshotIndexKey(userId, slug),
      JSON.stringify(updatedIndex, null, 2),
      'application/json'
    );

    return manifest;
  }

  private async loadWorkingTextFiles(userId: string, slug: string): Promise<Record<string, string>> {
    const prefix = `${this.projectPrefix(userId, slug)}/`;
    const entries = await this.storage.listObjects(prefix);
    const files: Record<string, string> = {};

    await Promise.all(
      entries.map(async (entry) => {
        const rel = entry.key.slice(prefix.length);
        if (
          !rel ||
          rel === 'project.json' ||
          rel.startsWith('.snapshots/') ||
          rel.startsWith('figures/')
        ) {
          return;
        }
        const obj = await this.storage.getObject(entry.key);
        if (obj) {
          files[rel] = obj.body.toString('utf8');
        }
      })
    );

    return files;
  }

  private async listBinaryAssets(userId: string, slug: string): Promise<ProjectBinaryAsset[]> {
    const prefix = `${this.projectPrefix(userId, slug)}/figures/`;
    const entries = await this.storage.listObjects(prefix);
    const projPrefix = `${this.projectPrefix(userId, slug)}/`;
    const assets: ProjectBinaryAsset[] = [];

    for (const entry of entries) {
      const rel = entry.key.slice(projPrefix.length);
      const ext = rel.split('.').pop()?.toLowerCase() || 'png';
      assets.push({
        relativePath: rel,
        sizeBytes: entry.sizeBytes,
        contentType: figureContentType(ext),
        sha256: entry.etag ?? '',
        updatedAt: entry.updatedAt,
        url: `/api/projects/${encodeURIComponent(slug)}/assets/${rel}`,
      });
    }
    return assets;
  }

  async listProjects(userId: string): Promise<{
    workspace: UserWorkspaceManifest;
    projects: AcademicProjectDescriptor[];
  }> {
    const workspace = await this.readWorkspace(userId);
    const prefix = `${this.userPrefix(userId)}/projects/`;
    const entries = await this.storage.listObjects(prefix);
    const descriptorKeys = entries
      .map((e) => e.key)
      .filter((k) => {
        const rest = k.slice(prefix.length);
        return /^[^/]+\/project\.json$/.test(rest);
      });

    const projects: AcademicProjectDescriptor[] = [];
    for (const key of descriptorKeys) {
      const obj = await this.storage.getObject(key);
      if (obj) {
        projects.push(JSON.parse(obj.body.toString('utf8')) as AcademicProjectDescriptor);
      }
    }
    projects.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return { workspace, projects };
  }

  async createProject(
    userId: string,
    authorName: string,
    input: CreateProjectInput,
    extraTextFiles?: Record<string, string>
  ): Promise<{ project: AcademicProjectDescriptor; files: Record<string, string> }> {
    const displayName = (input.displayName || '').trim();
    if (!displayName) {
      throw new HttpError(400, 'Project display name is required', 'INVALID_DISPLAY_NAME');
    }

    let slug = input.slug ? validateSlug(input.slug) : slugifyDisplayName(displayName);
    const existing = await this.storage.headObject(this.projectDescriptorKey(userId, slug));
    if (existing) {
      if (input.slug) {
        throw new HttpError(409, `Project slug '${slug}' already exists`, 'SLUG_EXISTS');
      }
      slug = validateSlug(`${slug.slice(0, 50)}-${crypto.randomBytes(3).toString('hex')}`);
    }

    const now = new Date().toISOString();
    const files: Record<string, string> = {
      'main.tex': input.mainTexContent ?? DEFAULT_MAIN_TEX,
      'references.bib': input.bibContent ?? '',
    };
    if (extraTextFiles) {
      for (const [relPath, content] of Object.entries(extraTextFiles)) {
        if (relPath === 'main.tex' || relPath === 'references.bib') continue;
        const safePath = validateRelativeProjectPath(relPath, { allowFigures: false, allowText: true });
        files[safePath] = content;
      }
    }

    const descriptor: AcademicProjectDescriptor = {
      id: crypto.randomUUID(),
      slug,
      displayName: displayName.slice(0, 120),
      mainTexFile: 'main.tex',
      bibFile: 'references.bib',
      templateId: input.templateId || 'blank-latex3',
      version: 1,
      rubricTargets: input.rubricTargets ?? { ...DEFAULT_RUBRIC },
      createdAt: now,
      updatedAt: now,
      lastSnapshotId: null,
      lastSnapshotAt: null,
    };

    const prefix = this.projectPrefix(userId, slug);
    await Promise.all(
      Object.entries(files).map(([relPath, content]) =>
        this.storage.putObject(`${prefix}/${relPath}`, content, 'text/plain; charset=utf-8')
      )
    );

    const snapshot = await this.writeSnapshot(
      userId,
      slug,
      authorName,
      `Create ${descriptor.displayName}`,
      files,
      Object.keys(files).sort(),
      null
    );
    descriptor.lastSnapshotId = snapshot.snapshotId;
    descriptor.lastSnapshotAt = snapshot.createdAt;

    await this.storage.putObject(
      this.projectDescriptorKey(userId, slug),
      JSON.stringify(descriptor, null, 2),
      'application/json'
    );

    const workspace = await this.readWorkspace(userId);
    workspace.activeProjectSlug = slug;
    await this.writeWorkspace(workspace);

    return { project: descriptor, files };
  }

  async getProject(
    userId: string,
    slug: string
  ): Promise<{
    project: AcademicProjectDescriptor;
    files: Record<string, string>;
    binaryAssets: ProjectBinaryAsset[];
  }> {
    const project = await this.readProjectDescriptor(userId, slug);
    const [files, binaryAssets, workspace] = await Promise.all([
      this.loadWorkingTextFiles(userId, project.slug),
      this.listBinaryAssets(userId, project.slug),
      this.readWorkspace(userId),
    ]);
    if (workspace.activeProjectSlug !== project.slug) {
      workspace.activeProjectSlug = project.slug;
      await this.writeWorkspace(workspace);
    }
    return { project, files, binaryAssets };
  }

  async renameProject(
    userId: string,
    slug: string,
    displayName: string
  ): Promise<AcademicProjectDescriptor> {
    const clean = (displayName || '').trim();
    if (!clean) {
      throw new HttpError(400, 'Display name cannot be empty', 'INVALID_DISPLAY_NAME');
    }
    const project = await this.readProjectDescriptor(userId, slug);
    project.displayName = clean.slice(0, 120);
    project.updatedAt = new Date().toISOString();
    await this.storage.putObject(
      this.projectDescriptorKey(userId, project.slug),
      JSON.stringify(project, null, 2),
      'application/json'
    );
    return project;
  }

  async duplicateProject(
    userId: string,
    sourceSlug: string,
    authorName: string,
    displayName: string,
    requestedSlug?: string
  ): Promise<{ project: AcademicProjectDescriptor; files: Record<string, string> }> {
    const source = await this.getProject(userId, sourceSlug);
    const extraFiles: Record<string, string> = {};
    for (const [relPath, content] of Object.entries(source.files)) {
      if (relPath !== 'main.tex' && relPath !== 'references.bib') {
        extraFiles[relPath] = content;
      }
    }

    const created = await this.createProject(
      userId,
      authorName,
      {
        displayName,
        slug: requestedSlug,
        templateId: source.project.templateId,
        mainTexContent: source.files['main.tex'] ?? DEFAULT_MAIN_TEX,
        bibContent: source.files['references.bib'] ?? '',
        rubricTargets: source.project.rubricTargets,
      },
      extraFiles
    );

    const targetPrefix = this.projectPrefix(userId, created.project.slug);
    for (const asset of source.binaryAssets) {
      const obj = await this.storage.getObject(`${this.projectPrefix(userId, sourceSlug)}/${asset.relativePath}`);
      if (obj) {
        await this.storage.putObject(`${targetPrefix}/${asset.relativePath}`, obj.body, asset.contentType);
      }
    }

    return created;
  }

  async deleteProject(userId: string, slug: string): Promise<void> {
    const validSlug = validateSlug(slug);
    await this.readProjectDescriptor(userId, validSlug);
    await this.storage.deletePrefix(`${this.projectPrefix(userId, validSlug)}/`);
    const workspace = await this.readWorkspace(userId);
    if (workspace.activeProjectSlug === validSlug) {
      workspace.activeProjectSlug = null;
      await this.writeWorkspace(workspace);
    }
  }

  async saveProject(
    userId: string,
    authorName: string,
    slug: string,
    req: SaveProjectRequest
  ): Promise<SaveProjectResponse> {
    const project = await this.readProjectDescriptor(userId, slug);
    if (!req.files || typeof req.files !== 'object') {
      throw new HttpError(400, 'Request must include files map', 'INVALID_PAYLOAD');
    }

    const incomingFiles: Record<string, string> = {};
    for (const [rawPath, content] of Object.entries(req.files)) {
      const safePath = validateRelativeProjectPath(rawPath, { allowFigures: false, allowText: true });
      if (typeof content !== 'string') {
        throw new HttpError(400, `File content for ${safePath} must be a string`, 'INVALID_FILE_CONTENT');
      }
      incomingFiles[safePath] = content;
    }

    const currentFiles = await this.loadWorkingTextFiles(userId, project.slug);

    // Check optimistic concurrency
    if (!req.forceOverwrite && project.version !== req.expectedVersion) {
      const allPaths = new Set([...Object.keys(currentFiles), ...Object.keys(incomingFiles)]);
      const conflictFiles: string[] = [];
      for (const p of allPaths) {
        if (currentFiles[p] !== incomingFiles[p]) {
          conflictFiles.push(p);
        }
      }
      const conflictPayload: ProjectConflictInfo = {
        slug: project.slug,
        expectedVersion: req.expectedVersion,
        serverVersion: project.version,
        serverFiles: currentFiles,
        conflictFiles,
      };
      throw new HttpError(409, 'Project version conflict', 'PROJECT_CONFLICT', conflictPayload);
    }

    // Check for no-op saves
    const changedFiles: string[] = [];
    const allPaths = new Set([...Object.keys(currentFiles), ...Object.keys(incomingFiles)]);
    for (const p of allPaths) {
      if (currentFiles[p] !== incomingFiles[p]) {
        changedFiles.push(p);
      }
    }

    if (changedFiles.length === 0) {
      return {
        project,
        snapshot: null,
        skippedNoChanges: true,
      };
    }

    const prefix = this.projectPrefix(userId, project.slug);
    for (const [relPath, content] of Object.entries(incomingFiles)) {
      await this.storage.putObject(`${prefix}/${relPath}`, content, 'text/plain; charset=utf-8');
    }
    for (const oldPath of Object.keys(currentFiles)) {
      if (!(oldPath in incomingFiles)) {
        await this.storage.deleteObject(`${prefix}/${oldPath}`);
      }
    }

    const now = new Date();
    const message = req.message?.trim() || formatDefaultSnapshotMessage(project.displayName, now);
    const snapshot = await this.writeSnapshot(
      userId,
      project.slug,
      authorName,
      message,
      incomingFiles,
      changedFiles.sort(),
      project.lastSnapshotId ?? null
    );

    project.version += 1;
    project.updatedAt = now.toISOString();
    project.lastSnapshotId = snapshot.snapshotId;
    project.lastSnapshotAt = snapshot.createdAt;
    await this.storage.putObject(
      this.projectDescriptorKey(userId, project.slug),
      JSON.stringify(project, null, 2),
      'application/json'
    );

    return {
      project,
      snapshot,
      skippedNoChanges: false,
    };
  }

  async uploadAsset(
    userId: string,
    slug: string,
    originalName: string,
    buffer: Buffer
  ): Promise<{ relativePath: string; sizeBytes: number; contentType: string; url: string }> {
    const project = await this.readProjectDescriptor(userId, slug);
    const safeName = sanitizeFigureFileName(originalName);
    const relativePath = validateRelativeProjectPath(`figures/${safeName}`, {
      allowFigures: true,
      allowText: false,
    });
    const ext = relativePath.split('.').pop()!.toLowerCase();
    validateImageMagicBytes(buffer, ext);

    const contentType = figureContentType(ext);
    const key = `${this.projectPrefix(userId, project.slug)}/${relativePath}`;
    await this.storage.putObject(key, buffer, contentType);

    return {
      relativePath,
      sizeBytes: buffer.length,
      contentType,
      url: `/api/projects/${encodeURIComponent(project.slug)}/assets/${relativePath}`,
    };
  }

  async getAsset(
    userId: string,
    slug: string,
    relativePath: string
  ): Promise<{ body: Buffer; contentType: string }> {
    const project = await this.readProjectDescriptor(userId, slug);
    const safePath = validateRelativeProjectPath(relativePath, {
      allowFigures: true,
      allowText: false,
    });
    const obj = await this.storage.getObject(`${this.projectPrefix(userId, project.slug)}/${safePath}`);
    if (!obj) {
      throw new HttpError(404, `Asset '${safePath}' not found`, 'ASSET_NOT_FOUND');
    }
    const ext = safePath.split('.').pop()?.toLowerCase() || 'png';
    return {
      body: obj.body,
      contentType: obj.contentType || figureContentType(ext),
    };
  }

  async deleteAsset(userId: string, slug: string, relativePath: string): Promise<void> {
    const project = await this.readProjectDescriptor(userId, slug);
    const safePath = validateRelativeProjectPath(relativePath, {
      allowFigures: true,
      allowText: false,
    });
    await this.storage.deleteObject(`${this.projectPrefix(userId, project.slug)}/${safePath}`);
  }

  async listSnapshots(userId: string, slug: string): Promise<SnapshotManifest[]> {
    const project = await this.readProjectDescriptor(userId, slug);
    return this.readSnapshotIndex(userId, project.slug);
  }

  async getSnapshotDetail(
    userId: string,
    slug: string,
    snapshotId: string
  ): Promise<SnapshotDetail> {
    const project = await this.readProjectDescriptor(userId, slug);
    if (!/^snap_[a-zA-Z0-9_-]+$/.test(snapshotId)) {
      throw new HttpError(400, 'Invalid snapshot ID', 'INVALID_SNAPSHOT_ID');
    }

    const snapPrefix = `${this.projectPrefix(userId, project.slug)}/.snapshots/${snapshotId}`;
    const manifestObj = await this.storage.getObject(`${snapPrefix}/manifest.json`);
    if (!manifestObj) {
      throw new HttpError(404, `Snapshot '${snapshotId}' not found`, 'SNAPSHOT_NOT_FOUND');
    }
    const snapshot = JSON.parse(manifestObj.body.toString('utf8')) as SnapshotManifest;

    const filesPrefix = `${snapPrefix}/files/`;
    const entries = await this.storage.listObjects(filesPrefix);
    const snapshotFiles: Record<string, string> = {};
    for (const entry of entries) {
      const rel = entry.key.slice(filesPrefix.length);
      const obj = await this.storage.getObject(entry.key);
      if (obj) {
        snapshotFiles[rel] = obj.body.toString('utf8');
      }
    }

    const currentFiles = await this.loadWorkingTextFiles(userId, project.slug);
    const allPaths = Array.from(
      new Set([...Object.keys(currentFiles), ...Object.keys(snapshotFiles)])
    ).sort();
    const diffs = allPaths.map((p) => computeLineDiff(p, currentFiles[p], snapshotFiles[p]));

    return {
      snapshot,
      files: snapshotFiles,
      diffs,
    };
  }

  async restoreSnapshot(
    userId: string,
    authorName: string,
    slug: string,
    snapshotId: string
  ): Promise<{
    project: AcademicProjectDescriptor;
    snapshot: SnapshotManifest;
    files: Record<string, string>;
  }> {
    const detail = await this.getSnapshotDetail(userId, slug, snapshotId);
    const project = await this.readProjectDescriptor(userId, slug);
    const currentFiles = await this.loadWorkingTextFiles(userId, project.slug);
    const prefix = this.projectPrefix(userId, project.slug);

    for (const [relPath, content] of Object.entries(detail.files)) {
      await this.storage.putObject(`${prefix}/${relPath}`, content, 'text/plain; charset=utf-8');
    }
    for (const oldPath of Object.keys(currentFiles)) {
      if (!(oldPath in detail.files)) {
        await this.storage.deleteObject(`${prefix}/${oldPath}`);
      }
    }

    const shortId = snapshotId.slice(-6);
    const restoredSnapshot = await this.writeSnapshot(
      userId,
      project.slug,
      authorName,
      `Restore "${project.displayName}" to ${shortId}`,
      detail.files,
      Object.keys(detail.files).sort(),
      project.lastSnapshotId ?? null
    );

    project.version += 1;
    project.updatedAt = new Date().toISOString();
    project.lastSnapshotId = restoredSnapshot.snapshotId;
    project.lastSnapshotAt = restoredSnapshot.createdAt;
    await this.storage.putObject(
      this.projectDescriptorKey(userId, project.slug),
      JSON.stringify(project, null, 2),
      'application/json'
    );

    return {
      project,
      snapshot: restoredSnapshot,
      files: detail.files,
    };
  }

  async updateRubricTargets(
    userId: string,
    slug: string,
    rubric: RubricTargetConfig
  ): Promise<AcademicProjectDescriptor> {
    const project = await this.readProjectDescriptor(userId, slug);
    project.rubricTargets = {
      targetProseWords:
        typeof rubric.targetProseWords === 'number' && rubric.targetProseWords > 0
          ? Math.round(rubric.targetProseWords)
          : null,
      maxPageCount:
        typeof rubric.maxPageCount === 'number' && rubric.maxPageCount > 0
          ? Math.round(rubric.maxPageCount)
          : null,
      maxAbstractWords:
        typeof rubric.maxAbstractWords === 'number' && rubric.maxAbstractWords > 0
          ? Math.round(rubric.maxAbstractWords)
          : null,
      studentModeHideExpl3: Boolean(rubric.studentModeHideExpl3),
    };
    project.updatedAt = new Date().toISOString();
    await this.storage.putObject(
      this.projectDescriptorKey(userId, project.slug),
      JSON.stringify(project, null, 2),
      'application/json'
    );
    return project;
  }
}
