import type { AcademicDocumentStats } from '@shared/types/academic.js';
import type { LaTeXDiagnostic } from '@shared/types/latex.js';

const EXPL3_SYMBOL_RE = /\\(?:tl|int|fp|seq|clist|prop|bool|box|dim|skip|str|cs|msg|keys|ior|iow|file|regex)_[a-zA-Z0-9_]+:[a-zA-Z]+/g;

export function lintExpl3(source: string, studentModeHideExpl3 = false): LaTeXDiagnostic[] {
  if (studentModeHideExpl3) return [];
  const diagnostics: LaTeXDiagnostic[] = [];
  const lines = (source || '').split(/\r?\n/);

  let inExplSyntax = false;
  let explStartLine = 0;

  for (let i = 0; i < lines.length; i += 1) {
    const lineNum = i + 1;
    const raw = lines[i];
    const commentIdx = raw.search(/(?<!\\)%/);
    const code = commentIdx >= 0 ? raw.slice(0, commentIdx) : raw;

    if (/\\ExplSyntaxOn\b/.test(code)) {
      if (inExplSyntax) {
        diagnostics.push({
          id: `expl3-nested-${lineNum}`,
          line: lineNum,
          severity: 'Warning',
          message: 'Nested \\ExplSyntaxOn encountered while already inside ExplSyntax mode.',
          rawLine: raw.trim(),
        });
      }
      inExplSyntax = true;
      explStartLine = lineNum;
    }

    const explMatches = code.match(EXPL3_SYMBOL_RE);
    if (explMatches && !inExplSyntax) {
      diagnostics.push({
        id: `expl3-outside-${lineNum}`,
        line: lineNum,
        severity: 'Warning',
        message: `LaTeX3 symbol "${explMatches[0]}" used outside \\ExplSyntaxOn ... \\ExplSyntaxOff block.`,
        rawLine: raw.trim(),
      });
    }

    if (inExplSyntax && /\\newcommand\b/.test(code)) {
      diagnostics.push({
        id: `expl3-newcommand-${lineNum}`,
        line: lineNum,
        severity: 'Info',
        message: 'Consider \\NewDocumentCommand or \\cs_new_protected:Npn instead of \\newcommand inside ExplSyntax.',
        rawLine: raw.trim(),
      });
    }

    if (/\\ExplSyntaxOff\b/.test(code)) {
      if (!inExplSyntax) {
        diagnostics.push({
          id: `expl3-extra-off-${lineNum}`,
          line: lineNum,
          severity: 'Warning',
          message: '\\ExplSyntaxOff found without a matching \\ExplSyntaxOn.',
          rawLine: raw.trim(),
        });
      }
      inExplSyntax = false;
    }
  }

  if (inExplSyntax) {
    diagnostics.push({
      id: `expl3-unclosed-${explStartLine}`,
      line: explStartLine,
      severity: 'Warning',
      message: `\\ExplSyntaxOn opened on line ${explStartLine} is missing a closing \\ExplSyntaxOff.`,
      rawLine: '\\ExplSyntaxOn',
    });
  }

  return diagnostics;
}

function countWords(text: string): number {
  const words = text.trim().match(/[A-Za-z0-9'\u2019-]+/g);
  return words ? words.length : 0;
}

export function computeAcademicStatistics(
  source: string,
  bibContent = '',
  pageCount = 0
): AcademicDocumentStats {
  const docStart = source.indexOf('\\begin{document}');
  const docEnd = source.lastIndexOf('\\end{document}');
  const body =
    docStart >= 0
      ? source.slice(docStart + '\\begin{document}'.length, docEnd > docStart ? docEnd : undefined)
      : source;

  // Abstract word count
  const absMatch = body.match(/\\begin\{abstract\}([\s\S]*?)\\end\{abstract\}/);
  const abstractText = absMatch
    ? absMatch[1]
        .replace(/(?<!\\)%.*$/gm, '')
        .replace(/\\[a-zA-Z@]+(?:\[[^\]]*\])?(?:\{[^}]*\})?/g, ' ')
    : '';
  const abstractWordCount = countWords(abstractText);

  // Strip comments, ExplSyntax blocks, display math, inline math, tabular/tikzpicture, and commands
  const stripped = body
    .replace(/(?<!\\)%.*$/gm, ' ')
    .replace(/\\ExplSyntaxOn[\s\S]*?\\ExplSyntaxOff/g, ' ')
    .replace(/\\begin\{(?:equation|align|gather|multline)\*?\}[\s\S]*?\\end\{(?:equation|align|gather|multline)\*?\}/g, ' ')
    .replace(/\\\[[\s\S]*?\\\]/g, ' ')
    .replace(/\$\$[\s\S]*?\$\$/g, ' ')
    .replace(/\$[^$]*\$/g, ' ')
    .replace(/\\begin\{(?:tabular|tabularx|tikzpicture|verbatim|lstlisting)\}[\s\S]*?\\end\{(?:tabular|tabularx|tikzpicture|verbatim|lstlisting)\}/g, ' ')
    .replace(/\\(?:cite|parencite|textcite|autocite|footcite|ref|cref|label|usepackage|includegraphics|caption)(?:\[[^\]]*\])?\{[^}]*\}/g, ' ')
    .replace(/\\(?:begin|end)\{[^}]*\}/g, ' ')
    .replace(/\\[a-zA-Z@]+(?:\[[^\]]*\])?/g, ' ')
    .replace(/[{}~]/g, ' ');

  const proseWordCount = countWords(stripped);

  const bibKeys = new Set(Array.from(bibContent.matchAll(/@[a-zA-Z]+\s*\{\s*([^,\s]+)\s*,/g)).map((m) => m[1]));
  const citedKeys = new Set<string>();
  for (const m of body.matchAll(/\\(?:cite|parencite|textcite|autocite|footcite)(?:\[[^\]]*\])?\{([^}]+)\}/g)) {
    for (const k of m[1].split(',').map((s) => s.trim()).filter(Boolean)) {
      citedKeys.add(k);
    }
  }
  const referenceCount = Math.max(bibKeys.size, citedKeys.size);
  const figureCount = (body.match(/\\begin\{figure\*?\}/g) || []).length;
  const tableCount = (body.match(/\\begin\{table\*?\}/g) || []).length;

  const mathBlockCount =
    (body.match(/\\begin\{(?:equation|align|gather)\*?\}/g) || []).length +
    (body.match(/\\\[/g) || []).length +
    (body.match(/\$[^$]+\$/g) || []).length;

  const expl3SymbolCount = (source.match(EXPL3_SYMBOL_RE) || []).length;
  const estimatedReadingMinutes = proseWordCount > 0 ? Math.max(1, Math.ceil(proseWordCount / 220)) : 0;

  return {
    proseWordCount,
    abstractWordCount,
    referenceCount,
    figureCount,
    tableCount,
    mathBlockCount,
    expl3SymbolCount,
    pageCount,
    estimatedReadingMinutes,
  };
}
