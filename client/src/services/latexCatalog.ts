import type {
  CTANFontPreset,
  LaTeXPackageInfo,
  LaTeXSnippet,
  LaTeXTemplate,
  PaperSetupConfig,
} from '@shared/types/index.js';
import { AcademicSanitizer } from './academicToolsGenerator.js';

export const LATEX_TEMPLATES: LaTeXTemplate[] = [
  {
    id: 'expl3-showcase',
    title: 'LaTeX3 (expl3 + xparse) Showcase',
    subtitle: 'Modern expl3 token lists, integer evaluation & xparse commands',
    category: 'LaTeX3 Core',
    badge: 'LaTeX3',
    source: `\\documentclass[11pt,letterpaper]{article}
\\usepackage{expl3,xparse}
\\usepackage{amsmath,booktabs,graphicx}

\\ExplSyntaxOn
\\tl_new:N \\l_latexap_tagline_tl
\\tl_set:Nn \\l_latexap_tagline_tl { Modern~LaTeX3~Authoring~in~the~Browser }
\\int_new:N \\l_latexap_iter_int
\\int_set:Nn \\l_latexap_iter_int { 3 + 4 }

\\NewDocumentCommand{\\LaTeXaPTagline}{}{\\tl_use:N \\l_latexap_tagline_tl}
\\NewDocumentCommand{\\ShowComputedValue}{}{\\int_eval:n { \\l_latexap_iter_int * 6 }}
\\ExplSyntaxOff

\\title{LaTeX3 (\\texttt{expl3} + \\texttt{xparse}) Studio Showcase}
\\author{Ada Lovelace}
\\date{\\today}

\\begin{document}
\\maketitle

\\begin{abstract}
\\LaTeXaPTagline{}. This document demonstrates native \\texttt{expl3} variable expansion, arithmetic evaluation (\\ShowComputedValue{}), mathematical typesetting, and \\texttt{booktabs} tables compiled directly inside your browser.
\\end{abstract}

\\section{Programmatic LaTeX3 Macros}
Our macro engine evaluates \\texttt{expl3} expressions cleanly: $7 \\times 6 = \\ShowComputedValue{}$ and renders crisp equations:
\\begin{equation}
  \\mathcal{L}(\\theta) = \\sum_{i=1}^{n} \\left(y_i - f_{\\theta}(x_i)\\right)^2 + \\lambda \\|\\theta\\|_2^2
\\end{equation}

\\section{Empirical Results}
\\begin{table}[htbp]
  \\centering
  \\caption{Benchmark comparison across authoring pipelines.}
  \\label{tab:benchmark}
  \\begin{tabular}{lcr}
    \\toprule
    \\textbf{Pipeline} & \\textbf{Target} & \\textbf{Latency (ms)} \\\\
    \\midrule
    Remote Queue & Server TeX & 1840 \\\\
    LaTeXaP-WeB & Browser Worker & 42 \\\\
    \\bottomrule
  \\end{tabular}
\\end{table}

\\end{document}
`,
  },
  {
    id: 'academic-paper',
    title: 'General Academic Paper',
    subtitle: 'Clean article layout with abstract, sections, math & bibliography',
    category: 'Academic Papers',
    badge: 'Article',
    source: `\\documentclass[11pt,letterpaper]{article}
\\usepackage{amsmath,amssymb,booktabs,graphicx,hyperref}

\\title{Structured Reasoning in Modern Scientific Workflows}
\\author{Research Author \\\\ Department of Computer Science}
\\date{\\today}

\\begin{document}
\\maketitle

\\begin{abstract}
We investigate reproducible authoring workflows combining structured markup, programmatic macros, and automated citation verification.
\\end{abstract}

\\section{Introduction}
Scientific manuscripts benefit from deterministic typesetting and clear separation between content and presentation \\cite{knuth1984texbook}.

\\section{Methodology}
Consider the objective function minimized over parameter space $\\Theta$:
\\begin{equation}
  J(\\theta) = \\frac{1}{N} \\sum_{i=1}^{N} \\ell(y_i, \\hat{y}_i)
\\end{equation}

\\section{Conclusion}
Browser-native compilation lowers friction while preserving rigorous publication standards.

\\end{document}
`,
    defaultBib: `@book{knuth1984texbook,
  author = {Knuth, Donald E.},
  title = {The TeXbook},
  year = {1984},
  publisher = {Addison-Wesley}
}
`,
  },
  {
    id: 'apa7-student',
    title: 'APA 7th Edition Student Paper',
    subtitle: 'Double-spaced US Letter manuscript with APA citations',
    category: 'Academic Papers',
    badge: 'APA 7',
    source: `\\documentclass[12pt,letterpaper]{article}
\\usepackage{setspace}
\\usepackage[style=authoryear]{biblatex}
\\usepackage{amsmath,booktabs,graphicx}
\\doublespacing

\\title{Cognitive Load in Interactive Document Environments}
\\author{Student Researcher \\\\ University Department of Psychology}
\\date{\\today}

\\begin{document}
\\maketitle

\\begin{abstract}
This paper examines how live visual feedback affects writing fluency and revision accuracy among university students.
\\end{abstract}

\\section{Literature Review}
Prior studies highlight the value of immediate structural feedback during academic composition \\parencite{knuth1984texbook}.

\\section{Method}
Participants completed structured editing tasks across controlled sessions.

\\section{Results and Discussion}
Mean completion times improved substantially with inline diagnostic explanations.

\\end{document}
`,
  },
  {
    id: 'ieee-conference',
    title: 'IEEE Conference Paper',
    subtitle: 'Two-column engineering paper with IEEE numeric citations',
    category: 'Academic Papers',
    badge: 'IEEE',
    source: `\\documentclass[10pt,twocolumn,letterpaper]{article}
\\usepackage{amsmath,amssymb,booktabs,graphicx}
\\usepackage[style=ieee]{biblatex}

\\title{Low-Latency Client-Side Typesetting via WebAssembly Workers}
\\author{Jane Engineer and Alan Researcher}
\\date{\\today}

\\begin{document}
\\maketitle

\\begin{abstract}
We present a browser-resident compilation architecture that eliminates server queueing latency for technical manuscripts.
\\end{abstract}

\\section{Introduction}
Real-time feedback loops in technical writing require sub-second compilation cycles \\cite{knuth1984texbook}.

\\section{System Architecture}
Our Web Worker isolates parsing, macro expansion, and PDF binary emission from the UI thread.

\\section{Evaluation}
Experimental measurements confirm consistent sub-100 ms incremental builds.

\\end{document}
`,
  },
  {
    id: 'acm-article',
    title: 'ACM Computing Article',
    subtitle: 'ACM conference/journal manuscript starter',
    category: 'Academic Papers',
    badge: 'ACM',
    source: `\\documentclass[11pt,letterpaper]{article}
\\usepackage{amsmath,booktabs,graphicx,hyperref}
\\usepackage[style=numeric]{biblatex}

\\title{Verifiable Cloud Workspaces for Collaborative Research}
\\author{ACM Author}
\\date{\\today}

\\begin{document}
\\maketitle

\\begin{abstract}
We formalize versioned project snapshots and conflict-free recovery for multi-user document editing.
\\end{abstract}

\\section{Introduction}
Modern research teams rely on transparent revision logs and deterministic exports.

\\section{Design}
Each save operation hashes modified artifacts and produces an immutable snapshot manifest.

\\end{document}
`,
  },
  {
    id: 'mla-essay',
    title: 'MLA Humanities Essay',
    subtitle: 'Double-spaced essay formatted for Humanities & Literature',
    category: 'Academic Papers',
    badge: 'MLA',
    source: `\\documentclass[12pt,letterpaper]{article}
\\usepackage{setspace}
\\usepackage[style=mla]{biblatex}
\\doublespacing

\\title{Rhetorical Structure in Digital Archives}
\\author{Humanities Scholar}
\\date{\\today}

\\begin{document}
\\maketitle

\\section{Close Reading and Context}
Digital archives reshape how readers navigate primary texts and critical commentary.

\\section{Analysis}
By preserving provenance alongside commentary, scholarly editions gain enduring clarity.

\\end{document}
`,
  },
  {
    id: 'stem-lab-report',
    title: 'STEM Lab Report',
    subtitle: 'Experimental apparatus, SI units, data table & pgfplots chart',
    category: 'STEM & Theses',
    badge: 'STEM',
    source: `\\documentclass[11pt,letterpaper]{article}
\\usepackage{amsmath,booktabs,siunitx,pgfplots,graphicx}

\\title{Harmonic Oscillator Damping Constant Measurement}
\\author{Physics 201 Lab Group}
\\date{\\today}

\\begin{document}
\\maketitle

\\begin{abstract}
We measure the exponential decay constant of a damped harmonic oscillator across five trial intervals.
\\end{abstract}

\\section{Experimental Setup}
Mass $m = 0.250\\,\\text{kg}$ was displaced by $x_0 = 0.12\\,\\text{m}$ and tracked over time.

\\section{Observed Data}
\\begin{figure}[htbp]
  \\centering
  \\begin{tikzpicture}
    \\begin{axis}[
      title={Amplitude Decay Over Time},
      xlabel={Time (s)},
      ylabel={Amplitude (cm)},
      grid=major
    ]
    \\addplot coordinates {
      (0, 12.0)
      (1, 8.9)
      (2, 6.4)
      (3, 4.7)
      (4, 3.4)
    };
    \\end{axis}
  \\end{tikzpicture}
  \\caption{Measured oscillation amplitude decay.}
  \\label{fig:decay}
\\end{figure}

\\end{document}
`,
  },
  {
    id: 'university-thesis',
    title: 'University Thesis / Dissertation',
    subtitle: 'Multi-chapter dissertation structure with frontmatter',
    category: 'STEM & Theses',
    badge: 'Thesis',
    source: `\\documentclass[12pt,letterpaper]{report}
\\usepackage{amsmath,amssymb,booktabs,graphicx,hyperref}

\\title{Foundations of Browser-Native Document Compilation}
\\author{Doctoral Candidate}
\\date{\\today}

\\begin{document}
\\maketitle

\\begin{abstract}
This dissertation investigates deterministic client-side typesetting architectures and cloud snapshot models.
\\end{abstract}

\\chapter{Introduction}
We motivate local-first compilation paired with encrypted multi-tenant object storage.

\\section{Contributions}
This thesis contributes a unified AST-to-PDF pipeline with bidirectional SyncTeX mapping.

\\chapter{Related Work}
We survey classical TeX engines alongside modern WebAssembly ports.

\\end{document}
`,
  },
  {
    id: 'python-scientific',
    title: 'Python & Scientific Computing',
    subtitle: 'Code listings, numerical analysis equations & plots',
    category: 'STEM & Theses',
    badge: 'SciPy',
    source: `\\documentclass[11pt,letterpaper]{article}
\\usepackage{amsmath,listings,booktabs,pgfplots}

\\title{Numerical Integration of Stiff ODE Systems}
\\author{Computational Science Lab}
\\date{\\today}

\\begin{document}
\\maketitle

\\section{Runge-Kutta Formulation}
We solve $\\frac{dy}{dt} = -15 y$ using an implicit step:
\\begin{equation}
  y_{n+1} = \\frac{y_n}{1 + 15 h}
\\end{equation}

\\section{Reference Implementation}
\\begin{verbatim}
def implicit_euler(y0, h, steps):
    y = y0
    for _ in range(steps):
        y = y / (1.0 + 15.0 * h)
    return y
\\end{verbatim}

\\end{document}
`,
  },
  {
    id: 'tikz-graphics',
    title: 'TikZ & PGFPlots Graphics',
    subtitle: 'Vector diagrams and publication-quality plots',
    category: 'LaTeX3 Core',
    badge: 'TikZ',
    source: `\\documentclass[11pt,letterpaper]{article}
\\usepackage{tikz,pgfplots,amsmath}

\\title{Vector Visualization with TikZ and PGFPlots}
\\author{Graphics Author}
\\date{\\today}

\\begin{document}
\\maketitle

\\section{Convergence Curve}
\\begin{figure}[htbp]
  \\centering
  \\begin{tikzpicture}
    \\begin{axis}[
      title={Training Loss Convergence},
      xlabel={Epoch},
      ylabel={Loss},
      grid=major
    ]
    \\addplot coordinates {
      (1, 1.42)
      (2, 0.94)
      (3, 0.63)
      (4, 0.45)
      (5, 0.34)
    };
    \\end{axis}
  \\end{tikzpicture}
  \\caption{Training loss across five epochs.}
  \\label{fig:tikz-conv}
\\end{figure}

\\end{document}
`,
  },
  {
    id: 'beamer-slides',
    title: 'Beamer Presentation Slides',
    subtitle: 'Clean slide deck with frames, bullets & equations',
    category: 'STEM & Theses',
    badge: 'Slides',
    source: `\\documentclass{beamer}
\\usepackage{amsmath,booktabs}

\\title{LaTeXaP-WeB Architecture Overview}
\\author{Engineering Team}
\\date{\\today}

\\begin{document}

\\begin{frame}{System Pillars}
\\begin{itemize}
  \\item Multi-user Google Authentication with HttpOnly JWT sessions
  \\item Backblaze B2 cloud project storage with immutable snapshots
  \\item Client-side Browser Web Worker PDF rendering and SyncTeX
\\end{itemize}
\\end{frame}

\\begin{frame}{Performance Summary}
Incremental builds complete in under $50\\,\\text{ms}$ directly in the browser without server queues.
\\end{frame}

\\end{document}
`,
  },
];

