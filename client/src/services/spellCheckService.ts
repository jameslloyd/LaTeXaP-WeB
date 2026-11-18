import type { SpellingIssue } from '@shared/types/academic.js';

const CORE_ACADEMIC_WORDS = new Set([
  'a', 'about', 'above', 'abstract', 'academic', 'across', 'active', 'actually', 'add', 'added',
  'additional', 'after', 'again', 'against', 'algorithm', 'all', 'allow', 'allows', 'almost',
  'along', 'also', 'although', 'always', 'among', 'an', 'analysis', 'analytical', 'and', 'another',
  'any', 'apparatus', 'approach', 'architecture', 'are', 'argument', 'arguments', 'around', 'article',
  'as', 'at', 'author', 'authors', 'automated', 'automatically', 'available', 'average', 'based',
  'baseline', 'be', 'because', 'been', 'before', 'being', 'below', 'benchmark', 'benefits', 'best',
  'between', 'bibliography', 'blind', 'block', 'body', 'both', 'browser', 'budget', 'build', 'builds',
  'but', 'by', 'can', 'cannot', 'caption', 'case', 'cases', 'chart', 'check', 'checks', 'citation',
  'citations', 'cite', 'cited', 'clarity', 'class', 'clean', 'clear', 'client', 'cloud', 'code',
  'cognitive', 'column', 'columns', 'combined', 'command', 'commands', 'commentary', 'comments',
  'common', 'compare', 'comparison', 'compilation', 'compile', 'compiled', 'compiles', 'complete',
  'completed', 'completely', 'computing', 'conclusion', 'condition', 'conditions', 'conference',
  'conflict', 'consider', 'consistent', 'constant', 'contains', 'content', 'context', 'continuous',
  'contributions', 'controlled', 'convergence', 'core', 'correct', 'could', 'count', 'course',
  'critical', 'cross', 'current', 'custom', 'cycle', 'cycles', 'damped', 'data', 'database', 'date',
  'decay', 'defined', 'demonstrates', 'department', 'describe', 'describes', 'design', 'desktop',
  'detail', 'details', 'deterministic', 'device', 'diagnostic', 'diagnostics', 'diagram', 'diagrams',
  'different', 'digital', 'direct', 'directions', 'discussion', 'displaced', 'display', 'dissertation',
  'do', 'document', 'documents', 'does', 'done', 'double', 'draft', 'draw', 'during', 'each', 'editions',
  'editor', 'editorial', 'education', 'effect', 'effective', 'effects', 'efficient', 'electrical',
  'eliminates', 'embedded', 'empirical', 'enables', 'end', 'engineering', 'enough', 'ensure', 'entries',
  'entry', 'environment', 'environments', 'epoch', 'epochs', 'equation', 'equations', 'error', 'errors',
  'essay', 'evaluation', 'even', 'every', 'evidence', 'exact', 'examine', 'examines', 'example',
  'examples', 'existing', 'expansion', 'experimental', 'experiments', 'expl', 'explanation', 'explicit',
  'export', 'expression', 'expressions', 'extended', 'external', 'factor', 'fast', 'feature', 'features',
  'feedback', 'figure', 'figures', 'file', 'files', 'final', 'find', 'finding', 'findings', 'first',
  'five', 'fluency', 'focus', 'following', 'font', 'fonts', 'for', 'format', 'formatted', 'formulation',
  'found', 'four', 'frame', 'framework', 'from', 'full', 'function', 'functions', 'future', 'gain',
  'general', 'generated', 'given', 'good', 'graphics', 'grid', 'group', 'harmonic', 'has', 'have',
  'header', 'heading', 'here', 'high', 'highlight', 'history', 'how', 'however', 'humanities', 'if',
  'image', 'images', 'immediate', 'immutable', 'implications', 'important', 'improve', 'improved',
  'in', 'include', 'includes', 'including', 'incremental', 'index', 'indicated', 'inline', 'input',
  'insert', 'inside', 'instant', 'institution', 'integer', 'integration', 'interactive', 'into',
  'introduce', 'introduction', 'investigate', 'investigates', 'is', 'issue', 'issues', 'it', 'its',
  'journal', 'key', 'keys', 'known', 'lab', 'label', 'labels', 'language', 'large', 'last', 'latency',
  'latex', 'layout', 'left', 'length', 'less', 'letter', 'level', 'library', 'line', 'lines', 'list',
  'literature', 'live', 'load', 'local', 'log', 'long', 'loss', 'low', 'lower', 'macro', 'macros',
  'main', 'make', 'manuscript', 'manuscripts', 'many', 'margin', 'markup', 'mass', 'math',
  'mathematical', 'mathematics', 'matrix', 'max', 'may', 'mean', 'measure', 'measured', 'measurement',
  'measurements', 'method', 'methodology', 'methods', 'metric', 'minimized', 'missing', 'mode',
  'model', 'models', 'modern', 'module', 'more', 'most', 'motivate', 'motivation', 'multi', 'multiple',
  'must', 'name', 'namespace', 'native', 'natural', 'near', 'need', 'needs', 'network', 'new', 'next',
  'no', 'non', 'none', 'normal', 'not', 'note', 'number', 'numbered', 'numbers', 'numeric', 'numerical',
  'objective', 'observed', 'of', 'off', 'often', 'on', 'one', 'only', 'open', 'optional', 'or', 'order',
  'oscillation', 'oscillator', 'other', 'others', 'our', 'out', 'output', 'over', 'overall', 'overview',
  'own', 'package', 'packages', 'page', 'pages', 'paired', 'paper', 'papers', 'parameter', 'part',
  'participants', 'pass', 'path', 'paths', 'performance', 'physics', 'pillars', 'pipeline', 'pipelines',
  'place', 'plain', 'plot', 'plots', 'point', 'points', 'portable', 'position', 'possible', 'preamble',
  'preflight', 'present', 'presentation', 'presents', 'preserve', 'preserving', 'preview', 'previous',
  'primary', 'prior', 'problem', 'process', 'programmatic', 'project', 'projects', 'proof', 'proposed',
  'prose', 'provenance', 'provide', 'provides', 'psychology', 'publication', 'quality', 'queue',
  'queues', 'quick', 'range', 'rate', 'read', 'ready', 'real', 'reasoning', 'recent', 'record',
  'recovery', 'reduce', 'reference', 'references', 'region', 'relative', 'related', 'reliable', 'rely',
  'remote', 'render', 'rendered', 'rendering', 'report', 'reproducible', 'require', 'required',
  'requires', 'research', 'researcher', 'resolution', 'resolved', 'response', 'restore', 'result',
  'results', 'review', 'revision', 'revisions', 'rhetorical', 'right', 'rigorous', 'role', 'row',
  'rows', 'rubric', 'rule', 'rules', 'run', 'runs', 'safe', 'same', 'sample', 'save', 'saved', 'saving',
  'scatter', 'scholar', 'scholarly', 'science', 'sciences', 'scientific', 'search', 'second', 'section',
  'sections', 'see', 'select', 'selected', 'separation', 'sequence', 'series', 'server', 'service',
  'session', 'sessions', 'set', 'setup', 'several', 'should', 'show', 'showing', 'shows', 'side',
  'sign', 'simple', 'single', 'size', 'skeleton', 'slide', 'slides', 'small', 'snapshot', 'snapshots',
  'so', 'social', 'software', 'solution', 'solve', 'some', 'source', 'space', 'spacing', 'specific',
  'spellcheck', 'split', 'standard', 'standards', 'start', 'state', 'stated', 'statistics', 'status',
  'stem', 'step', 'steps', 'stiff', 'storage', 'store', 'stored', 'string', 'strings', 'structure',
  'structured', 'student', 'students', 'studies', 'study', 'style', 'styles', 'sub', 'submission',
  'subsection', 'such', 'summarize', 'summary', 'support', 'supports', 'surface', 'survey', 'switch',
  'symbol', 'symbols', 'sync', 'synctex', 'syntax', 'system', 'systems', 'table', 'tables', 'tabular',
  'target', 'targets', 'task', 'tasks', 'team', 'technical', 'template', 'templates', 'test', 'testing',
  'tex', 'text', 'texts', 'than', 'that', 'the', 'their', 'them', 'theme', 'then', 'theoretical',
  'there', 'these', 'thesis', 'they', 'this', 'those', 'three', 'through', 'time', 'times', 'title',
  'to', 'today', 'token', 'toolbar', 'tools', 'top', 'tracked', 'training', 'trial', 'two', 'type',
  'typesetting', 'under', 'unit', 'units', 'university', 'unlike', 'unresolved', 'until', 'up', 'update',
  'upload', 'uploaded', 'upon', 'us', 'usage', 'use', 'used', 'user', 'users', 'using', 'valid',
  'validation', 'value', 'values', 'variable', 'variables', 'vector', 'venue', 'verifiable',
  'verification', 'version', 'versions', 'via', 'visual', 'visualization', 'warning', 'warnings', 'was',
  'way', 'we', 'web', 'webassembly', 'welcome', 'well', 'were', 'what', 'when', 'where', 'whether',
  'which', 'while', 'who', 'whole', 'whose', 'why', 'wide', 'widely', 'width', 'will', 'with',
  'within', 'without', 'word', 'words', 'work', 'worker', 'workers', 'workflow', 'workflows',
  'workspace', 'workspaces', 'write', 'writer', 'writing', 'written', 'xparse', 'year', 'years', 'yet',
  'you', 'your', 'zero', 'zip',
  'latexap', 'backblaze', 'crossref', 'arxiv', 'isbn', 'doi', 'bibtex', 'biblatex', 'pgfplots',
  'booktabs', 'siunitx', 'fontspec', 'beamer', 'tikz', 'wasm', 'http', 'https', 'json', 'pdf',
]);

