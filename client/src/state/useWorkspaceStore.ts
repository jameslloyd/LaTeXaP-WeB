import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type {
  AcademicDocumentStats,
  AcademicFixOperation,
  AcademicPreflightReport,
  AcademicProjectDescriptor,
  AuthConfig,
  AuthUser,
  BibEntry,
  BibliographyStylePreset,
  CitationCommandStyle,
  CompilationState,
  ConflictResolutionChoice,
  ContextAdviceItem,
  CreateProjectInput,
  CustomFontRecord,
  DemystifiedDiagnostic,
  DocumentOutlineItem,
  EditorInsertionRequest,
  FigureInsertConfig,
  LaTeXDiagnostic,
  LaTeXFontRole,
  PaperSetupConfig,
  PGFPlotChartConfig,
  ProjectBinaryAsset,
  ProjectConflictInfo,
  ProjectSyncState,
  RubricTargetConfig,
  SnapshotDetail,
  SnapshotManifest,
  SpellingIssue,
  StorageStatusInfo,
  SubmissionExportResult,
  SyncTeXBox,
  SyncTeXData,
  TableGridData,
} from '@shared/types/index.js';
import { compilerClient } from '../engine/compilerClient.js';
import { parseSyncTeX } from '../engine/synctexParser.js';
import { runAcademicPreflight } from '../services/academicPreflight.js';
import {
  generateFigureSnippet,
  generatePGFPlotChart,
  generateBooktabsTable,
} from '../services/academicToolsGenerator.js';
import { ApiHttpError, apiClient, ProjectConflictError } from '../services/apiClient.js';
import { formatCitationCommand, parseBibTeX } from '../services/bibliographyParser.js';
import { analyzeContext, demystifyDiagnostics } from '../services/contextSuggestions.js';
import { computeAcademicStatistics, lintExpl3 } from '../services/expl3Linter.js';
import { generatePaperSetupDocument, LATEX_TEMPLATES } from '../services/latexCatalog.js';
import { parseDocumentOutline } from '../services/outlineParser.js';
import { checkProseSpelling } from '../services/spellCheckService.js';
import { buildSubmissionZipBundle } from '../services/submissionExport.js';

export interface WorkspaceStore {
  // Auth & Environment
  authConfig: AuthConfig | null;
  currentUser: AuthUser | null;
  authLoading: boolean;
  authError: string | null;
  loginWithGoogleToken(idToken: string): Promise<void>;
  loginWithDevPersona(email: string, name?: string): Promise<void>;
  logout(): Promise<void>;

  // Multi-Project B2 Workspace & Snapshots
  projects: AcademicProjectDescriptor[];
  activeProject: AcademicProjectDescriptor | null;
  projectFiles: Record<string, string>;
  binaryAssets: ProjectBinaryAsset[];
  storageStatus: StorageStatusInfo | null;
  isDirty: boolean;
  syncState: ProjectSyncState;
  conflictInfo: ProjectConflictInfo | null;
  snapshots: SnapshotManifest[];
  loadProjects(): Promise<void>;
  testStorageConnection(): Promise<StorageStatusInfo>;
  createProject(input: CreateProjectInput): Promise<void>;
  renameProject(slug: string, displayName: string): Promise<void>;
  duplicateProject(slug: string, displayName: string): Promise<void>;
  switchProject(slug: string): Promise<void>;
  deleteProject(slug: string): Promise<void>;
  saveProject(customMessage?: string): Promise<void>;
  resolveConflict(choice: ConflictResolutionChoice): Promise<void>;
  loadSnapshots(): Promise<void>;
  previewSnapshot(snapshotId: string): Promise<SnapshotDetail>;
  restoreSnapshot(snapshotId: string): Promise<void>;

  // Editor & Compilation State
  activeFilePath: string;
  sourceText: string;
  managedBibContent: string;
  cursorLine: number;
  autoCompileEnabled: boolean;
  editorTheme: 'light' | 'dark';
  editorFontFamily: string;
  editorFontSize: number;
  compilationState: CompilationState;
  pdfBytes: Uint8Array | null;
  synctexData: SyncTeXData | null;
  texLogText: string;
  diagnostics: LaTeXDiagnostic[];
  demystifiedDiagnostics: DemystifiedDiagnostic[];
  outlineItems: DocumentOutlineItem[];
  contextAdvice: { contextBadge: string; items: ContextAdviceItem[] };
  pendingInsertion: EditorInsertionRequest | null;
  pendingJumpToLine: { line: number; nonce: number } | null;
  forwardSyncBox: { box: SyncTeXBox; nonce: number } | null;

  setSourceText(text: string): void;
  setManagedBibContent(bib: string): void;
  setActiveFilePath(path: string): void;
  setCursorLine(line: number): void;
  setAutoCompileEnabled(enabled: boolean): void;
  setEditorTheme(theme: 'light' | 'dark'): void;
  setEditorTypography(family: string, size: number): void;
  compileNow(): Promise<void>;
  triggerForwardSync(line?: number): void;
  triggerBackwardSync(page: number, xPt: number, yTopPt: number): void;
  jumpToSourceLine(line: number): void;
  insertTextAtCaret(text: string, backtrackOffset?: number): void;
  consumePendingInsertion(): void;
  insertPackage(packageName: string, options?: string): void;

  // Academic Suite, Citations, Spellcheck & Export
  bibEntries: BibEntry[];
  bibSearchResults: BibEntry[];
  isSearchingCitations: boolean;
  selectedCitationStyle: CitationCommandStyle;
  selectedBibliographyStyle: BibliographyStylePreset;
  academicStats: AcademicDocumentStats;
  rubricTargets: RubricTargetConfig;
  preflightReport: AcademicPreflightReport;
  proseSpellCheckEnabled: boolean;
  spellingIssues: SpellingIssue[];