export const CTAN_PACKAGES: LaTeXPackageInfo[] = [
  { name: 'expl3', category: 'LaTeX3 Core', description: 'LaTeX3 programming layer (l3kernel)', isExpl3: true },
  { name: 'xparse', category: 'LaTeX3 Core', description: 'High-level document command & environment parser', isExpl3: true },
  { name: 'amsmath', category: 'Mathematics', description: 'AMS mathematical environments (align, equation, cases)' },
  { name: 'mathtools', category: 'Mathematics', description: 'Extensions to amsmath with paired delimiters' },
  { name: 'amssymb', category: 'Mathematics', description: 'Extended AMS math symbols and blackboard bold' },
  { name: 'siunitx', category: 'Mathematics', description: 'Consistent SI unit and numeric uncertainty formatting' },
  { name: 'booktabs', category: 'Tables & Graphics', description: 'Publication-quality horizontal rules for tables' },
  { name: 'graphicx', category: 'Tables & Graphics', description: 'Image inclusion via \\includegraphics' },
  { name: 'subcaption', category: 'Tables & Graphics', description: 'Side-by-side subfigures and subcaptions' },
  { name: 'tikz', category: 'Tables & Graphics', description: 'Programmable vector graphics in TeX' },
  { name: 'pgfplots', category: 'Tables & Graphics', description: '2D/3D plots from CSV or coordinate data' },
  { name: 'biblatex', category: 'Citations & Refs', description: 'Modern bibliography management with APA/IEEE/MLA' },
  { name: 'cleveref', category: 'Citations & Refs', description: 'Intelligent cross-references (\\cref)' },
  { name: 'hyperref', category: 'Citations & Refs', description: 'Hyperlinks, PDF bookmarks, and clickable DOIs' },
  { name: 'fontspec', category: 'Typography', description: 'System & custom TTF/OTF font selection for XeTeX/LuaTeX' },
  { name: 'setspace', category: 'Typography', description: 'Single, 1.5x, and double line spacing controls' },
  { name: 'lineno', category: 'Review & Layout', description: 'Margin line numbers for peer-review submissions' },
  { name: 'geometry', category: 'Review & Layout', description: 'Flexible page margins and paper dimensions', defaultOptions: 'margin=1in' },
  { name: 'microtype', category: 'Typography', description: 'Subtle optical protrusion and font expansion' },
  { name: 'listings', category: 'Code & Prose', description: 'Syntax-highlighted source code listings' },
  { name: 'enumitem', category: 'Code & Prose', description: 'Customizable itemize and enumerate lists' },
];