const DICT_ARRAY = Array.from(CORE_ACADEMIC_WORDS);

function levenshtein(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 3) return 99;
  const dp: number[] = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let prev = i - 1;
    dp[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const temp = dp[j];
      if (a[i - 1] === b[j - 1]) {
        dp[j] = prev;
      } else {
        dp[j] = 1 + Math.min(prev, dp[j], dp[j - 1]);
      }
      prev = temp;
    }
  }
  return dp[b.length];
}

function suggestCorrections(word: string): string[] {
  const lower = word.toLowerCase();
  const scored: Array<{ word: string; dist: number }> = [];
  for (const candidate of DICT_ARRAY) {
    if (Math.abs(candidate.length - lower.length) > 2) continue;
    const dist = levenshtein(lower, candidate);
    if (dist <= 2) {
      scored.push({ word: candidate, dist });
    }
  }
  scored.sort((a, b) => a.dist - b.dist || a.word.localeCompare(b.word));
  return scored.slice(0, 4).map((s) => s.word);
}

/**
 * Masks out LaTeX preamble, comments, ExplSyntax blocks, math, and commands with spaces
 * of identical length so character offsets remain 100% aligned with `source`.
 */
function buildProseMask(source: string): string {
  const chars = Array.from(source);
  const blankRange = (start: number, end: number) => {
    for (let i = Math.max(0, start); i < Math.min(chars.length, end); i += 1) {
      if (chars[i] !== '\n') chars[i] = ' ';
    }
  };

  const docStart = source.indexOf('\\begin{document}');
  if (docStart >= 0) {
    blankRange(0, docStart + '\\begin{document}'.length);
  }
  const docEnd = source.lastIndexOf('\\end{document}');
  if (docEnd >= 0) {
    blankRange(docEnd, source.length);
  }

  const maskRegex = (re: RegExp) => {
    for (const m of source.matchAll(re)) {
      const idx = m.index ?? 0;
      blankRange(idx, idx + m[0].length);
    }
  };

  maskRegex(/(?<!\\)%.*$/gm);
  maskRegex(/\\ExplSyntaxOn[\s\S]*?\\ExplSyntaxOff/g);
  maskRegex(/\\begin\{(?:equation|align|gather|tabular|tabularx|tikzpicture|verbatim|lstlisting)\*?\}[\s\S]*?\\end\{(?:equation|align|gather|tabular|tabularx|tikzpicture|verbatim|lstlisting)\*?\}/g);
  maskRegex(/\\\[[\s\S]*?\\\]/g);
  maskRegex(/\$\$[\s\S]*?\$\$/g);
  maskRegex(/\$[^$\n]*\$/g);
  maskRegex(/\\(?:cite|parencite|textcite|autocite|footcite|ref|cref|Cref|eqref|label|usepackage|documentclass|includegraphics|begin|end|bibliographystyle|bibliography)(?:\[[^\]]*\])?\{[^}]*\}/g);
  maskRegex(/\\[a-zA-Z@_:]+(?:\[[^\]]*\])?/g);

  return chars.join('');
}

