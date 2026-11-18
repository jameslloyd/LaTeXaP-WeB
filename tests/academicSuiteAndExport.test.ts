import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { runAcademicPreflight } from '../client/src/services/academicPreflight.js';
import {
  AcademicSanitizer,
  generateBooktabsTable,
  generateFigureSnippet,
  generatePGFPlotChart,
} from '../client/src/services/academicToolsGenerator.js';
import { parseBibTeX } from '../client/src/services/bibliographyParser.js';
import { demystifyDiagnostics } from '../client/src/services/contextSuggestions.js';
import { computeAcademicStatistics, lintExpl3 } from '../client/src/services/expl3Linter.js';
import { getLaTeXCompletions } from '../client/src/services/latexAutoComplete.js';
import { parseDocumentOutline } from '../client/src/services/outlineParser.js';
import { checkProseSpelling } from '../client/src/services/spellCheckService.js';
import { buildSubmissionZipBundle } from '../client/src/services/submissionExport.js';

describe('Academic Suite, Expl3 Linter, Demystifier, Spellcheck & Zip Export', () => {
  it('lints expl3 usage, respects Student Mode, and computes prose statistics', () => {
    const tex = `\\documentclass{article}
\\begin{document}
\\begin{abstract}
Short summary here.
\\end{abstract}
\\section{Intro}
\\tl_set:Nn \\l_tmp_tl { outside }
Regular academic prose with five words.
$E = mc^2$
\\end{document}
`;
    const diags = lintExpl3(tex, false);
    expect(diags.some((d) => d.message.includes('outside \\ExplSyntaxOn'))).toBe(true);
    expect(lintExpl3(tex, true)).toHaveLength(0);

    const stats = computeAcademicStatistics(tex, '', 2);
    expect(stats.abstractWordCount).toBe(3);
    expect(stats.proseWordCount).toBeGreaterThanOrEqual(6);
    expect(stats.mathBlockCount).toBe(1);
    expect(stats.pageCount).toBe(2);
  });

  it('demystifies diagnostics with 1-click fixes and flags preflight blockers', () => {
    const tex = `\\documentclass{article}
\\begin{document}
Research & Development \\cite{missing2025} \\ref{sec:missing}
\\includegraphics{/Users/alice/Desktop/secret.png}
\\end{document}
`;
    const demystified = demystifyDiagnostics(
      [
        {
          id: 'd1',
          line: 3,
          severity: 'Error',
          message: 'Misplaced alignment tab character &. Use \\& in prose.',
          rawLine: '! Misplaced alignment tab character &.',
        },
      ],
      tex
    );
    expect(demystified[0].shortTitle).toContain('Unescaped "&"');
    expect(demystified[0].fixOperation?.type).toBe('replaceLine');

    const preflight = runAcademicPreflight(tex, [], [], []);
    expect(preflight.isSubmissionReady).toBe(false);
    expect(preflight.unresolvedCitations).toEqual(['missing2025']);
    expect(preflight.unresolvedReferences).toEqual(['sec:missing']);
    expect(preflight.missingFigurePaths).toContain('/Users/alice/Desktop/secret.png');
  });

  it('sanitizes dangerous TeX primitives and generates booktabs, pgfplots & figures safely', () => {
    const escaped = AcademicSanitizer.escapeLaTeXText('\\write18{evil} A & B 100% $x$');
    expect(escaped).not.toContain('\\write18');
    expect(escaped).toContain('\\&');
    expect(escaped).toContain('\\%');

    const tableTex = generateBooktabsTable({
      headers: ['Method', 'Score'],
      rows: [['Baseline', '80%']],
      alignments: ['l', 'r'],
      boldHeader: true,
      caption: 'Results & Notes',
      label: 'tab:res',
    });
    expect(tableTex).toContain('\\toprule');
    expect(tableTex).toContain('Results \\& Notes');

    const chartTex = generatePGFPlotChart({
      chartType: 'line',
      title: 'Loss Curve',
      xLabel: 'Epoch',
      yLabel: 'Loss',
      csvText: '1, 1.0\n2, 0.5',
      showGrid: true,
      showLegend: false,
      caption: 'Loss',
      label: 'fig:loss',
    });
    expect(chartTex).toContain('\\begin{axis}');
    expect(chartTex).toContain('(1, 1)');

    const figTex = generateFigureSnippet({
      primaryRelativePath: 'figures/a.png',
      secondaryRelativePath: 'figures/b.png',
      widthFraction: 0.8,
      placement: 'htbp',
      caption: 'Comparison',
      label: 'fig:cmp',
      primarySubcaption: 'Left',
      secondarySubcaption: 'Right',
    });
    expect(figTex).toContain('\\begin{subfigure}');
    expect(figTex).toContain('figures/a.png');
    expect(figTex).toContain('figures/b.png');
  });

  it('parses outline, BibTeX, completions, and prose-masked spellcheck', () => {
    const tex = `\\documentclass{article}
\\NewDocumentCommand{\\Highlight}{m}{\\textbf{#1}}
\\begin{document}
\\section{Overview}
\\label{sec:overview}
This documnt has a spelling mistke, while \\tl_set:Nn and $alpha_beta$ are masked.
\\end{document}
`;
    const bib = `@article{smith2024ai,
  author = {Smith, Jane},
  title = {Modern Typesetting},
  year = {2024},
  journal = {JCS}
}`;
    const entries = parseBibTeX(bib);
    expect(entries).toHaveLength(1);
    expect(entries[0].citeKey).toBe('smith2024ai');

    const outline = parseDocumentOutline(tex);
    expect(outline.some((o) => o.title === 'Overview')).toBe(true);
    expect(outline.some((o) => o.title === '\\Highlight')).toBe(true);

    const citeCompletions = getLaTeXCompletions(tex, '\\cite{smi', entries);
    expect(citeCompletions.some((c) => c.label === 'smith2024ai')).toBe(true);

    const refCompletions = getLaTeXCompletions(tex, '\\cref{sec:', entries);
    expect(refCompletions.some((c) => c.label === 'sec:overview')).toBe(true);

    const issues = checkProseSpelling(tex);
    expect(issues.map((i) => i.word)).toContain('documnt');
    expect(issues.map((i) => i.word)).not.toContain('documentclass');
    expect(issues.map((i) => i.word)).not.toContain('alpha');
  });

  it('exports a valid .zip submission bundle with optional comment stripping and anonymization', async () => {
    const tex = `\\documentclass{article}
\\author{Ada Lovelace}
\\begin{document}
% private draft note
Hello world.
\\end{document}
`;
    const result = buildSubmissionZipBundle({
      projectSlug: 'my-paper',
      projectFiles: {
        'main.tex': tex,
        'references.bib': '@misc{a, title={A}}',
      },
      binaryAssets: {
        'figures/fig1.png': new Uint8Array([1, 2, 3, 4]),
      },
      pdfBytes: new Uint8Array([0x25, 0x50, 0x44, 0x46]),
      stripComments: true,
      anonymize: true,
      compiledCleanly: true,
    });

    expect(result.fileName).toBe('my-paper-submission.zip');
    expect(result.includedFiles).toContain('main.tex');
    expect(result.includedFiles).toContain('references.bib');
    expect(result.includedFiles).toContain('figures/fig1.png');
    expect(result.includedFiles).toContain('my-paper.pdf');

    const zipBytes = new Uint8Array(await result.blob.arrayBuffer());
    const unpacked = unzipSync(zipBytes);
    const exportedTex = strFromU8(unpacked['main.tex']);
    expect(exportedTex).not.toContain('Ada Lovelace');
    expect(exportedTex).toContain('Anonymous Author(s)');
    expect(exportedTex).not.toContain('private draft note');
  });
});