  searchCitations(query: string): Promise<void>;
  lookupCitationByIdentifier(identifier: string): Promise<void>;
  importBibEntry(entry: BibEntry): void;
  importBibFile(file: File): Promise<void>;
  insertFormattedCitation(entry: BibEntry, style: CitationCommandStyle, pageLocator?: string): void;
  applyBibliographyStyle(style: BibliographyStylePreset): void;
  applyPaperSetupWizard(config: PaperSetupConfig): Promise<void>;
  applyTemplate(templateId: string): void;
  applyAcademicFix(op: AcademicFixOperation): void;
  updateRubricTargets(targets: RubricTargetConfig): Promise<void>;
  toggleProseSpellCheck(enabled: boolean): void;
  applySpellingSuggestion(issue: SpellingIssue, replacement: string): void;
  ignoreSpellingWord(word: string): void;
  uploadAndInsertFigure(primaryFile: File, secondaryFile: File | null, config: FigureInsertConfig): Promise<void>;
  insertSpreadsheetTable(grid: TableGridData): void;
  insertPGFPlotChart(chart: PGFPlotChartConfig): void;
  exportCompiledPDF(): void;
  exportSubmissionZip(options?: { stripComments?: boolean; anonymize?: boolean }): Promise<SubmissionExportResult>;

  // Custom Fonts
  customFonts: CustomFontRecord[];
  uploadCustomFont(file: File, displayName?: string): Promise<CustomFontRecord>;
  renameCustomFont(fontId: string, displayName: string): Promise<void>;
  deleteCustomFont(fontId: string): Promise<void>;
  applyFontToDocument(fontNameOrFile: string, role: LaTeXFontRole, customCommandName?: string): void;
}

const DEFAULT_RUBRIC: RubricTargetConfig = {
  targetProseWords: null,
  maxPageCount: null,
  maxAbstractWords: null,
  studentModeHideExpl3: false,
};

const DEFAULT_SAMPLE_TEX = LATEX_TEMPLATES[0].source;

