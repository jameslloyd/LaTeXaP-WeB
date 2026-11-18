import type { DemystifiedDiagnostic } from '@shared/types/academic.js';
import type { ContextAdviceItem, LaTeXDiagnostic } from '@shared/types/latex.js';

export function analyzeContext(
  source: string,
  cursorLine: number,
  studentModeHideExpl3 = false
): { contextBadge: string; items: ContextAdviceItem[] } {
  const lines = (source || '').split(/\r?\n/);
  const clampedLine = Math.min(Math.max(1, cursorLine), Math.max(1, lines.length));

  if (!source.trim()) {
    return {
      contextBadge: 'Empty Document',
      items: [
        {
          id: 'ctx-starter',
          title: 'Start with a Document Class',
          detail: 'Insert a complete LaTeX3 article skeleton with title, abstract, and sections.',
          badge: 'Starter',
          actionLabel: 'Insert Skeleton',
          snippet: `\\documentclass[11pt,letterpaper]{article}\n\\usepackage{amsmath,booktabs,graphicx}\n\n\\title{Untitled Document}\n\\author{Author Name}\n\\date{\\today}\n\n\\begin{document}\n\\maketitle\n\n\\section{Introduction}\n\n\\end{document}\n`,
        },
      ],
    };
  }

  const beforeCursor = lines.slice(0, clampedLine).join('\n');
  const inPreamble = !beforeCursor.includes('\\begin{document}');
  const explOnCount = (beforeCursor.match(/\\ExplSyntaxOn\b/g) || []).length;
  const explOffCount = (beforeCursor.match(/\\ExplSyntaxOff\b/g) || []).length;
  const inExpl3 = !studentModeHideExpl3 && explOnCount > explOffCount;

  const currentLine = lines[clampedLine - 1] || '';
  const windowText = lines.slice(Math.max(0, clampedLine - 6), clampedLine + 2).join('\n');
  const inMath =
    /\\begin\{(?:equation|align|gather)\*?\}/.test(windowText) ||
    (currentLine.split('$').length - 1) % 2 === 1;
  const inTableOrFig = /\\begin\{(?:table|tabular|figure|tikzpicture)/.test(windowText);

  if (inExpl3) {
    return {
      contextBadge: 'LaTeX3 (expl3) Block',
      items: [
        {
          id: 'ctx-expl-tl',
          title: 'Declare Token List Variable',
          detail: 'Use \\tl_new:N and \\tl_set:Nn to store formatted strings inside ExplSyntax.',
          badge: 'l3tl',
          actionLabel: 'Insert Token List',
          snippet: '\\tl_new:N \\l_tmp_note_tl\n\\tl_set:Nn \\l_tmp_note_tl { Note~text }\n',
        },
        {
          id: 'ctx-expl-cmd',
          title: 'Define xparse Document Command',
          detail: 'Expose an expl3 helper to document prose with \\NewDocumentCommand.',
          badge: 'xparse',
          actionLabel: 'Insert Command',
          snippet: '\\NewDocumentCommand{\\MyMacro}{ m }{\\textbf{#1}}\n',
        },
      ],
    };
  }

  if (inPreamble) {
    const items: ContextAdviceItem[] = [];
    if (!source.includes('{amsmath}')) {
      items.push({
        id: 'ctx-pkg-amsmath',
        title: 'Add amsmath Package',
        detail: 'Enables equation, align, cases, and \\text{} inside math mode.',
        badge: 'Package',
        actionLabel: 'Add Package',
        packageName: 'amsmath',
      });
    }
    if (!source.includes('{booktabs}')) {
      items.push({
        id: 'ctx-pkg-booktabs',
        title: 'Add booktabs Package',
        detail: 'Provides publication-grade \\toprule, \\midrule, and \\bottomrule rules.',
        badge: 'Package',
        actionLabel: 'Add Package',
        packageName: 'booktabs',
      });
    }
    items.push({
      id: 'ctx-pkg-cleveref',
      title: 'Add cleveref for Smart Cross-References',
      detail: 'Automatically prefixes "Figure", "Table", and "Section" via \\cref{...}.',
      badge: 'Package',
      actionLabel: 'Add Package',
      packageName: 'cleveref',
    });
    return { contextBadge: 'Preamble', items };
  }

  if (inMath) {
    return {
      contextBadge: 'Math Environment',
      items: [
        {
          id: 'ctx-math-frac',
          title: 'Fraction \\frac{a}{b}',
          detail: 'Insert a clean stacked fraction at the caret.',
          badge: 'Math',
          actionLabel: 'Insert Fraction',
          snippet: '\\frac{a}{b}',
        },
        {
          id: 'ctx-math-sum',
          title: 'Indexed Summation',
          detail: 'Insert a summation from i=1 to n.',
          badge: 'Math',
          actionLabel: 'Insert Sum',
          snippet: '\\sum_{i=1}^{n} x_i',
        },
      ],
    };
  }

  if (inTableOrFig) {
    return {
      contextBadge: 'Table / Figure',
      items: [
        {
          id: 'ctx-fig-label',
          title: 'Add Caption & Label',
          detail: 'Ensure every float carries a descriptive \\caption and unique \\label.',
          badge: 'Float',
          actionLabel: 'Insert Caption & Label',
          snippet: '  \\caption{Descriptive caption.}\n  \\label{fig:label}\n',
        },
      ],
    };
  }

  return {
    contextBadge: 'Body Prose',
    items: [
      {
        id: 'ctx-body-sec',
        title: 'Add Subsection',
        detail: 'Structure long arguments with clear subsection headings.',
        badge: 'Structure',
        actionLabel: 'Insert Subsection',
        snippet: '\\subsection{Subsection Title}\n',
      },
      {
        id: 'ctx-body-eq',
        title: 'Numbered Equation',
        detail: 'Insert a labeled equation block for cross-referencing.',
        badge: 'Math',
        actionLabel: 'Insert Equation',
        snippet: '\\begin{equation}\n  y = f(x)\n\\end{equation}\n',
      },
    ],
  };
}

export function demystifyDiagnostics(
  diagnostics: LaTeXDiagnostic[],
  source: string
): DemystifiedDiagnostic[] {
  const lines = (source || '').split(/\r?\n/);

  return diagnostics.map((d) => {
    const msg = d.message;
    const raw = d.rawLine || msg;
    const lineText = d.line && d.line >= 1 && d.line <= lines.length ? lines[d.line - 1] : '';

    if (/alignment tab character &/i.test(msg) || /Misplaced alignment tab/i.test(raw)) {
      return {
        id: d.id,
        line: d.line,
        severity: d.severity,
        shortTitle: 'Unescaped "&" character in body text',
        explanation:
          'In LaTeX, "&" separates columns inside tables and equations. Use "\\&" when writing an ampersand in normal prose.',
        rawMessage: raw,
        fixButtonTitle: d.line ? 'Escape & → \\&' : undefined,
        fixOperation: d.line
          ? {
              type: 'replaceLine',
              lineNumber: d.line,
              originalSubstring: '&',
              replacement: '\\&',
            }
          : undefined,
      };
    }

    if (/Extra closing brace|Extra \}/i.test(msg)) {
      return {
        id: d.id,
        line: d.line,
        severity: d.severity,
        shortTitle: 'Extra closing "}" brace',
        explanation:
          'There is a closing brace "}" without a matching opening "{". Remove the extra brace or open the group earlier.',
        rawMessage: raw,
        fixButtonTitle: d.line && lineText.includes('}') ? 'Remove extra }' : undefined,
        fixOperation:
          d.line && lineText.includes('}')
            ? {
                type: 'replaceLine',
                lineNumber: d.line,
                originalSubstring: '}',
                replacement: '',
              }
            : undefined,
      };
    }

    if (/Unclosed.*brace|scanning use of/i.test(msg)) {
      return {
        id: d.id,
        line: d.line,
        severity: d.severity,
        shortTitle: 'Missing closing "}" brace',
        explanation:
          'A group opened with "{" was never closed with "}". Adding the missing "}" restores valid LaTeX grouping.',
        rawMessage: raw,
        fixButtonTitle: d.line ? 'Append missing }' : undefined,
        fixOperation: d.line ? { type: 'appendMissingBrace', lineNumber: d.line } : undefined,
      };
    }

    if (/Undefined control sequence/i.test(msg) && /\\(frac|align|text|mathbb)/.test(raw)) {
      const pkg = raw.includes('mathbb') ? 'amssymb' : 'amsmath';
      return {
        id: d.id,
        line: d.line,
        severity: d.severity,
        shortTitle: `Missing package for math command (${pkg})`,
        explanation: `This command requires the ${pkg} package in your preamble.`,
        rawMessage: raw,
        fixButtonTitle: `Add \\usepackage{${pkg}}`,
        fixOperation: { type: 'insertPackage', packageName: pkg, options: '' },
      };
    }

    if (/Missing \$ inserted/i.test(msg)) {
      return {
        id: d.id,
        line: d.line,
        severity: d.severity,
        shortTitle: 'Math symbol used outside math mode',
        explanation:
          'Subscripts (_), superscripts (^), and Greek letters must be wrapped inside $...$ inline math delimiters.',
        rawMessage: raw,
        fixButtonTitle: d.line ? 'Wrap line in $...$' : undefined,
        fixOperation: d.line ? { type: 'wrapLineInMath', lineNumber: d.line } : undefined,
      };
    }

    if (/ExplSyntaxOn.*ExplSyntaxOff|outside \\ExplSyntaxOn/i.test(msg)) {
      return {
        id: d.id,
        line: d.line,
        severity: d.severity,
        shortTitle: 'LaTeX3 (expl3) command outside ExplSyntax block',
        explanation:
          'expl3 functions contain underscores and colons (e.g., \\tl_set:Nn) and must be enclosed between \\ExplSyntaxOn and \\ExplSyntaxOff.',
        rawMessage: raw,
      };
    }

    if (/Missing \\end\{document\}/i.test(msg)) {
      return {
        id: d.id,
        line: d.line,
        severity: d.severity,
        shortTitle: 'Document is missing \\end{document}',
        explanation: 'Every LaTeX file needs \\end{document} at the end of the body.',
        rawMessage: raw,
        fixButtonTitle: 'Append \\end{document}',
        fixOperation: { type: 'insertRawSnippet', snippet: '\\end{document}\n' },
      };
    }

    return {
      id: d.id,
      line: d.line,
      severity: d.severity,
      shortTitle: msg,
      explanation: 'Review the indicated line in your LaTeX source for syntax or environment mismatches.',
      rawMessage: raw,
    };
  });
}
