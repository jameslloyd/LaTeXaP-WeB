import type {
  AcademicPreflightItem,
  AcademicPreflightReport,
  BibEntry,
} from '@shared/types/academic.js';
import type { LaTeXDiagnostic } from '@shared/types/latex.js';

export function runAcademicPreflight(
  source: string,
  bibEntries: BibEntry[],
  diagnostics: LaTeXDiagnostic[],
  existingAssetPaths: string[]
): AcademicPreflightReport {
  const items: AcademicPreflightItem[] = [];
  const lines = (source || '').split(/\r?\n/);

  const definedBibKeys = new Set(bibEntries.map((e) => e.citeKey));
  const citedKeys: Array<{ key: string; line: number }> = [];
  const definedLabels = new Set<string>();
  const referencedLabels: Array<{ key: string; line: number }> = [];
  const figurePaths: Array<{ path: string; line: number }> = [];

  for (let i = 0; i < lines.length; i += 1) {
    const lineNum = i + 1;
    const raw = lines[i];
    const commentIdx = raw.search(/(?<!\\)%/);
    const line = commentIdx >= 0 ? raw.slice(0, commentIdx) : raw;

    for (const m of line.matchAll(/\\(?:cite|parencite|textcite|autocite|footcite)(?:\[[^\]]*\])?\{([^}]+)\}/g)) {
      for (const k of m[1].split(',').map((s) => s.trim()).filter(Boolean)) {
        citedKeys.push({ key: k, line: lineNum });
      }
    }

    for (const m of line.matchAll(/\\label\{([^}]+)\}/g)) {
      definedLabels.add(m[1].trim());
    }

    for (const m of line.matchAll(/\\(?:cref|Cref|ref|eqref)\{([^}]+)\}/g)) {
      referencedLabels.push({ key: m[1].trim(), line: lineNum });
    }

    for (const m of line.matchAll(/\\includegraphics(?:\[[^\]]*\])?\{([^}]+)\}/g)) {
      figurePaths.push({ path: m[1].trim(), line: lineNum });
    }
  }

  // 1. Unresolved citations
  const unresolvedCitations: string[] = [];
  for (const c of citedKeys) {
    if (!definedBibKeys.has(c.key) && !unresolvedCitations.includes(c.key)) {
      unresolvedCitations.push(c.key);
      items.push({
        id: `pf-cite-${c.key}`,
        category: 'Citations',
        severity: 'blocker',
        title: `Unresolved citation key: "${c.key}"`,
        detail: `Referenced on line ${c.line}, but no matching entry exists in references.bib.`,
        line: c.line,
      });
    }
  }

  // 2. Broken cross-references
  const unresolvedReferences: string[] = [];
  for (const r of referencedLabels) {
    if (!definedLabels.has(r.key) && !unresolvedReferences.includes(r.key)) {
      unresolvedReferences.push(r.key);
      items.push({
        id: `pf-ref-${r.key}`,
        category: 'Cross-References',
        severity: 'blocker',
        title: `Broken reference target: "\\ref{${r.key}}"`,
        detail: `No \\label{${r.key}} was found in the document.`,
        line: r.line,
      });
    }
  }

  // 3. Uncited .bib entries
  const citedSet = new Set(citedKeys.map((c) => c.key));
  const uncitedBibKeys: string[] = [];
  for (const key of definedBibKeys) {
    if (!citedSet.has(key)) {
      uncitedBibKeys.push(key);
      items.push({
        id: `pf-uncited-${key}`,
        category: 'Bibliography',
        severity: 'warning',
        title: `Uncited BibTeX entry: "${key}"`,
        detail: 'Present in references.bib but not yet cited in main.tex.',
      });
    }
  }

  // 4. Figure path & existence checks
  const assetSet = new Set(existingAssetPaths);
  const missingFigurePaths: string[] = [];
  for (const fig of figurePaths) {
    const isAbsoluteOrTraversal = fig.path.startsWith('/') || fig.path.includes('..') || /^[a-zA-Z]:/.test(fig.path);
    const leafName = fig.path.split(/[\\/]/).pop() || 'figure.png';
    if (isAbsoluteOrTraversal) {
      missingFigurePaths.push(fig.path);
      items.push({
        id: `pf-fig-abs-${fig.line}`,
        category: 'Figures',
        severity: 'blocker',
        title: `Non-portable figure path: "${fig.path}"`,
        detail: 'Submission bundles require relative project paths under figures/.',
        line: fig.line,
        fixButtonTitle: 'Relocate to figures/',
        fixOperation: {
          type: 'replaceLine',
          lineNumber: fig.line,
          originalSubstring: fig.path,
          replacement: `figures/${leafName}`,
        },
      });
    } else if (assetSet.size > 0 && !assetSet.has(fig.path)) {
      missingFigurePaths.push(fig.path);
      items.push({
        id: `pf-fig-missing-${fig.line}`,
        category: 'Figures',
        severity: 'warning',
        title: `Figure asset not uploaded: "${fig.path}"`,
        detail: 'Upload the image in Figure Assistant so it embeds in the PDF and submission .zip.',
        line: fig.line,
      });
    }
  }

  // 5. Compilation errors & Overfull hbox
  for (const d of diagnostics) {
    if (d.severity === 'Error') {
      items.push({
        id: `pf-err-${d.id}`,
        category: 'Compiler',
        severity: 'blocker',
        title: d.message,
        detail: d.line ? `Compilation error on line ${d.line}.` : 'Compilation error.',
        line: d.line,
      });
    } else if (/Overfull \\hbox/i.test(d.message)) {
      items.push({
        id: `pf-overfull-${d.id}`,
        category: 'Layout',
        severity: 'warning',
        title: 'Overfull \\hbox margin overflow',
        detail: d.message,
        line: d.line,
      });
    }
  }

  const hasBlocker = items.some((item) => item.severity === 'blocker');
  return {
    items,
    unresolvedCitations,
    unresolvedReferences,
    uncitedBibKeys,
    missingFigurePaths,
    isSubmissionReady: !hasBlocker,
  };
}