function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function triggerBrowserDownload(blob: Blob, fileName: string): void {
  if (typeof document === 'undefined' || typeof URL === 'undefined') return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

const WorkspaceContext = createContext<WorkspaceStore | null>(null);

export function WorkspaceProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  // Auth
  const [authConfig, setAuthConfig] = useState<AuthConfig | null>(null);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);

  // Projects & Storage
  const [projects, setProjects] = useState<AcademicProjectDescriptor[]>([]);
  const [activeProject, setActiveProject] = useState<AcademicProjectDescriptor | null>(null);
  const [projectFiles, setProjectFiles] = useState<Record<string, string>>({
    'main.tex': DEFAULT_SAMPLE_TEX,
    'references.bib': '',
  });
  const [binaryAssets, setBinaryAssets] = useState<ProjectBinaryAsset[]>([]);
  const [storageStatus, setStorageStatus] = useState<StorageStatusInfo | null>(null);
  const [isDirty, setIsDirty] = useState<boolean>(false);
  const [syncState, setSyncState] = useState<ProjectSyncState>('idle');
  const [conflictInfo, setConflictInfo] = useState<ProjectConflictInfo | null>(null);
  const [snapshots, setSnapshots] = useState<SnapshotManifest[]>([]);

  // Editor & Compilation
  const [activeFilePath, setActiveFilePathState] = useState<string>('main.tex');
  const [cursorLine, setCursorLine] = useState<number>(1);
  const [autoCompileEnabled, setAutoCompileEnabled] = useState<boolean>(true);
  const [editorTheme, setEditorTheme] = useState<'light' | 'dark'>('light');
  const [editorFontFamily, setEditorFontFamily] = useState<string>('JetBrains Mono');
  const [editorFontSize, setEditorFontSize] = useState<number>(14);
  const [compilationState, setCompilationState] = useState<CompilationState>({ status: 'idle' });
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [synctexData, setSynctexData] = useState<SyncTeXData | null>(null);
  const [texLogText, setTexLogText] = useState<string>('');
  const [compilerDiagnostics, setCompilerDiagnostics] = useState<LaTeXDiagnostic[]>([]);
  const [pageCount, setPageCount] = useState<number>(0);
  const [pendingInsertion, setPendingInsertion] = useState<EditorInsertionRequest | null>(null);
  const [pendingJumpToLine, setPendingJumpToLine] = useState<{ line: number; nonce: number } | null>(null);
  const [forwardSyncBox, setForwardSyncBox] = useState<{ box: SyncTeXBox; nonce: number } | null>(null);

  // Academic Suite & Fonts
  const [bibSearchResults, setBibSearchResults] = useState<BibEntry[]>([]);
  const [isSearchingCitations, setIsSearchingCitations] = useState<boolean>(false);
  const [selectedCitationStyle, setSelectedCitationStyle] = useState<CitationCommandStyle>('cite');
  const [selectedBibliographyStyle, setSelectedBibliographyStyle] = useState<BibliographyStylePreset>('apa');
  const [rubricTargets, setRubricTargets] = useState<RubricTargetConfig>(DEFAULT_RUBRIC);
  const [proseSpellCheckEnabled, setProseSpellCheckEnabled] = useState<boolean>(false);
  const [ignoredWordsVersion, setIgnoredWordsVersion] = useState<number>(0);
  const [customFonts, setCustomFonts] = useState<CustomFontRecord[]>([]);

  const nonceRef = useRef<number>(0);
  const ignoredWordsRef = useRef<Set<string>>(new Set());
  const binaryCacheRef = useRef<Record<string, Uint8Array>>({});
  const fontCacheRef = useRef<Record<string, Uint8Array>>({});

  const mainTexContent = projectFiles['main.tex'] ?? '';
  const sourceText = projectFiles[activeFilePath] ?? mainTexContent;
  const managedBibContent =
    projectFiles[activeProject?.bibFile ?? 'references.bib'] ?? projectFiles['references.bib'] ?? '';

  const nextNonce = () => {
    nonceRef.current += 1;
    return nonceRef.current;
  };

  const surfaceSessionExpiryIf401 = useCallback((err: unknown) => {
    if (err instanceof ApiHttpError && err.status === 401) {
      setAuthError(
        'Your Google session expired. Typing & local preview continue working. Sign in again to resume Backblaze B2 sync.'
      );
    }
  }, []);

  const withAuthGuard = useCallback(
    async <T,>(fn: () => Promise<T>): Promise<T> => {
      try {
        return await fn();
      } catch (err) {
        surfaceSessionExpiryIf401(err);
        throw err;
      }
    },
    [surfaceSessionExpiryIf401]
  );

  // Derived academic & diagnostic models
  const bibEntries = useMemo(() => parseBibTeX(managedBibContent), [managedBibContent]);
  const outlineItems = useMemo(() => parseDocumentOutline(mainTexContent), [mainTexContent]);
  const expl3Diagnostics = useMemo(
    () => lintExpl3(mainTexContent, rubricTargets.studentModeHideExpl3),
    [mainTexContent, rubricTargets.studentModeHideExpl3]
  );

  const diagnostics = useMemo(() => {
    const seen = new Set<string>();
    const combined: LaTeXDiagnostic[] = [];
    for (const d of [...compilerDiagnostics, ...expl3Diagnostics]) {
      const key = `${d.line ?? 0}:${d.severity}:${d.message}`;
      if (!seen.has(key)) {
        seen.add(key);
        combined.push(d);
      }
    }
    return combined;
  }, [compilerDiagnostics, expl3Diagnostics]);

  const demystifiedDiagnostics = useMemo(
    () => demystifyDiagnostics(diagnostics, mainTexContent),
    [diagnostics, mainTexContent]
  );

  const contextAdvice = useMemo(
    () => analyzeContext(sourceText, cursorLine, rubricTargets.studentModeHideExpl3),
    [sourceText, cursorLine, rubricTargets.studentModeHideExpl3]
  );

  const academicStats = useMemo(
    () => computeAcademicStatistics(mainTexContent, managedBibContent, pageCount),
    [mainTexContent, managedBibContent, pageCount]
  );

  const preflightReport = useMemo(
    () =>
      runAcademicPreflight(
        mainTexContent,
        bibEntries,
        diagnostics,
        binaryAssets.map((a) => a.relativePath)
      ),
    [mainTexContent, bibEntries, diagnostics, binaryAssets]
  );

  const spellingIssues = useMemo(() => {
    if (!proseSpellCheckEnabled) return [];
    void ignoredWordsVersion;
    const extraWords = new Set<string>();
    for (const entry of bibEntries) {
      for (const a of entry.authors) {
        for (const w of a.split(/\W+/)) {
          if (w.length >= 3) extraWords.add(w.toLowerCase());
        }
      }
    }
    return checkProseSpelling(sourceText, ignoredWordsRef.current, extraWords);
  }, [proseSpellCheckEnabled, sourceText, bibEntries, ignoredWordsVersion]);

  // Register custom fonts in browser FontFace API & cache bytes for VFS
  const hydrateCustomFontBytes = useCallback(async (fonts: CustomFontRecord[]) => {
    await Promise.all(
      fonts.map(async (font) => {
        if (!fontCacheRef.current[font.id]) {
          try {
            const bytes = await apiClient.fetchFontBinary(font.id);
            fontCacheRef.current[font.id] = bytes;
            if (typeof FontFace !== 'undefined' && typeof document !== 'undefined') {
              const face = new FontFace(font.familyName, bytes.slice().buffer);
              await face.load();
              document.fonts.add(face);
            }
          } catch {
            // Non-fatal if font preview fails in headless/test environments
          }
        }
      })
    );
  }, []);

  const hydrateBinaryAssetBytes = useCallback(async (assets: ProjectBinaryAsset[]) => {
    await Promise.all(
      assets.map(async (asset) => {
        if (!binaryCacheRef.current[asset.relativePath]) {
          try {
            binaryCacheRef.current[asset.relativePath] = await apiClient.fetchBinaryAsset(asset.url);
          } catch {
            // Non-fatal
          }
        }
      })
    );
  }, []);

  const compileNow = useCallback(async () => {
    setCompilationState({ status: 'compiling', message: 'Compiling in Browser...' });
    try {
      const stagedFonts = customFonts
        .filter((f) => Boolean(fontCacheRef.current[f.id]))
        .map((f) => ({
          fileName: f.fileName,
          familyName: f.familyName,
          bytes: fontCacheRef.current[f.id],
        }));

      const { output, isStale } = await compilerClient.compile({
        mainTex: mainTexContent,
        bibContent: managedBibContent,
        files: projectFiles,
        binaryAssets: binaryCacheRef.current,
        customFonts: stagedFonts,
      });

      if (isStale) return;

      setTexLogText(output.logText);
      setCompilerDiagnostics(output.diagnostics);
      const parsedSync = parseSyncTeX(output.synctexText);
      setSynctexData(parsedSync);
      setPageCount(output.pageCount);

      const errorCount = output.diagnostics.filter((d) => d.severity === 'Error').length;
      if (output.pdfBytes && output.pdfBytes.byteLength > 0) {
        setPdfBytes(output.pdfBytes);
      }

      if (errorCount > 0) {
        setCompilationState({ status: 'failed', errorCount });
      } else {
        setCompilationState({
          status: 'success',
          durationMs: output.durationMs,
          pageCount: output.pageCount,
        });
      }
    } catch (err) {
      setTexLogText(err instanceof Error ? err.message : 'Compilation failed');
      setCompilationState({ status: 'failed', errorCount: 1 });
    }
  }, [customFonts, mainTexContent, managedBibContent, projectFiles]);

  // Debounced auto-compile (450ms)
  useEffect(() => {
    if (!autoCompileEnabled || !currentUser) return;
    const timer = setTimeout(() => {
      void compileNow();
    }, 450);
    return () => clearTimeout(timer);
  }, [autoCompileEnabled, currentUser, mainTexContent, managedBibContent, projectFiles, compileNow]);

  const setSourceText = useCallback(
    (text: string) => {
      setProjectFiles((prev) => ({
        ...prev,
        [activeFilePath]: text,
      }));
      setIsDirty(true);
    },
    [activeFilePath]
  );

  const setManagedBibContent = useCallback(
    (bib: string) => {
      const bibKey = activeProject?.bibFile ?? 'references.bib';
      setProjectFiles((prev) => ({
        ...prev,
        [bibKey]: bib,
      }));
      setIsDirty(true);
    },
    [activeProject]
  );

  const setActiveFilePath = useCallback((path: string) => {
    setActiveFilePathState(path);
  }, []);

  const setEditorTypography = useCallback((family: string, size: number) => {
    setEditorFontFamily(family);
    setEditorFontSize(Math.min(24, Math.max(10, Math.round(size))));
  }, []);

  const jumpToSourceLine = useCallback((line: number) => {
    const safeLine = Math.max(1, line);
    setCursorLine(safeLine);
    setPendingJumpToLine({ line: safeLine, nonce: nextNonce() });
  }, []);

  const insertTextAtCaret = useCallback((text: string, backtrackOffset = 0) => {
    setPendingInsertion({
      id: createId(),
      text,
      cursorBacktrackOffset: backtrackOffset,
    });
  }, []);

  const consumePendingInsertion = useCallback(() => {
    setPendingInsertion(null);
  }, []);

  const insertPackage = useCallback((packageName: string, options?: string) => {
    const stmt =
      options && options.trim().length > 0
        ? `\\usepackage[${options.trim()}]{${packageName}}`
        : `\\usepackage{${packageName}}`;
    setProjectFiles((prev) => {
      const main = prev['main.tex'] ?? '';
      if (new RegExp(`\\\\usepackage(?:\\[[^\\]]*\\])?\\{[^}]*\\b${packageName}\\b[^}]*\\}`).test(main)) {
        return prev;
      }
      const docBeginIdx = main.indexOf('\\begin{document}');
      const updated =
        docBeginIdx >= 0
          ? `${main.slice(0, docBeginIdx)}${stmt}\n${main.slice(docBeginIdx)}`
          : `${stmt}\n${main}`;
      return { ...prev, 'main.tex': updated };
    });
    setIsDirty(true);
  }, []);

  const loadSnapshots = useCallback(async () => {
    if (!activeProject) return;
    const res = await withAuthGuard(() => apiClient.listSnapshots(activeProject.slug));
    setSnapshots(res.snapshots);
  }, [activeProject, withAuthGuard]);

  const switchProject = useCallback(
    async (slug: string) => {
      const res = await withAuthGuard(() => apiClient.getProject(slug));
      binaryCacheRef.current = {};
      setActiveProject(res.project);
      setProjectFiles(res.files);
      setBinaryAssets(res.binaryAssets);
      setRubricTargets(res.project.rubricTargets ?? DEFAULT_RUBRIC);
      setActiveFilePathState(res.project.mainTexFile || 'main.tex');
      setIsDirty(false);
      setConflictInfo(null);
      setSyncState(storageStatus?.storageDriver === 'local' ? 'offline-fallback' : 'saved');
      const [snapRes] = await Promise.all([
        withAuthGuard(() => apiClient.listSnapshots(slug)),
        hydrateBinaryAssetBytes(res.binaryAssets),
      ]);
      setSnapshots(snapRes.snapshots);
    },
    [hydrateBinaryAssetBytes, storageStatus?.storageDriver, withAuthGuard]
  );

  const loadProjects = useCallback(async () => {
    const [listRes, statusRes, fontsRes] = await Promise.all([
      withAuthGuard(() => apiClient.listProjects()),
      apiClient.getStorageStatus().catch(() => null),
      apiClient.listFonts().catch(() => ({ fonts: [] as CustomFontRecord[] })),
    ]);

    if (statusRes) {
      setStorageStatus(statusRes);
      setSyncState(statusRes.storageDriver === 'local' ? 'offline-fallback' : 'saved');
    }
    setCustomFonts(fontsRes.fonts);
    void hydrateCustomFontBytes(fontsRes.fonts);
    setProjects(listRes.projects);

    if (listRes.projects.length > 0) {
      const targetSlug =
        listRes.workspace.activeProjectSlug &&
        listRes.projects.some((p) => p.slug === listRes.workspace.activeProjectSlug)
          ? listRes.workspace.activeProjectSlug
          : listRes.projects[0].slug;
      await switchProject(targetSlug);
    } else {
      const created = await withAuthGuard(() =>
        apiClient.createProject({
          displayName: 'LaTeX3 Showcase Paper',
          templateId: 'expl3-showcase',
          mainTexContent: DEFAULT_SAMPLE_TEX,
        })
      );
      setProjects([created.project]);
      setActiveProject(created.project);
      setProjectFiles(created.files);
      setBinaryAssets([]);
      setSnapshots([]);
      setIsDirty(false);
    }
  }, [hydrateCustomFontBytes, switchProject, withAuthGuard]);

  const testStorageConnection = useCallback(async (): Promise<StorageStatusInfo> => {
    const status = await withAuthGuard(() => apiClient.getStorageStatus());
    setStorageStatus(status);
    return status;
  }, [withAuthGuard]);

  const loginWithGoogleToken = useCallback(
    async (idToken: string) => {
      setAuthLoading(true);
      setAuthError(null);
      try {
        const res = await apiClient.loginWithGoogle({ idToken });
        setCurrentUser(res.user);
        if (res.user) {
          await loadProjects();
        }
      } catch (err) {
        setAuthError(err instanceof Error ? err.message : 'Google sign-in failed');
        throw err;
      } finally {
        setAuthLoading(false);
      }
    },
    [loadProjects]
  );

  const loginWithDevPersona = useCallback(
    async (email: string, name?: string) => {
      setAuthLoading(true);
      setAuthError(null);
      try {
        const res = await apiClient.loginWithDevPersona({ email, name });
        setCurrentUser(res.user);
        if (res.user) {
          await loadProjects();
        }
      } catch (err) {
        setAuthError(err instanceof Error ? err.message : 'Dev sign-in failed');
        throw err;
      } finally {
        setAuthLoading(false);
      }
    },
    [loadProjects]
  );

  const logout = useCallback(async () => {
    await apiClient.logout();
    setCurrentUser(null);
    setProjects([]);
    setActiveProject(null);
    setSnapshots([]);
    setCustomFonts([]);
    setPdfBytes(null);
    setSynctexData(null);
    setIsDirty(false);
  }, []);

  const createProject = useCallback(async (input: CreateProjectInput) => {
    const tmpl = input.templateId
      ? LATEX_TEMPLATES.find((t) => t.id === input.templateId)
      : undefined;
    const res = await withAuthGuard(() =>
      apiClient.createProject({
        ...input,
        mainTexContent: input.mainTexContent ?? tmpl?.source ?? DEFAULT_SAMPLE_TEX,
        bibContent: input.bibContent ?? tmpl?.defaultBib ?? '',
      })
    );
    binaryCacheRef.current = {};
    setProjects((prev) => [res.project, ...prev]);
    setActiveProject(res.project);
    setProjectFiles(res.files);
    setBinaryAssets([]);
    setActiveFilePathState(res.project.mainTexFile || 'main.tex');
    setRubricTargets(res.project.rubricTargets ?? DEFAULT_RUBRIC);
    setIsDirty(false);
    setConflictInfo(null);
    const snapRes = await withAuthGuard(() => apiClient.listSnapshots(res.project.slug));
    setSnapshots(snapRes.snapshots);
  }, [withAuthGuard]);

  const renameProject = useCallback(async (slug: string, displayName: string) => {
    const res = await withAuthGuard(() => apiClient.renameProject(slug, { displayName }));
    setProjects((prev) => prev.map((p) => (p.slug === slug ? res.project : p)));
    setActiveProject((prev) => (prev?.slug === slug ? res.project : prev));
  }, [withAuthGuard]);

  const duplicateProject = useCallback(
    async (slug: string, displayName: string) => {
      const res = await withAuthGuard(() => apiClient.duplicateProject(slug, { displayName }));
      setProjects((prev) => [res.project, ...prev]);
      await switchProject(res.project.slug);
    },
    [switchProject, withAuthGuard]
  );

  const deleteProject = useCallback(
    async (slug: string) => {
      await withAuthGuard(() => apiClient.deleteProject(slug));
      const remaining = projects.filter((p) => p.slug !== slug);
      setProjects(remaining);
      if (activeProject?.slug === slug) {
        if (remaining.length > 0) {
          await switchProject(remaining[0].slug);
        } else {
          binaryCacheRef.current = {};
          setActiveProject(null);
          setBinaryAssets([]);
          setSnapshots([]);
          setProjectFiles({ 'main.tex': DEFAULT_SAMPLE_TEX, 'references.bib': '' });
        }
      }
    },
    [activeProject, projects, switchProject, withAuthGuard]
  );

  const saveProject = useCallback(
    async (customMessage?: string) => {
      if (!activeProject) return;
      setSyncState('saving');
      try {
        const res = await apiClient.saveProject(activeProject.slug, {
          files: projectFiles,
          expectedVersion: activeProject.version,
          message: customMessage,
        });
        setActiveProject(res.project);
        setProjects((prev) => prev.map((p) => (p.slug === res.project.slug ? res.project : p)));
        setIsDirty(false);
        setConflictInfo(null);
        setSyncState(storageStatus?.storageDriver === 'local' ? 'offline-fallback' : 'saved');
        if (res.snapshot) {
          setSnapshots((prev) => [res.snapshot!, ...prev]);
        }
      } catch (err) {
        if (err instanceof ProjectConflictError) {
          setConflictInfo(err.conflict);
          setSyncState('conflict');
          return;
        }
        if (err instanceof ApiHttpError && err.status === 401) {
          setAuthError('Your Google session expired. Typing & local preview continue working. Sign in again to resume Backblaze B2 sync.');
        }
        setSyncState('error');
        throw err;
      }
    },
    [activeProject, projectFiles, storageStatus?.storageDriver]
  );

  const resolveConflict = useCallback(
    async (choice: ConflictResolutionChoice) => {
      if (!activeProject || !conflictInfo) return;
      if (choice === 'use-cloud') {
        setProjectFiles(conflictInfo.serverFiles);
        setActiveProject((prev) => (prev ? { ...prev, version: conflictInfo.serverVersion } : prev));
        setIsDirty(false);
        setConflictInfo(null);
        setSyncState(storageStatus?.storageDriver === 'local' ? 'offline-fallback' : 'saved');
        return;
      }

      const nextFiles = { ...projectFiles };
      if (choice === 'keep-both') {
        for (const file of conflictInfo.conflictFiles) {
          const dotIdx = file.lastIndexOf('.');
          const cloudPath =
            dotIdx > 0 ? `${file.slice(0, dotIdx)}-cloud${file.slice(dotIdx)}` : `${file}-cloud`;
          if (conflictInfo.serverFiles[file] !== undefined) {
            nextFiles[cloudPath] = conflictInfo.serverFiles[file];
          }
        }
        setProjectFiles(nextFiles);
      }

      const res = await withAuthGuard(() =>
        apiClient.saveProject(activeProject.slug, {
          files: nextFiles,
          expectedVersion: conflictInfo.serverVersion,
          forceOverwrite: true,
          message:
            choice === 'keep-both'
              ? 'Resolve sync conflict (keep both)'
              : 'Resolve sync conflict (keep local)',
        })
      );
      setActiveProject(res.project);
      setProjects((prev) => prev.map((p) => (p.slug === res.project.slug ? res.project : p)));
      setIsDirty(false);
      setConflictInfo(null);
      setSyncState(storageStatus?.storageDriver === 'local' ? 'offline-fallback' : 'saved');
      if (res.snapshot) {
        setSnapshots((prev) => [res.snapshot!, ...prev]);
      }
    },
    [activeProject, conflictInfo, projectFiles, storageStatus?.storageDriver, withAuthGuard]
  );

  const previewSnapshot = useCallback(
    async (snapshotId: string): Promise<SnapshotDetail> => {
      if (!activeProject) {
        throw new Error('No active project');
      }
      return withAuthGuard(() => apiClient.getSnapshotDetail(activeProject.slug, snapshotId));
    },
    [activeProject, withAuthGuard]
  );

  const restoreSnapshot = useCallback(
    async (snapshotId: string) => {
      if (!activeProject) return;
      const res = await withAuthGuard(() =>
        apiClient.restoreSnapshot(activeProject.slug, snapshotId)
      );
      setActiveProject(res.project);
      setProjects((prev) => prev.map((p) => (p.slug === res.project.slug ? res.project : p)));
      setProjectFiles(res.files);
      setSnapshots((prev) => [res.snapshot, ...prev]);
      setIsDirty(false);
      setConflictInfo(null);
    },
    [activeProject, withAuthGuard]
  );

  const triggerForwardSync = useCallback(
    (line?: number) => {
      if (!synctexData) return;
      const targetLine = line ?? cursorLine;
      const box = synctexData.forwardSearch(targetLine, activeFilePath);
      if (box) {
        setForwardSyncBox({ box, nonce: nextNonce() });
      }
    },
    [activeFilePath, cursorLine, synctexData]
  );

  const triggerBackwardSync = useCallback(
    (page: number, xPt: number, yTopPt: number) => {
      if (!synctexData) return;
      const hit = synctexData.backwardSearch(page, xPt, yTopPt);
      if (hit) {
        jumpToSourceLine(hit.line);
      }
    },
    [jumpToSourceLine, synctexData]
  );

  const searchCitations = useCallback(async (query: string) => {
    if (!query.trim()) {
      setBibSearchResults([]);
      return;
    }
    setIsSearchingCitations(true);
    try {
      const res = await apiClient.searchCitations(query);
      setBibSearchResults(res.entries);
    } finally {
      setIsSearchingCitations(false);
    }
  }, []);

  const lookupCitationByIdentifier = useCallback(async (identifier: string) => {
    if (!identifier.trim()) return;
    setIsSearchingCitations(true);
    try {
      const res = await apiClient.lookupCitation(identifier);
      setBibSearchResults((prev) => [res.entry, ...prev.filter((e) => e.citeKey !== res.entry.citeKey)]);
    } finally {
      setIsSearchingCitations(false);
    }
  }, []);

  const importBibEntry = useCallback(
    (entry: BibEntry) => {
      const current = managedBibContent.trim();
      const updated = current ? `${current}\n\n${entry.rawBibTeX}\n` : `${entry.rawBibTeX}\n`;
      setManagedBibContent(updated);
    },
    [managedBibContent, setManagedBibContent]
  );

  const importBibFile = useCallback(
    async (file: File) => {
      const text = await file.text();
      const current = managedBibContent.trim();
      setManagedBibContent(current ? `${current}\n\n${text}\n` : `${text}\n`);
    },
    [managedBibContent, setManagedBibContent]
  );

  const insertFormattedCitation = useCallback(
    (entry: BibEntry, style: CitationCommandStyle, pageLocator?: string) => {
      setSelectedCitationStyle(style);
      const cmd = formatCitationCommand(entry.citeKey, style, pageLocator);
      insertTextAtCaret(cmd, 0);
    },
    [insertTextAtCaret]
  );

  const applyBibliographyStyle = useCallback((style: BibliographyStylePreset) => {
    setSelectedBibliographyStyle(style);
    const option =
      style === 'apa'
        ? 'authoryear'
        : style === 'chicago'
          ? 'chicago-authordate'
          : style === 'acm'
            ? 'numeric'
            : style;
    setProjectFiles((prev) => {
      const main = prev['main.tex'] ?? '';
      if (/\\usepackage(?:\[[^\]]*\])?\{biblatex\}/.test(main)) {
        const updated = main.replace(
          /\\usepackage(?:\[[^\]]*\])?\{biblatex\}/,
          `\\usepackage[style=${option}]{biblatex}`
        );
        return { ...prev, 'main.tex': updated };
      }
      const docBeginIdx = main.indexOf('\\begin{document}');
      const stmt = `\\usepackage[style=${option}]{biblatex}`;
      const updated =
        docBeginIdx >= 0
          ? `${main.slice(0, docBeginIdx)}${stmt}\n${main.slice(docBeginIdx)}`
          : `${stmt}\n${main}`;
      return { ...prev, 'main.tex': updated };
    });
    setIsDirty(true);
  }, []);

  const updateRubricTargets = useCallback(
    async (targets: RubricTargetConfig) => {
      setRubricTargets(targets);
      if (activeProject) {
        const res = await withAuthGuard(() =>
          apiClient.updateRubricTargets(activeProject.slug, targets)
        );
        setActiveProject(res.project);
        setProjects((prev) => prev.map((p) => (p.slug === res.project.slug ? res.project : p)));
      }
    },
    [activeProject, withAuthGuard]
  );

  const applyPaperSetupWizard = useCallback(
    async (config: PaperSetupConfig) => {
      const generated = generatePaperSetupDocument(config);
      setSelectedBibliographyStyle(config.bibliographyStyle);
      setProjectFiles((prev) => ({
        ...prev,
        'main.tex': generated,
      }));
      setActiveFilePathState('main.tex');
      setIsDirty(true);

      if (config.targetProseWords || config.maxPageCount) {
        await updateRubricTargets({
          ...rubricTargets,
          targetProseWords: config.targetProseWords ?? rubricTargets.targetProseWords,
          maxPageCount: config.maxPageCount ?? rubricTargets.maxPageCount,
        });
      }
    },
    [rubricTargets, updateRubricTargets]
  );

  const applyTemplate = useCallback((templateId: string) => {
    const tmpl = LATEX_TEMPLATES.find((t) => t.id === templateId);
    if (!tmpl) return;
    setProjectFiles((prev) => ({
      ...prev,
      'main.tex': tmpl.source,
      ...(tmpl.defaultBib ? { 'references.bib': tmpl.defaultBib } : {}),
    }));
    setActiveFilePathState('main.tex');
    setIsDirty(true);
  }, []);

  const applyAcademicFix = useCallback((op: AcademicFixOperation) => {
    setProjectFiles((prev) => {
      const main = prev['main.tex'] ?? '';
      const lines = main.split('\n');
      if (op.type === 'replaceLine') {
        const idx = op.lineNumber - 1;
        if (idx >= 0 && idx < lines.length) {
          lines[idx] = lines[idx].replace(op.originalSubstring, op.replacement);
        }
        return { ...prev, 'main.tex': lines.join('\n') };
      }
      if (op.type === 'appendMissingBrace') {
        const idx = op.lineNumber - 1;
        if (idx >= 0 && idx < lines.length) {
          lines[idx] = `${lines[idx]}}`;
        }
        return { ...prev, 'main.tex': lines.join('\n') };
      }
      if (op.type === 'wrapLineInMath') {
        const idx = op.lineNumber - 1;
        if (idx >= 0 && idx < lines.length) {
          lines[idx] = `$${lines[idx].trim()}$`;
        }
        return { ...prev, 'main.tex': lines.join('\n') };
      }
      if (op.type === 'insertPackage') {
        const stmt = op.options.trim()
          ? `\\usepackage[${op.options.trim()}]{${op.packageName}}`
          : `\\usepackage{${op.packageName}}`;
        if (main.includes(`{${op.packageName}}`)) return prev;
        const docBeginIdx = main.indexOf('\\begin{document}');
        const updated =
          docBeginIdx >= 0
            ? `${main.slice(0, docBeginIdx)}${stmt}\n${main.slice(docBeginIdx)}`
            : `${stmt}\n${main}`;
        return { ...prev, 'main.tex': updated };
      }
      return { ...prev, 'main.tex': `${main}\n${op.snippet}` };
    });
    setIsDirty(true);
  }, []);

  const toggleProseSpellCheck = useCallback((enabled: boolean) => {
    setProseSpellCheckEnabled(enabled);
  }, []);

  const applySpellingSuggestion = useCallback(
    (issue: SpellingIssue, replacement: string) => {
      setProjectFiles((prev) => {
        const cur = prev[activeFilePath] ?? '';
        if (cur.slice(issue.startOffset, issue.endOffset) !== issue.word) {
          return { ...prev, [activeFilePath]: cur.replace(issue.word, replacement) };
        }
        return {
          ...prev,
          [activeFilePath]: cur.slice(0, issue.startOffset) + replacement + cur.slice(issue.endOffset),
        };
      });
      setIsDirty(true);
    },
    [activeFilePath]
  );

  const ignoreSpellingWord = useCallback((word: string) => {
    ignoredWordsRef.current.add(word.toLowerCase());
    setIgnoredWordsVersion((v) => v + 1);
  }, []);

  const uploadAndInsertFigure = useCallback(
    async (primaryFile: File, secondaryFile: File | null, config: FigureInsertConfig) => {
      if (!activeProject) return;
      insertPackage('graphicx');
      const primary = await withAuthGuard(() =>
        apiClient.uploadProjectAsset(activeProject.slug, primaryFile, 'figures')
      );
      const primaryBytes = new Uint8Array(await primaryFile.arrayBuffer());
      binaryCacheRef.current[primary.relativePath] = primaryBytes;

      let secondaryPath: string | null = null;
      if (secondaryFile) {
        insertPackage('subcaption');
        const sec = await withAuthGuard(() =>
          apiClient.uploadProjectAsset(activeProject.slug, secondaryFile, 'figures')
        );
        binaryCacheRef.current[sec.relativePath] = new Uint8Array(await secondaryFile.arrayBuffer());
        secondaryPath = sec.relativePath;
      }

      setBinaryAssets((prev) => {
        const next = prev.filter(
          (a) => a.relativePath !== primary.relativePath && a.relativePath !== secondaryPath
        );
        next.push({
          relativePath: primary.relativePath,
          sizeBytes: primary.sizeBytes,
          contentType: primary.contentType,
          sha256: '',
          updatedAt: new Date().toISOString(),
          url: primary.url,
        });
        if (secondaryPath) {
          next.push({
            relativePath: secondaryPath,
            sizeBytes: secondaryFile!.size,
            contentType: secondaryFile!.type || 'image/png',
            sha256: '',
            updatedAt: new Date().toISOString(),
            url: `/api/projects/${encodeURIComponent(activeProject.slug)}/assets/${secondaryPath}`,
          });
        }
        return next;
      });

      const snippet = generateFigureSnippet({
        ...config,
        primaryRelativePath: primary.relativePath,
        secondaryRelativePath: secondaryPath,
      });
      insertTextAtCaret(snippet, 0);
    },
    [activeProject, insertPackage, insertTextAtCaret]
  );

  const insertSpreadsheetTable = useCallback(
    (grid: TableGridData) => {
      insertPackage('booktabs');
      insertTextAtCaret(generateBooktabsTable(grid), 0);
    },
    [insertPackage, insertTextAtCaret]
  );

  const insertPGFPlotChart = useCallback(
    (chart: PGFPlotChartConfig) => {
      insertPackage('pgfplots');
      insertTextAtCaret(generatePGFPlotChart(chart), 0);
    },
    [insertPackage, insertTextAtCaret]
  );

  const exportCompiledPDF = useCallback(() => {
    if (!pdfBytes) return;
    const copy = new Uint8Array(pdfBytes);
    const blob = new Blob([copy], { type: 'application/pdf' });
    triggerBrowserDownload(blob, `${activeProject?.slug ?? 'document'}.pdf`);
  }, [activeProject, pdfBytes]);

  const exportSubmissionZip = useCallback(
    async (options?: { stripComments?: boolean; anonymize?: boolean }): Promise<SubmissionExportResult> => {
      await hydrateBinaryAssetBytes(binaryAssets);
      await hydrateCustomFontBytes(customFonts);

      const stagedFonts = customFonts
        .filter((f) => Boolean(fontCacheRef.current[f.id]))
        .map((f) => ({
          fileName: f.fileName,
          bytes: fontCacheRef.current[f.id],
        }));

      const result = buildSubmissionZipBundle({
        projectSlug: activeProject?.slug ?? 'document',
        projectFiles,
        binaryAssets: binaryCacheRef.current,
        customFonts: stagedFonts,
        pdfBytes,
        preflightReport,
        compiledCleanly: compilationState.status === 'success',
        stripComments: options?.stripComments,
        anonymize: options?.anonymize,
      });
      triggerBrowserDownload(result.blob, result.fileName);
      return result;
    },
    [
      activeProject,
      binaryAssets,
      compilationState.status,
      customFonts,
      hydrateBinaryAssetBytes,
      hydrateCustomFontBytes,
      pdfBytes,
      preflightReport,
      projectFiles,
    ]
  );

  const uploadCustomFont = useCallback(
    async (file: File, displayName?: string) => {
      const res = await withAuthGuard(() => apiClient.uploadFont(file, displayName));
      const bytes = new Uint8Array(await file.arrayBuffer());
      fontCacheRef.current[res.font.id] = bytes;
      if (typeof FontFace !== 'undefined' && typeof document !== 'undefined') {
        try {
          const face = new FontFace(res.font.familyName, bytes.slice().buffer);
          await face.load();
          document.fonts.add(face);
        } catch {
          // Ignore FontFace errors in headless environments
        }
      }
      setCustomFonts((prev) => [res.font, ...prev]);
      return res.font;
    },
    [withAuthGuard]
  );

  const renameCustomFont = useCallback(
    async (fontId: string, displayName: string) => {
      const res = await withAuthGuard(() => apiClient.renameFont(fontId, { displayName }));
      setCustomFonts((prev) => prev.map((f) => (f.id === fontId ? res.font : f)));
    },
    [withAuthGuard]
  );

  const deleteCustomFont = useCallback(
    async (fontId: string) => {
      await withAuthGuard(() => apiClient.deleteFont(fontId));
      delete fontCacheRef.current[fontId];
      setCustomFonts((prev) => prev.filter((f) => f.id !== fontId));
    },
    [withAuthGuard]
  );

  const applyFontToDocument = useCallback(
    (fontNameOrFile: string, role: LaTeXFontRole, customCommandName?: string) => {
      insertPackage('fontspec');
      const safeFont = (fontNameOrFile || '')
        .replace(/[\r\n\0\\{}"<>]/g, '')
        .trim() || 'Latin Modern Roman';
      const safeCmdName = (customCommandName || '').replace(/[^a-zA-Z]/g, '') || 'customfont';
      const cmd =
        role === 'main'
          ? `\\setmainfont{${safeFont}}`
          : role === 'sans'
            ? `\\setsansfont{${safeFont}}`
            : role === 'mono'
              ? `\\setmonofont{${safeFont}}`
              : `\\newfontfamily\\${safeCmdName}{${safeFont}}`;
      insertTextAtCaret(`${cmd}\n`, 0);
    },
    [insertPackage, insertTextAtCaret]
  );

  // Initial auth bootstrap
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [cfg, me] = await Promise.all([apiClient.getAuthConfig(), apiClient.getMe()]);
        if (cancelled) return;
        setAuthConfig(cfg);
        setCurrentUser(me.user);
        if (me.user) {
          await loadProjects();
        }
      } catch (err) {
        if (!cancelled) {
          setAuthError(err instanceof Error ? err.message : 'Failed to initialize session');
        }
      } finally {
        if (!cancelled) {
          setAuthLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadProjects]);

  const value = useMemo<WorkspaceStore>(
    () => ({
      authConfig,
      currentUser,
      authLoading,
      authError,
      loginWithGoogleToken,
      loginWithDevPersona,
      logout,
      projects,
      activeProject,
      projectFiles,
      binaryAssets,
      storageStatus,
      isDirty,
      syncState,
      conflictInfo,
      snapshots,
      loadProjects,
      testStorageConnection,
      createProject,
      renameProject,
      duplicateProject,
      switchProject,
      deleteProject,
      saveProject,
      resolveConflict,
      loadSnapshots,
      previewSnapshot,
      restoreSnapshot,
      activeFilePath,
      sourceText,
      managedBibContent,
      cursorLine,
      autoCompileEnabled,
      editorTheme,
      editorFontFamily,
      editorFontSize,
      compilationState,
      pdfBytes,
      synctexData,
      texLogText,
      diagnostics,
      demystifiedDiagnostics,
      outlineItems,
      contextAdvice,
      pendingInsertion,
      pendingJumpToLine,
      forwardSyncBox,
      setSourceText,
      setManagedBibContent,
      setActiveFilePath,
      setCursorLine,
      setAutoCompileEnabled,
      setEditorTheme,
      setEditorTypography,
      compileNow,
      triggerForwardSync,
      triggerBackwardSync,
      jumpToSourceLine,
      insertTextAtCaret,
      consumePendingInsertion,
      insertPackage,
      bibEntries,
      bibSearchResults,
      isSearchingCitations,
      selectedCitationStyle,
      selectedBibliographyStyle,
      academicStats,
      rubricTargets,
      preflightReport,
      proseSpellCheckEnabled,
      spellingIssues,
      searchCitations,
      lookupCitationByIdentifier,
      importBibEntry,
      importBibFile,
      insertFormattedCitation,
      applyBibliographyStyle,
      applyPaperSetupWizard,
      applyTemplate,
      applyAcademicFix,
      updateRubricTargets,
      toggleProseSpellCheck,
      applySpellingSuggestion,
      ignoreSpellingWord,
      uploadAndInsertFigure,
      insertSpreadsheetTable,
      insertPGFPlotChart,
      exportCompiledPDF,
      exportSubmissionZip,
      customFonts,
      uploadCustomFont,
      renameCustomFont,
      deleteCustomFont,
      applyFontToDocument,
    }),
    [
      academicStats,
      activeFilePath,
      activeProject,
      applyAcademicFix,
      applyBibliographyStyle,
      applyFontToDocument,
      applyPaperSetupWizard,
      applySpellingSuggestion,
      applyTemplate,
      authConfig,
      authError,
      authLoading,
      autoCompileEnabled,
      bibEntries,
      bibSearchResults,
      binaryAssets,
      compilationState,
      compileNow,
      conflictInfo,
      consumePendingInsertion,
      contextAdvice,
      createProject,
      currentUser,
      cursorLine,
      customFonts,
      deleteCustomFont,
      deleteProject,
      demystifiedDiagnostics,
      diagnostics,
      duplicateProject,
      editorFontFamily,
      editorFontSize,
      editorTheme,
      exportCompiledPDF,
      exportSubmissionZip,
      forwardSyncBox,
      ignoreSpellingWord,
      importBibEntry,
      importBibFile,
      insertFormattedCitation,
      insertPGFPlotChart,
      insertPackage,
      insertSpreadsheetTable,
      insertTextAtCaret,
      isDirty,
      isSearchingCitations,
      jumpToSourceLine,
      loadProjects,
      loadSnapshots,
      loginWithDevPersona,
      loginWithGoogleToken,
      logout,
      lookupCitationByIdentifier,
      managedBibContent,
      outlineItems,
      pdfBytes,
      pendingInsertion,
      pendingJumpToLine,
      preflightReport,
      previewSnapshot,
      projectFiles,
      projects,
      proseSpellCheckEnabled,
      renameCustomFont,
      renameProject,
      resolveConflict,
      restoreSnapshot,
      rubricTargets,
      saveProject,
      searchCitations,
      selectedBibliographyStyle,
      selectedCitationStyle,
      setActiveFilePath,
      setEditorTypography,
      setManagedBibContent,
      setSourceText,
      snapshots,
      sourceText,
      spellingIssues,
      storageStatus,
      switchProject,
      syncState,
      synctexData,
      testStorageConnection,
      texLogText,
      toggleProseSpellCheck,
      triggerBackwardSync,
      triggerForwardSync,
      updateRubricTargets,
      uploadAndInsertFigure,
      uploadCustomFont,
    ]
  );

  return React.createElement(WorkspaceContext.Provider, { value }, children);
}

export function useWorkspaceStore(): WorkspaceStore {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error('useWorkspaceStore must be used inside a WorkspaceProvider');
  }
  return ctx;
}