export const CTAN_FONT_PRESETS: CTANFontPreset[] = [
  {
    id: 'libertinus',
    name: 'Libertinus Serif',
    packageName: 'libertinus',
    options: '',
    classification: 'Serif (Academic)',
    description: 'Clean OpenType serif family widely used in CS and mathematics papers.',
    usepackageStatement: '\\usepackage{libertinus}',
  },
  {
    id: 'ebgaramond',
    name: 'EB Garamond',
    packageName: 'ebgaramond',
    options: '',
    classification: 'Serif (Humanities)',
    description: 'Classic Renaissance humanist serif ideal for monographs and essays.',
    usepackageStatement: '\\usepackage{ebgaramond}',
  },
  {
    id: 'fira',
    name: 'Fira Sans & Mono',
    packageName: 'FiraSans',
    options: 'sfdefault',
    classification: 'Sans + Mono',
    description: 'Crisp geometric sans-serif and monospace pairing for slides and lab reports.',
    usepackageStatement: '\\usepackage[sfdefault]{FiraSans}',
  },
  {
    id: 'plex',
    name: 'IBM Plex',
    packageName: 'plex-serif',
    options: '',
    classification: 'Technical Family',
    description: 'Modern engineered serif/sans/mono suite for technical reports.',
    usepackageStatement: '\\usepackage{plex-serif}',
  },
  {
    id: 'lmodern',
    name: 'Latin Modern',
    packageName: 'lmodern',
    options: '',
    classification: 'Classic TeX',
    description: 'High-resolution PostScript/OpenType successor to Computer Modern.',
    usepackageStatement: '\\usepackage{lmodern}',
  },
  {
    id: 'tgpagella',
    name: 'TeX Gyre Pagella',
    packageName: 'tgpagella',
    options: '',
    classification: 'Serif (Palatino)',
    description: 'Warm, readable Palatino-inspired text typeface.',
    usepackageStatement: '\\usepackage{tgpagella}',
  },
];

