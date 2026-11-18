import React from 'react';
import type { LaTeXSnippet } from '@shared/types';

const LATEX3_SNIPPETS: LaTeXSnippet[] = [
  {
    id: 'expl-block',
    title: 'ExplSyntaxOn ... ExplSyntaxOff Block',
    category: 'Syntax Regime',
    description: 'Enables LaTeX3 programming syntax where spaces are ignored and _ and : are letters.',
    code: '\\ExplSyntaxOn\n% Define variables and functions here\n\\ExplSyntaxOff\n',
  },
  {
    id: 'new-doc-cmd',
    title: '\\NewDocumentCommand (xparse)',
    category: 'xparse',
    description: 'Define a modern document command with optional (O{default}), starred (s), and mandatory (m) arguments.',
    code: '\\NewDocumentCommand{\\mycommand}{ s O{default} m }\n  {\n    \\IfBooleanTF{#1}{\\textbf{#3}}{#2: #3}\n  }\n',
  },
  {
    id: 'new-doc-env',
    title: '\\NewDocumentEnvironment (xparse)',
    category: 'xparse',
    description: 'Define a modern environment with full access to #1, #2 in begin and end blocks.',
    code: '\\NewDocumentEnvironment{calloutbox}{ O{Note} }\n  {\\par\\medskip\\noindent\\textbf{#1:} }\n  {\\par\\medskip}\n',
  },
  {
    id: 'l3keys-define',
    title: '\\keys_define:nn (l3keys)',
    category: 'Keys & Options',
    description: 'Define a key-value option family with typed variables and defaults.',
    code: '\\ExplSyntaxOn\n\\keys_define:nn { mymodule }\n  {\n    title .tl_set:N = \\l_mymodule_title_tl,\n    draft .bool_set:N = \\l_mymodule_draft_bool,\n  }\n\\ExplSyntaxOff\n',
  },
  {
    id: 'l3seq-map',
    title: 'Sequence Mapping (\\seq_map_inline:Nn)',
    category: 'Sequences',
    description: 'Populate a sequence from a comma-separated list and iterate over items.',
    code: '\\ExplSyntaxOn\n\\seq_new:N \\l_my_items_seq\n\\seq_set_from_clist:Nn \\l_my_items_seq { Alpha, Beta, Gamma }\n\\seq_map_inline:Nn \\l_my_items_seq { \\item #1 }\n\\ExplSyntaxOff\n',
  },
  {
    id: 'l3fp-eval',
    title: 'Floating-Point Evaluation (\\fp_eval:n)',
    category: 'Math & Numbers',
    description: 'Evaluate IEEE 754 floating-point math directly in LaTeX3.',
    code: '\\fp_eval:n { round(sin(pi/4) * 100, 2) }',
  },
];

export interface SnippetsTabProps {
  onInsertSnippet: (code: string, backtrackOffset?: number) => void;
}

export const SnippetsTab: React.FC<SnippetsTabProps> = ({ onInsertSnippet }) => {
  return (
    <div>
      <h2 className="sidebar-section-heading">LaTeX3 (expl3 &amp; xparse) Snippets</h2>
      {LATEX3_SNIPPETS.map((snippet) => (
        <div key={snippet.id} className="studio-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
            <strong style={{ fontSize: 12 }}>{snippet.title}</strong>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => onInsertSnippet(snippet.code, snippet.cursorBacktrackOffset)}
            >
              Insert
            </button>
          </div>
          <p style={{ margin: '4px 0 0 0', fontSize: 11.5, color: 'var(--text-muted)' }}>
            {snippet.description}
          </p>
          <pre className="code-preview">{snippet.code.split('\n').slice(0, 3).join('\n')}</pre>
        </div>
      ))}
    </div>
  );
};