export function checkProseSpelling(
  source: string,
  ignoredWords: Set<string> = new Set(),
  extraKnownWords: Set<string> = new Set()
): SpellingIssue[] {
  if (!source.trim()) return [];
  const masked = buildProseMask(source);
  const issues: SpellingIssue[] = [];

  // Precompute line start offsets
  const lineStarts: number[] = [0];
  for (let i = 0; i < source.length; i += 1) {
    if (source[i] === '\n') lineStarts.push(i + 1);
  }
  const offsetToLineCol = (offset: number): { line: number; column: number } => {
    let lo = 0;
    let hi = lineStarts.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (lineStarts[mid] <= offset) lo = mid + 1;
      else hi = mid - 1;
    }
    const lineIdx = Math.max(0, hi);
    return { line: lineIdx + 1, column: offset - lineStarts[lineIdx] + 1 };
  };

  const wordRe = /\b[a-zA-Z]{3,}\b/g;
  for (const m of masked.matchAll(wordRe)) {
    const word = m[0];
    const lower = word.toLowerCase();
    // Skip CamelCase / ALLCAPS acronyms
    if (word === word.toUpperCase() || /[a-z][A-Z]/.test(word)) continue;
    if (
      CORE_ACADEMIC_WORDS.has(lower) ||
      ignoredWords.has(lower) ||
      extraKnownWords.has(lower)
    ) {
      continue;
    }

    const startOffset = m.index ?? 0;
    const endOffset = startOffset + word.length;
    const { line, column } = offsetToLineCol(startOffset);
    issues.push({
      id: `spell-${startOffset}-${word}`,
      word,
      line,
      column,
      startOffset,
      endOffset,
      suggestions: suggestCorrections(word),
    });
  }

  return issues;
}