export const LATEX3_SNIPPETS: LaTeXSnippet[] = [
  {
    id: 'xparse-command',
    title: '\\NewDocumentCommand (xparse)',
    category: 'xparse',
    description: 'Define a modern command with optional and mandatory arguments.',
    code: `\\NewDocumentCommand{\\Highlight}{ O{blue} m }{\\textbf{#2}}`,
    cursorBacktrackOffset: 1,
  },
  {
    id: 'expl3-block',
    title: 'ExplSyntax Block + Token List',
    category: 'expl3',
    description: 'Declare and populate an expl3 token list variable.',
    code: `\\ExplSyntaxOn\n\\tl_new:N \\l_my_note_tl\n\\tl_set:Nn \\l_my_note_tl { Hello~LaTeX3 }\n\\ExplSyntaxOff\n`,
  },
  {
    id: 'expl3-seq',
    title: 'Sequence Map (l3seq)',
    category: 'l3seq',
    description: 'Iterate over a comma-separated sequence using \\seq_map_inline:Nn.',
    code: `\\ExplSyntaxOn\n\\seq_new:N \\l_items_seq\n\\seq_set_from_clist:Nn \\l_items_seq { Alpha, Beta, Gamma }\n\\seq_map_inline:Nn \\l_items_seq { \\item #1 }\n\\ExplSyntaxOff\n`,
  },
  {
    id: 'expl3-int-fp',
    title: 'Integer & FP Evaluation',
    category: 'l3int',
    description: 'Evaluate exact integer or floating-point arithmetic inline.',
    code: `\\int_eval:n { 12 * 4 + 2 }`,
  },
  {
    id: 'expl3-keys',
    title: 'Key-Value Options (l3keys)',
    category: 'l3keys',
    description: 'Define structured module keys with defaults and choices.',
    code: `\\ExplSyntaxOn\n\\keys_define:nn { mymodule }\n  {\n    color .tl_set:N = \\l_mymodule_color_tl,\n    color .initial:n = { navy },\n  }\n\\ExplSyntaxOff\n`,
  },
];

