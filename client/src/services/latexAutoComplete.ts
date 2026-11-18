import type { BibEntry } from '@shared/types/academic.js';
import { CTAN_PACKAGES } from './latexCatalog.js';
import { extractDocumentLabels } from './bibliographyParser.js';

export interface LaTeXCompletionItem {
  label: string;
  apply: string;
  type: 'expl3' | 'xparse' | 'environment' | 'package' | 'citation' | 'label' | 'macro' | 'command';
  detail?: string;
}

const EXPL3_AND_CORE_COMMANDS: Array<{ label: string; apply: string; type: LaTeXCompletionItem['type']; detail: string }> = [
  { label: '\\ExplSyntaxOn', apply: '\\ExplSyntaxOn\n', type: 'expl3', detail: 'Enter LaTeX3 syntax mode' },
  { label: '\\ExplSyntaxOff', apply: '\\ExplSyntaxOff\n', type: 'expl3', detail: 'Exit LaTeX3 syntax mode' },
  { label: '\\NewDocumentCommand', apply: '\\NewDocumentCommand{\\cmd}{ m }{#1}', type: 'xparse', detail: 'Define xparse command' },
  { label: '\\NewDocumentEnvironment', apply: '\\NewDocumentEnvironment{env}{ m }{}{}', type: 'xparse', detail: 'Define xparse environment' },
  { label: '\\tl_new:N', apply: '\\tl_new:N \\l_tmp_tl', type: 'expl3', detail: 'Allocate token list' },
  { label: '\\tl_set:Nn', apply: '\\tl_set:Nn \\l_tmp_tl {}', type: 'expl3', detail: 'Assign token list' },
  { label: '\\tl_use:N', apply: '\\tl_use:N \\l_tmp_tl', type: 'expl3', detail: 'Expand token list' },
  { label: '\\int_eval:n', apply: '\\int_eval:n { }', type: 'expl3', detail: 'Evaluate integer expression' },
  { label: '\\fp_eval:n', apply: '\\fp_eval:n { }', type: 'expl3', detail: 'Evaluate floating-point expression' },
  { label: '\\seq_set_from_clist:Nn', apply: '\\seq_set_from_clist:Nn \\l_tmp_seq { a, b }', type: 'expl3', detail: 'Populate sequence from clist' },
  { label: '\\seq_map_inline:Nn', apply: '\\seq_map_inline:Nn \\l_tmp_seq { #1 }', type: 'expl3', detail: 'Map over sequence' },
  { label: '\\section', apply: '\\section{}', type: 'command', detail: 'Section heading' },
  { label: '\\subsection', apply: '\\subsection{}', type: 'command', detail: 'Subsection heading' },
  { label: '\\textbf', apply: '\\textbf{}', type: 'command', detail: 'Bold text' },
  { label: '\\textit', apply: '\\textit{}', type: 'command', detail: 'Italic text' },
  { label: '\\emph', apply: '\\emph{}', type: 'command', detail: 'Emphasized text' },
  { label: '\\frac', apply: '\\frac{}{}', type: 'command', detail: 'Math fraction' },
  { label: '\\cite', apply: '\\cite{}', type: 'command', detail: 'Citation reference' },
  { label: '\\parencite', apply: '\\parencite{}', type: 'command', detail: 'Parenthetical citation' },
  { label: '\\cref', apply: '\\cref{}', type: 'command', detail: 'Smart cross-reference' },
  { label: '\\includegraphics', apply: '\\includegraphics[width=0.8\\textwidth]{figures/}', type: 'command', detail: 'Embed figure' },
];

const ENVIRONMENTS = [
  'document', 'abstract', 'equation', 'align', 'itemize', 'enumerate',
  'figure', 'table', 'tabular', 'tikzpicture', 'axis', 'verbatim', 'frame',
];

export function getLaTeXCompletions(
  sourceText: string,
  linePrefix: string,
  bibEntries: BibEntry[]
): LaTeXCompletionItem[] {
  const citeMatch = linePrefix.match(/\\(?:cite|parencite|textcite|autocite|footcite)(?:\[[^\]]*\])?\{([^}]*)$/);
  if (citeMatch) {
    const partial = citeMatch[1].toLowerCase();
    return bibEntries
      .filter((e) => !partial || e.citeKey.toLowerCase().includes(partial) || e.title.toLowerCase().includes(partial))
      .map((e) => ({
        label: e.citeKey,
        apply: e.citeKey,
        type: 'citation' as const,
        detail: `${e.authors[0] ?? 'Author'} (${e.year}) — ${e.title.slice(0, 48)}`,
      }));
  }

  const refMatch = linePrefix.match(/\\(?:cref|Cref|ref|eqref)\{([^}]*)$/);
  if (refMatch) {
    const partial = refMatch[1].toLowerCase();
    return extractDocumentLabels(sourceText)
      .filter((l) => !partial || l.key.toLowerCase().includes(partial))
      .map((l) => ({
        label: l.key,
        apply: l.key,
        type: 'label' as const,
        detail: `Line ${l.line} (${l.kind})`,
      }));
  }

  const pkgMatch = linePrefix.match(/\\usepackage(?:\[[^\]]*\])?\{([^}]*)$/);
  if (pkgMatch) {
    const partial = pkgMatch[1].toLowerCase();
    return CTAN_PACKAGES.filter((p) => !partial || p.name.toLowerCase().includes(partial)).map((p) => ({
      label: p.name,
      apply: p.name,
      type: 'package' as const,
      detail: p.description,
    }));
  }

  const envMatch = linePrefix.match(/\\begin\{([^}]*)$/);
  if (envMatch) {
    const partial = envMatch[1].toLowerCase();
    return ENVIRONMENTS.filter((e) => !partial || e.startsWith(partial)).map((env) => ({
      label: env,
      apply: `${env}}\n  \n\\end{${env}`,
      type: 'environment' as const,
      detail: `Expand \\begin{${env}}...\\end{${env}}`,
    }));
  }

  // Extract user-defined macros from buffer
  const userMacros: LaTeXCompletionItem[] = [];
  for (const m of sourceText.matchAll(
    /\\(?:NewDocumentCommand|DeclareDocumentCommand|newcommand)\*?\s*\{(\\[a-zA-Z0-9_@]+)\}/g
  )) {
    userMacros.push({
      label: m[1],
      apply: `${m[1]}{}`,
      type: 'macro',
      detail: 'Document-defined command',
    });
  }

  const cmdMatch = linePrefix.match(/(\\[a-zA-Z0-9_:]*)$/);
  const prefix = (cmdMatch?.[1] || '').toLowerCase();
  const all = [...userMacros, ...EXPL3_AND_CORE_COMMANDS];
  if (!prefix) return all;
  return all.filter((item) => item.label.toLowerCase().startsWith(prefix));
}
