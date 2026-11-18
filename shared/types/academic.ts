import type { DiagnosticSeverity } from './latex.js';

export type CitationCommandStyle = 'cite' | 'parencite' | 'textcite' | 'autocite' | 'footcite';

export type BibliographyStylePreset = 'apa' | 'ieee' | 'acm' | 'mla' | 'chicago' | 'nature';

export interface BibEntry {
  id: string;
  citeKey: string;
  entryType: string;
  title: string;
  authors: string[];
  year: string;
  venue?: string;
  doi?: string;
  url?: string;
  isbn?: string;
  arxivId?: string;
  pages?: string;
  volume?: string;
  number?: string;
  publisher?: string;
  rawBibTeX: string;
}

export type AcademicPaperSize = 'letterpaper' | 'a4paper';

export interface PaperSetupConfig {
  templateId: string;
  title: string;
  author: string;
  institution: string;
  courseOrVenue: string;
  date?: string;
  paperSize: AcademicPaperSize;
  baseFontSizePt: number;
  lineSpacing?: 'single' | 'onehalf' | 'double';
  doubleSpacing: boolean;
  anonymizedBlindReview: boolean;
  bibliographyStyle: BibliographyStylePreset;
  targetProseWords?: number | null;
  maxPageCount?: number | null;
}

export interface RubricTargetConfig {
  targetProseWords: number | null;
  maxPageCount: number | null;
  maxAbstractWords: number | null;
  studentModeHideExpl3: boolean;
}

export interface AcademicDocumentStats {
  proseWordCount: number;
  abstractWordCount: number;
  referenceCount: number;
  figureCount: number;
  tableCount: number;
  mathBlockCount: number;
  expl3SymbolCount: number;
  pageCount: number;
  estimatedReadingMinutes: number;
}

export type AcademicFixOperation =
  | {
      type: 'replaceLine';
      lineNumber: number;
      originalSubstring: string;
      replacement: string;
    }
  | {
      type: 'insertPackage';
      packageName: string;
      options: string;
    }
  | {
      type: 'wrapLineInMath';
      lineNumber: number;
    }
  | {
      type: 'appendMissingBrace';
      lineNumber: number;
    }
  | {
      type: 'insertRawSnippet';
      snippet: string;
    };

export interface DemystifiedDiagnostic {
  id: string;
  line: number | null;
  severity: DiagnosticSeverity;
  shortTitle: string;
  explanation: string;
  rawMessage: string;
  fixButtonTitle?: string;
  fixOperation?: AcademicFixOperation;
}

export type PreflightSeverity = 'pass' | 'warning' | 'blocker';

export interface AcademicPreflightItem {
  id: string;
  category: string;
  severity: PreflightSeverity;
  title: string;
  detail: string;
  line?: number | null;
  fixButtonTitle?: string;
  fixOperation?: AcademicFixOperation;
}

export interface AcademicPreflightReport {
  items: AcademicPreflightItem[];
  unresolvedCitations: string[];
  unresolvedReferences: string[];
  uncitedBibKeys: string[];
  missingFigurePaths: string[];
  isSubmissionReady: boolean;
}

export type TableColumnAlignment = 'l' | 'c' | 'r';

export interface TableGridData {
  headers: string[];
  rows: string[][];
  alignments: TableColumnAlignment[];
  boldHeader: boolean;
  caption: string;
  label: string;
}

export type PGFPlotChartType = 'line' | 'bar' | 'scatter';

export interface PGFPlotChartConfig {
  chartType: PGFPlotChartType;
  title: string;
  xLabel: string;
  yLabel: string;
  csvText: string;
  showGrid: boolean;
  showLegend: boolean;
  caption: string;
  label: string;
}

export interface FigureInsertConfig {
  primaryRelativePath: string;
  secondaryRelativePath?: string | null;
  widthFraction: number;
  placement: string;
  caption: string;
  label: string;
  primarySubcaption: string;
  secondarySubcaption: string;
}

export interface EditorInsertionRequest {
  id: string;
  text: string;
  cursorBacktrackOffset: number;
}

export interface SpellingIssue {
  id: string;
  word: string;
  line: number;
  column: number;
  startOffset: number;
  endOffset: number;
  suggestions: string[];
}

export interface SubmissionExportResult {
  fileName: string;
  blob: Blob;
  includedFiles: string[];
  preflightWarnings: string[];
  compiledCleanly: boolean;
}