export function generatePaperSetupDocument(config: PaperSetupConfig): string {
  const baseTemplate = LATEX_TEMPLATES.find((t) => t.id === config.templateId) ?? LATEX_TEMPLATES[0];
  const fontPt = Math.min(12, Math.max(10, config.baseFontSizePt || 11));
  const paperOpt = config.paperSize === 'a4paper' ? 'a4paper' : 'letterpaper';
  const docClass = config.templateId === 'university-thesis' ? 'report' : config.templateId === 'beamer-slides' ? 'beamer' : 'article';
  const twoCol = config.templateId === 'ieee-conference' ? ',twocolumn' : '';
  const authorLine = config.anonymizedBlindReview
    ? 'Anonymous Author(s) \\\\ Blind Review Submission'
    : [
        AcademicSanitizer.escapeLaTeXText(config.author || 'Author Name'),
        config.institution ? AcademicSanitizer.escapeLaTeXText(config.institution) : '',
        config.courseOrVenue ? AcademicSanitizer.escapeLaTeXText(config.courseOrVenue) : '',
      ]
        .filter((s) => s.length > 0)
        .join(' \\\\ ');

  const extraPackages: string[] = ['amsmath', 'amssymb', 'booktabs', 'graphicx', 'hyperref'];
  const spacingLine =
    config.doubleSpacing || config.lineSpacing === 'double'
      ? '\\usepackage{setspace}\n\\doublespacing\n'
      : config.lineSpacing === 'onehalf'
        ? '\\usepackage{setspace}\n\\onehalfspacing\n'
        : '';
  const linenoLine = config.anonymizedBlindReview ? '\\usepackage{lineno}\n\\linenumbers\n' : '';
  const bibOption =
    config.bibliographyStyle === 'apa'
      ? 'authoryear'
      : config.bibliographyStyle === 'chicago'
        ? 'chicago-authordate'
        : config.bibliographyStyle === 'acm'
          ? 'numeric'
          : config.bibliographyStyle;

  const title = AcademicSanitizer.escapeLaTeXText((config.title || baseTemplate.title).trim(), true);
  const rawDate = config.date?.trim();
  const safeDate = !rawDate || rawDate === '\\today' ? '\\today' : AcademicSanitizer.escapeLaTeXText(rawDate);

  return `\\documentclass[${fontPt}pt,${paperOpt}${twoCol}]{${docClass}}
\\usepackage{expl3,xparse}
\\usepackage{${extraPackages.join(',')}}
\\usepackage[style=${bibOption}]{biblatex}
${spacingLine}${linenoLine}
\\title{${title}}
\\author{${authorLine}}
\\date{${safeDate}}

\\begin{document}
\\maketitle

\\begin{abstract}
Summarize the motivation, methodology, and key findings of ${title}.
\\end{abstract}

\\section{Introduction}
Introduce the research problem and state your primary contributions.

\\section{Methodology}
Describe your analytical model, experimental setup, or theoretical framework.

\\section{Results and Discussion}
Present empirical findings, tables, and visual figures.

\\section{Conclusion}
Conclude with implications and directions for future work.

\\end{document}
`;
}
