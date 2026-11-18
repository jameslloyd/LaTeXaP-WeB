export type DiagnosticSeverity = 'Error' | 'Warning' | 'Info';

export interface LaTeXDiagnostic {
  id: string;
  line: number | null;
  severity: DiagnosticSeverity;
  message: string;
  rawLine: string;
}

export type CompilationState =
  | { status: 'idle' }
  | { status: 'compiling'; message: string }
  | { status: 'success'; durationMs: number; pageCount: number }
  | { status: 'failed'; errorCount: number };

export interface DocumentOutlineItem {
  id: string;
  title: string;
  level: number; // 1 = part/chapter/section, 2 = subsection/expl3/xparse/env, 3 = subsubsection
  line: number;
  badge: string;
}

export interface SyncTeXBox {
  page: number;
  inputId: number;
  file: string;
  line: number;
  xPt: number;
  yTopPt: number;
  widthPt: number;
  heightPt: number;
  depthPt?: number;
}

export interface SyncTeXData {
  inputs: Record<number, string>;
  boxes: SyncTeXBox[];
  rawText: string;
  forwardSearch(line: number, file?: string): SyncTeXBox | null;
  backwardSearch(page: number, xPt: number, yTopPt: number): { line: number; file: string } | null;
}

export interface LaTeXTemplate {
  id: string;
  title: string;
  subtitle: string;
  category: 'Academic Papers' | 'STEM & Theses' | 'LaTeX3 Core';
  badge: string;
  source: string;
  defaultBib?: string;
}

export interface LaTeXPackageInfo {
  name: string;
  category: string;
  description: string;
  defaultOptions?: string;
  isExpl3?: boolean;
}

export interface LaTeXSnippet {
  id: string;
  title: string;
  category: string;
  description: string;
  code: string;
  cursorBacktrackOffset?: number;
}

export interface ContextAdviceItem {
  id: string;
  title: string;
  detail: string;
  badge?: string;
  actionLabel?: string;
  snippet?: string;
  packageName?: string;
  packageOptions?: string;
}
