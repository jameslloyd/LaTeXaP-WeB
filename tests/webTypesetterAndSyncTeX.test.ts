import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { parseSyncTeX } from '../client/src/engine/synctexParser.js';
import { compileWithWebTypesetter } from '../client/src/engine/webTypesetter.js';
import { LATEX_TEMPLATES } from '../client/src/services/latexCatalog.js';

const TINY_PNG = Uint8Array.from(
  Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    'base64'
  )
);

describe('Client-Side Web PDF Rendering & Bidirectional SyncTeX', () => {
  it('compiles expl3 + xparse document with math, booktabs table, pgfplots chart, figure, and citations into valid PDF bytes', async () => {
    const tex = `\\documentclass[11pt,letterpaper]{article}
\\usepackage{expl3,xparse,amsmath,booktabs,pgfplots,graphicx}

\\ExplSyntaxOn
\\tl_new:N \\l_demo_title_tl
\\tl_set:Nn \\l_demo_title_tl { Browser~PDF~Engine }
\\NewDocumentCommand{\\DemoTitle}{}{\\tl_use:N \\l_demo_title_tl}
\\NewDocumentCommand{\\ComputedSum}{}{\\int_eval:n { 10 + 32 }}
\\ExplSyntaxOff

\\title{\\DemoTitle{}}
\\author{Ada Lovelace}
\\date{\\today}

\\begin{document}
\\maketitle

\\begin{abstract}
Evaluated sum is \\ComputedSum{}.
\\end{abstract}

\\section{Introduction}
We cite Knuth \\cite{knuth1984} and show an equation:
\\begin{equation}
  E = mc^2
\\end{equation}

\\begin{table}[htbp]
  \\centering
  \\caption{Speed comparison.}
  \\label{tab:speed}
  \\begin{tabular}{lr}
    \\toprule
    Engine & Time \\\\
    \\midrule
    WASM & 42 ms \\\\
    \\bottomrule
  \\end{tabular}
\\end{table}

\\begin{figure}[htbp]
  \\centering
  \\includegraphics[width=0.5\\textwidth]{figures/sample.png}
  \\caption{Sample uploaded figure.}
  \\label{fig:sample}
\\end{figure}

\\begin{figure}[htbp]
  \\centering
  \\begin{tikzpicture}
    \\begin{axis}[title={Loss},xlabel={Epoch},ylabel={Value},grid=major]
    \\addplot coordinates { (1, 1.5) (2, 0.8) (3, 0.3) };
    \\end{axis}
  \\end{tikzpicture}
  \\caption{Convergence curve.}
\\end{figure}

\\end{document}
`;

    const bib = `@book{knuth1984,
  author = {Knuth, Donald E.},
  title = {The TeXbook},
  year = {1984},
  publisher = {Addison-Wesley}
}`;

    const out = await compileWithWebTypesetter({
      mainTex: tex,
      bibContent: bib,
      files: { 'main.tex': tex, 'references.bib': bib },
      binaryAssets: { 'figures/sample.png': TINY_PNG },
      customFonts: [],
    });

    expect(out.engine).toBe('web-typesetter');
    expect(out.diagnostics.filter((d) => d.severity === 'Error')).toHaveLength(0);
    expect(out.pdfBytes).not.toBeNull();
    expect(Buffer.from(out.pdfBytes!.subarray(0, 5)).toString('ascii')).toBe('%PDF-');

    const loaded = await PDFDocument.load(out.pdfBytes!);
    expect(loaded.getPageCount()).toBe(out.pageCount);
    expect(out.pageCount).toBeGreaterThanOrEqual(1);

    // Bidirectional SyncTeX verification
    const synctex = parseSyncTeX(out.synctexText);
    expect(synctex.boxes.length).toBeGreaterThan(5);

    const introLine = tex.split('\n').findIndex((l) => l.includes('\\section{Introduction}')) + 1;
    const forwardBox = synctex.forwardSearch(introLine);
    expect(forwardBox).not.toBeNull();

    const backwardHit = synctex.backwardSearch(
      forwardBox!.page,
      forwardBox!.xPt + 2,
      forwardBox!.yTopPt + 4
    );
    expect(backwardHit).not.toBeNull();
    expect(backwardHit!.line).toBe(introLine);

    // Backward SyncTeX inside figure & chart body (yTopPt is standardized as top-of-box)
    const figLine = tex.split('\n').findIndex((l) => l.includes('\\begin{figure}')) + 1;
    const figBox = synctex.forwardSearch(figLine);
    expect(figBox).not.toBeNull();
    const figHit = synctex.backwardSearch(
      figBox!.page,
      figBox!.xPt + 20,
      figBox!.yTopPt + figBox!.heightPt * 0.5
    );
    expect(figHit).not.toBeNull();
    expect(figHit!.line).toBe(figLine);
  });

  it('expands nested-brace xparse commands and expl3 seq_map_inline without truncating', async () => {
    const tex = `\\documentclass{article}
\\usepackage{expl3,xparse}
\\ExplSyntaxOn
\\NewDocumentCommand{\\Highlight}{m}{\\textbf{Key:~#1}}
\\seq_new:N \\l_demo_seq
\\seq_set_from_clist:Nn \\l_demo_seq { Alpha, Beta }
\\ExplSyntaxOff
\\begin{document}
\\section{Macros}
\\Highlight{Nested}
\\ExplSyntaxOn
\\seq_map_inline:Nn \\l_demo_seq { \\textbf{#1} }
\\ExplSyntaxOff
\\end{document}
`;
    const out = await compileWithWebTypesetter({
      mainTex: tex,
      bibContent: '',
      files: { 'main.tex': tex },
      binaryAssets: {},
      customFonts: [],
    });
    expect(out.diagnostics.filter((d) => d.severity === 'Error')).toHaveLength(0);
    expect(out.pdfBytes).not.toBeNull();
    expect(out.pageCount).toBe(1);
  });

  it('compiles every built-in template cleanly with zero errors', async () => {
    for (const tmpl of LATEX_TEMPLATES) {
      const out = await compileWithWebTypesetter({
        mainTex: tmpl.source,
        bibContent: tmpl.defaultBib ?? '',
        files: { 'main.tex': tmpl.source },
        binaryAssets: {},
        customFonts: [],
      });
      const errors = out.diagnostics.filter((d) => d.severity === 'Error');
      expect(errors, `Template ${tmpl.id} had errors`).toHaveLength(0);
      expect(out.pdfBytes).not.toBeNull();
      expect(out.pageCount).toBeGreaterThanOrEqual(1);
    }
  });

  it('reports line-accurate diagnostics for unclosed braces, environments, and unescaped &', async () => {
    const brokenTex = `\\documentclass{article}
\\begin{document}
Hello & world
\\textbf{unclosed
\\begin{itemize}
\\item One
\\end{document}
`;
    const out = await compileWithWebTypesetter({
      mainTex: brokenTex,
      bibContent: '',
      files: { 'main.tex': brokenTex },
      binaryAssets: {},
      customFonts: [],
    });

    const errors = out.diagnostics.filter((d) => d.severity === 'Error');
    expect(errors.length).toBeGreaterThanOrEqual(3);
    expect(errors.some((e) => e.message.includes('&') && e.line === 3)).toBe(true);
    expect(errors.some((e) => e.message.toLowerCase().includes('brace'))).toBe(true);
    expect(errors.some((e) => e.message.includes('itemize'))).toBe(true);
  });
});
