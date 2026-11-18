import { strToU8, zipSync } from 'fflate';
import type { AcademicPreflightReport, SubmissionExportResult } from '@shared/types/academic.js';
import { AcademicSanitizer } from './academicToolsGenerator.js';

export interface SubmissionExportInput {
  projectSlug: string;
  projectFiles: Record<string, string>;
  binaryAssets: Record<string, Uint8Array>;
  customFonts?: Array<{ fileName: string; bytes: Uint8Array }>;
  pdfBytes?: Uint8Array | null;
  preflightReport?: AcademicPreflightReport;
  compiledCleanly?: boolean;
  stripComments?: boolean;
  anonymize?: boolean;
}

function stripTexComments(source: string): string {
  return source
    .split(/\r?\n/)
    .map((line) => {
      for (let i = 0; i < line.length; i += 1) {
        if (line[i] === '%' && (i === 0 || line[i - 1] !== '\\')) {
          return line.slice(0, i).trimEnd();
        }
      }
      return line;
    })
    .join('\n');
}

function anonymizeTexSource(source: string): string {
  let out = source.replace(/\\author(?:\[[^\]]*\])?\{[\s\S]*?\}/g, '\\author{Anonymous Author(s)}');
  if (!out.includes('\\linenumbers')) {
    out = out.replace(
      '\\begin{document}',
      '\\usepackage{lineno}\n\\linenumbers\n\\begin{document}'
    );
  }
  return out;
}

export function buildSubmissionZipBundle(input: SubmissionExportInput): SubmissionExportResult {
  const safeSlug = AcademicSanitizer.sanitizeIdentifier(input.projectSlug || 'document', 'document');
  const entries: Record<string, Uint8Array> = {};
  const includedFiles: string[] = [];

  for (const [relPath, rawContent] of Object.entries(input.projectFiles)) {
    const safePath = AcademicSanitizer.validatedRelativeAssetPath(relPath);
    if (!safePath) continue;
    let text = rawContent;
    if (safePath.endsWith('.tex')) {
      if (input.stripComments) text = stripTexComments(text);
      if (input.anonymize) text = anonymizeTexSource(text);
    }
    entries[safePath] = strToU8(text);
    includedFiles.push(safePath);
  }

  for (const [relPath, bytes] of Object.entries(input.binaryAssets)) {
    const safePath = AcademicSanitizer.validatedRelativeAssetPath(relPath, ['figures']);
    if (!safePath) continue;
    entries[safePath] = bytes;
    includedFiles.push(safePath);
  }

  for (const font of input.customFonts ?? []) {
    const safeFontName = (font.fileName || '').split(/[\\/]/).pop()?.replace(/[^a-zA-Z0-9._-]/g, '-') || 'font.ttf';
    const fontPath = AcademicSanitizer.validatedRelativeAssetPath(`fonts/${safeFontName}`, ['fonts']);
    if (!fontPath) continue;
    entries[fontPath] = font.bytes;
    includedFiles.push(fontPath);
  }

  if (input.pdfBytes && input.pdfBytes.byteLength > 0) {
    const pdfName = `${safeSlug}.pdf`;
    entries[pdfName] = input.pdfBytes;
    includedFiles.push(pdfName);
  }

  const zipped = zipSync(entries, { level: 6 });
  const zipCopy = new Uint8Array(zipped);
  const blob = new Blob([zipCopy], { type: 'application/zip' });
  const preflightWarnings = (input.preflightReport?.items ?? [])
    .filter((i) => i.severity !== 'pass')
    .map((i) => i.title);

  return {
    fileName: `${safeSlug}-submission.zip`,
    blob,
    includedFiles: includedFiles.sort(),
    preflightWarnings,
    compiledCleanly: Boolean(input.compiledCleanly),
  };
}
