import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  autocompletion,
  completionKeymap,
  startCompletion,
  type Completion,
  type CompletionContext,
} from '@codemirror/autocomplete';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import {
  HighlightStyle,
  StreamLanguage,
  bracketMatching,
  syntaxHighlighting,
} from '@codemirror/language';
import { searchKeymap } from '@codemirror/search';
import { Compartment, EditorState, RangeSetBuilder, StateEffect, StateField } from '@codemirror/state';
import {
  Decoration,
  EditorView,
  GutterMarker,
  gutter,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
  type DecorationSet,
} from '@codemirror/view';
import { tags } from '@lezer/highlight';
import { AlertCircle, AlertTriangle, Check, Moon, SpellCheck, Sun, Upload, Wand2 } from 'lucide-react';
import type {
  BibEntry,
  CustomFontRecord,
  DemystifiedDiagnostic,
  EditorInsertionRequest,
  LaTeXDiagnostic,
  SpellingIssue,
} from '@shared/types';
import { EditorTypographyPopover } from './EditorTypographyPopover';

interface LaTeXStreamState {
  inMath: boolean;
  inDisplayMath: boolean;
  inExpl3: boolean;
}

const latex3Language = StreamLanguage.define<LaTeXStreamState>({
  name: 'latex3',
  startState: () => ({
    inMath: false,
    inDisplayMath: false,
    inExpl3: false,
  }),
  token(stream, state) {
    if (stream.sol()) {
      // keep multiline math / expl3 state across lines
    }

    if (stream.eatSpace()) {
      return null;
    }

    // Comments
    if (stream.peek() === '%') {
      stream.skipToEnd();
      return 'comment';
    }

    // Display math $$
    if (stream.match('$$')) {
      state.inDisplayMath = !state.inDisplayMath;
      return 'string';
    }

    // Inline math $
    if (stream.peek() === '$') {
      stream.next();
      state.inMath = !state.inMath;
      return 'string';
    }

    // Macro parameters #1, ##1
    if (stream.match(/^#{1,2}[1-9]?/)) {
      return 'atom';
    }

    // Backslash commands
    if (stream.peek() === '\\') {
      stream.next();
      if (stream.match(/^ExplSyntaxOn\b/)) {
        state.inExpl3 = true;
        return 'keyword';
      }
      if (stream.match(/^ExplSyntaxOff\b/)) {
        state.inExpl3 = false;
        return 'keyword';
      }
      if (
        stream.match(
          /^(NewDocumentCommand|RenewDocumentCommand|DeclareDocumentCommand|ProvideDocumentCommand|NewDocumentEnvironment|RenewDocumentEnvironment|IfBooleanTF|IfNoValueTF|IfValueTF)\b/
        )
      ) {
        return 'definitionKeyword';
      }
      if (stream.match(/^(begin|end)\b/)) {
        return 'typeName';
      }
      if (stream.match(/^(documentclass|usepackage|title|author|date|maketitle|section|subsection|subsubsection|chapter|part|label|ref|cref|cite|parencite|textcite|autocite|footcite|bibliography|addbibresource|includegraphics)\b/)) {
        return 'keyword';
      }
      // expl3 variable or function: \l_foo_tl or \module_func:Npn
      if (stream.match(/^[lgc]_[a-zA-Z0-9_]+_[a-zA-Z]+/) || stream.match(/^[a-zA-Z]+_[a-zA-Z0-9_]+:[a-zA-Z]*/)) {
        return 'variableName.special';
      }
      if (stream.match(/^[a-zA-Z@]+/)) {
        return 'function';
      }
      stream.next();
      return 'function';
    }

    // Brackets
    if (stream.match(/^[{}\[\]()]/)) {
      return 'bracket';
    }

    // Numbers
    if (stream.match(/^[0-9]+(\.[0-9]+)?/)) {
      return 'number';
    }

    if (state.inMath || state.inDisplayMath) {
      stream.next();
      return 'string';
    }

    stream.next();
    return null;
  },
});

const latex3HighlightStyle = HighlightStyle.define([
  { tag: tags.comment, color: 'var(--tok-comment)', fontStyle: 'italic' },
  { tag: tags.keyword, color: 'var(--tok-keyword)', fontWeight: '600' },
  { tag: tags.definitionKeyword, color: 'var(--tok-xparse)', fontWeight: '600' },
  { tag: tags.special(tags.variableName), color: 'var(--tok-expl3)', fontWeight: '600' },
  { tag: tags.typeName, color: 'var(--tok-env)', fontWeight: '600' },
  { tag: tags.function(tags.variableName), color: 'var(--tok-command)' },
  { tag: tags.atom, color: 'var(--tok-param)', fontWeight: '600' },
  { tag: tags.string, color: 'var(--tok-math)' },
  { tag: tags.bracket, color: 'var(--tok-bracket)' },
  { tag: tags.number, color: 'var(--tok-number)' },
]);

const STATIC_LATEX_COMPLETIONS: Completion[] = [
  { label: '\\ExplSyntaxOn', type: 'keyword', detail: 'Enable LaTeX3 programming syntax' },
  { label: '\\ExplSyntaxOff', type: 'keyword', detail: 'Restore standard LaTeX syntax' },
  { label: '\\NewDocumentCommand', type: 'function', apply: '\\NewDocumentCommand{\\cmd}{ m }{\n  \n}', detail: 'xparse command declaration' },
  { label: '\\NewDocumentEnvironment', type: 'function', apply: '\\NewDocumentEnvironment{myenv}{ O{} }{\n  \n}{\n  \n}', detail: 'xparse environment declaration' },
  { label: '\\tl_new:N', type: 'variable', detail: 'expl3 token list variable' },
  { label: '\\tl_set:Nn', type: 'function', detail: 'expl3 set token list' },
  { label: '\\tl_use:N', type: 'function', detail: 'expl3 use token list' },
  { label: '\\int_eval:n', type: 'function', detail: 'expl3 integer arithmetic' },
  { label: '\\fp_eval:n', type: 'function', detail: 'expl3 floating-point arithmetic' },
  { label: '\\seq_set_from_clist:Nn', type: 'function', detail: 'expl3 sequence from clist' },
  { label: '\\seq_map_inline:Nn', type: 'function', detail: 'expl3 map sequence items' },
  { label: '\\section{}', type: 'keyword', apply: '\\section{}', detail: 'Document section' },
  { label: '\\subsection{}', type: 'keyword', apply: '\\subsection{}', detail: 'Document subsection' },
  { label: '\\begin{equation}', type: 'type', apply: '\\begin{equation}\n  \n\\end{equation}', detail: 'Numbered equation' },
  { label: '\\begin{align}', type: 'type', apply: '\\begin{align}\n  \n\\end{align}', detail: 'AMS aligned equations' },
  { label: '\\begin{itemize}', type: 'type', apply: '\\begin{itemize}\n  \\item \n\\end{itemize}', detail: 'Bulleted list' },
  { label: '\\begin{enumerate}', type: 'type', apply: '\\begin{enumerate}\n  \\item \n\\end{enumerate}', detail: 'Numbered list' },
  { label: '\\begin{figure}', type: 'type', apply: '\\begin{figure}[htbp]\n  \\centering\n  \\includegraphics[width=0.8\\textwidth]{figures/}\n  \\caption{}\n  \\label{fig:}\n\\end{figure}', detail: 'Floating figure' },
  { label: '\\begin{table}', type: 'type', apply: '\\begin{table}[htbp]\n  \\centering\n  \\caption{}\n  \\label{tab:}\n\\end{table}', detail: 'Floating table' },
  { label: '\\usepackage{}', type: 'keyword', apply: '\\usepackage{}', detail: 'Load CTAN package' },
  { label: '\\cite{}', type: 'keyword', apply: '\\cite{}', detail: 'Citation reference' },
  { label: '\\ref{}', type: 'keyword', apply: '\\ref{}', detail: 'Cross-reference' },
  { label: '\\cref{}', type: 'keyword', apply: '\\cref{}', detail: 'Cleveref cross-reference' },
  { label: '\\label{}', type: 'keyword', apply: '\\label{}', detail: 'Anchor label' },
];

const setDecorationsEffect = StateEffect.define<{
  diagnostics: LaTeXDiagnostic[];
  spellingIssues: SpellingIssue[];
  proseSpellCheckEnabled: boolean;
  flashLine: number | null;
}>();

class DiagnosticGutterMarker extends GutterMarker {
  readonly severity: 'Error' | 'Warning' | 'Info';
  readonly tooltip: string;

  constructor(severity: 'Error' | 'Warning' | 'Info', tooltip: string) {
    super();
    this.severity = severity;
    this.tooltip = tooltip;
  }

  toDOM() {
    const span = document.createElement('span');
    span.title = this.tooltip;
    span.setAttribute('aria-label', `${this.severity}: ${this.tooltip}`);
    span.style.display = 'inline-flex';
    span.style.alignItems = 'center';
    span.style.justifyContent = 'center';
    span.style.width = '14px';
    span.style.height = '14px';
    span.style.fontSize = '10px';
    span.style.fontWeight = '700';
    span.style.borderRadius = '50%';
    if (this.severity === 'Error') {
      span.textContent = '!';
      span.style.background = '#dc2626';
      span.style.color = '#ffffff';
    } else if (this.severity === 'Warning') {
      span.textContent = '▲';
      span.style.color = '#d97706';
    } else {
      span.textContent = 'i';
      span.style.color = '#2563eb';
    }
    return span;
  }
}

const lineDecorationField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },
  update(decorations, tr) {
    decorations = decorations.map(tr.changes);
    for (const effect of tr.effects) {
      if (effect.is(setDecorationsEffect)) {
        const { diagnostics, spellingIssues, proseSpellCheckEnabled, flashLine } = effect.value;
        const doc = tr.state.doc;
        const sortedDecos: Array<{ from: number; to: number; deco: Decoration }> = [];
        for (const diag of diagnostics) {
          if (diag.line && diag.line >= 1 && diag.line <= doc.lines) {
            const lineInfo = doc.line(diag.line);
            const cls = diag.severity === 'Error' ? 'cm-diag-error-line' : 'cm-diag-warning-line';
            sortedDecos.push({ from: lineInfo.from, to: lineInfo.from, deco: Decoration.line({ class: cls }) });
          }
        }
        if (flashLine && flashLine >= 1 && flashLine <= doc.lines) {
          const lineInfo = doc.line(flashLine);
          sortedDecos.push({ from: lineInfo.from, to: lineInfo.from, deco: Decoration.line({ class: 'cm-synctex-flash' }) });
        }
        if (proseSpellCheckEnabled) {
          for (const issue of spellingIssues) {
            if (issue.startOffset >= 0 && issue.endOffset <= doc.length && issue.startOffset < issue.endOffset) {
              sortedDecos.push({
                from: issue.startOffset,
                to: issue.endOffset,
                deco: Decoration.mark({ class: 'cm-spell-underline' }),
              });
            }
          }
        }
        sortedDecos.sort((a, b) => a.from - b.from || a.to - b.to);
        const cleanBuilder = new RangeSetBuilder<Decoration>();
        for (const item of sortedDecos) {
          cleanBuilder.add(item.from, item.to, item.deco);
        }
        return cleanBuilder.finish();
      }
    }
    return decorations;
  },
  provide: (f) => EditorView.decorations.from(f),
});

export interface LaTeXCodeEditorProps {
  activeFilePath: string;
  projectFiles: Record<string, string>;
  sourceText: string;
  editorTheme: 'light' | 'dark';
  editorFontFamily: string;
  editorFontSize: number;
  customFonts: CustomFontRecord[];
  diagnostics: LaTeXDiagnostic[];
  demystifiedDiagnostics: DemystifiedDiagnostic[];
  bibEntries: BibEntry[];
  proseSpellCheckEnabled: boolean;
  spellingIssues: SpellingIssue[];
  studentModeHideExpl3: boolean;
  pendingInsertion: EditorInsertionRequest | null;
  pendingJumpToLine: { line: number; nonce: number } | null;
  onChangeSource: (text: string) => void;
  onChangeFile: (path: string) => void;
  onCursorLineChange: (line: number) => void;
  onConsumePendingInsertion: () => void;
  onChangeTheme: (theme: 'light' | 'dark') => void;
  onChangeTypography: (family: string, size: number) => void;
  onToggleSpellCheck: (enabled: boolean) => void;
  onApplySpellingSuggestion: (issue: SpellingIssue, replacement: string) => void;
  onIgnoreSpellingWord: (word: string) => void;
  onApplyFix: (diag: DemystifiedDiagnostic) => void;
  onDropFigure: (file: File) => void;
  onDropBib: (file: File) => void;
  onDropFont: (file: File) => void;
}

export const LaTeXCodeEditor: React.FC<LaTeXCodeEditorProps> = ({
  activeFilePath,
  projectFiles,
  sourceText,
  editorTheme,
  editorFontFamily,
  editorFontSize,
  customFonts,
  diagnostics,
  demystifiedDiagnostics,
  bibEntries,
  proseSpellCheckEnabled,
  spellingIssues,
  studentModeHideExpl3,
  pendingInsertion,
  pendingJumpToLine,
  onChangeSource,
  onChangeFile,
  onCursorLineChange,
  onConsumePendingInsertion,
  onChangeTheme,
  onChangeTypography,
  onToggleSpellCheck,
  onApplySpellingSuggestion,
  onIgnoreSpellingWord,
  onApplyFix,
  onDropFigure,
  onDropBib,
  onDropFont,
}) => {
  const editorHostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const themeCompartmentRef = useRef(new Compartment());
  const sourceRef = useRef(sourceText);
  const bibRef = useRef(bibEntries);
  const diagRef = useRef(diagnostics);

  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [flashLine, setFlashLine] = useState<number | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  sourceRef.current = sourceText;
  bibRef.current = bibEntries;
  diagRef.current = diagnostics;

  const editableFiles = useMemo(() => {
    const keys = Object.keys(projectFiles).filter(
      (k) => k.endsWith('.tex') || k.endsWith('.bib') || k.endsWith('.cls') || k.endsWith('.sty')
    );
    return keys.length > 0 ? keys : ['main.tex'];
  }, [projectFiles]);

  const activeLineDiagnostic = useMemo(() => {
    return demystifiedDiagnostics.find((d) => d.line === cursorPos.line) ?? null;
  }, [cursorPos.line, demystifiedDiagnostics]);

  const activeSpellingIssue = useMemo(() => {
    if (!proseSpellCheckEnabled) return null;
    return spellingIssues.find((s) => s.line === cursorPos.line) ?? null;
  }, [cursorPos.line, proseSpellCheckEnabled, spellingIssues]);

  // Dynamic completion source bound to latest sourceText & bibEntries
  const completionSource = useMemo(() => {
    return (context: CompletionContext) => {
      const citeMatch = context.matchBefore(/\\(?:cite|parencite|textcite|autocite|footcite)\{[^}]*/);
      if (citeMatch) {
        const prefixStart = citeMatch.from + citeMatch.text.indexOf('{') + 1;
        return {
          from: prefixStart,
          options: bibRef.current.map((entry) => ({
            label: entry.citeKey,
            type: 'variable',
            detail: `${entry.authors[0] ?? 'Author'} (${entry.year})`,
            info: entry.title,
          })),
        };
      }

      const refMatch = context.matchBefore(/\\(?:ref|cref|eqref|pageref)\{[^}]*/);
      if (refMatch) {
        const prefixStart = refMatch.from + refMatch.text.indexOf('{') + 1;
        const labels = Array.from(sourceRef.current.matchAll(/\\label\{([^}]+)\}/g)).map((m) => m[1]);
        return {
          from: prefixStart,
          options: Array.from(new Set(labels)).map((lbl) => ({
            label: lbl,
            type: 'variable',
            detail: 'Document \\label',
          })),
        };
      }

      const cmdMatch = context.matchBefore(/\\[a-zA-Z0-9_:]*/);
      if (!cmdMatch && !context.explicit) return null;

      const userMacros = Array.from(
        sourceRef.current.matchAll(/\\(?:NewDocumentCommand|newcommand)\*?\{\\([a-zA-Z0-9_]+)\}/g)
      ).map((m) => ({
        label: `\\${m[1]}`,
        type: 'function' as const,
        detail: 'Document macro',
      }));

      return {
        from: cmdMatch ? cmdMatch.from : context.pos,
        options: [...userMacros, ...STATIC_LATEX_COMPLETIONS],
      };
    };
  }, []);

  // Initialize CodeMirror 6 instance once
  useEffect(() => {
    if (!editorHostRef.current) return;

    const diagGutter = gutter({
      class: 'cm-diagnostic-gutter',
      markers: (view) => {
        const builder = new RangeSetBuilder<GutterMarker>();
        const doc = view.state.doc;
        const byLine = new Map<number, LaTeXDiagnostic>();
        for (const d of diagRef.current) {
          if (d.line && d.line >= 1 && d.line <= doc.lines && !byLine.has(d.line)) {
            byLine.set(d.line, d);
          }
        }
        const sortedLines = Array.from(byLine.keys()).sort((a, b) => a - b);
        for (const ln of sortedLines) {
          const d = byLine.get(ln)!;
          const lineInfo = doc.line(ln);
          builder.add(lineInfo.from, lineInfo.from, new DiagnosticGutterMarker(d.severity, d.message));
        }
        return builder.finish();
      },
    });

    const themeExt = themeCompartmentRef.current.of(
      EditorView.theme({
        '&': {
          fontFamily: editorFontFamily,
          fontSize: `${editorFontSize}px`,
        },
        '.cm-content': {
          fontFamily: editorFontFamily,
          fontSize: `${editorFontSize}px`,
        },
        '.cm-gutters': {
          fontFamily: editorFontFamily,
          fontSize: `${Math.max(11, editorFontSize - 1)}px`,
        },
      })
    );

    const state = EditorState.create({
      doc: sourceText,
      extensions: [
        diagGutter,
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightActiveLine(),
        history(),
        bracketMatching(),
        latex3Language,
        syntaxHighlighting(latex3HighlightStyle),
        lineDecorationField,
        autocompletion({ override: [completionSource] }),
        keymap.of([
          ...defaultKeymap,
          ...historyKeymap,
          ...searchKeymap,
          ...completionKeymap,
          indentWithTab,
          {
            key: 'Ctrl-Space',
            run: (view) => startCompletion(view),
          },
        ]),
        themeExt,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            const nextText = update.state.doc.toString();
            onChangeSource(nextText);
          }
          if (update.selectionSet || update.docChanged) {
            const head = update.state.selection.main.head;
            const lineObj = update.state.doc.lineAt(head);
            const col = head - lineObj.from + 1;
            setCursorPos({ line: lineObj.number, col });
            onCursorLineChange(lineObj.number);
          }
        }),
        EditorView.contentAttributes.of({
          'aria-label': 'LaTeX3 Source Code Editor',
        }),
      ],
    });

    const view = new EditorView({
      state,
      parent: editorHostRef.current,
    });
    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // Mount once; external state updates sync via effects below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync typography dynamically
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: themeCompartmentRef.current.reconfigure(
        EditorView.theme({
          '&': {
            fontFamily: editorFontFamily,
            fontSize: `${editorFontSize}px`,
          },
          '.cm-content': {
            fontFamily: editorFontFamily,
            fontSize: `${editorFontSize}px`,
          },
          '.cm-gutters': {
            fontFamily: editorFontFamily,
            fontSize: `${Math.max(11, editorFontSize - 1)}px`,
          },
        })
      ),
    });
  }, [editorFontFamily, editorFontSize]);

  // Sync external sourceText updates (e.g. file switch, template load, auto-fix)
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current !== sourceText) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: sourceText },
      });
    }
  }, [sourceText]);

  // Sync diagnostics, spellcheck, and SyncTeX flash decorations
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: setDecorationsEffect.of({
        diagnostics,
        spellingIssues,
        proseSpellCheckEnabled,
        flashLine,
      }),
    });
  }, [diagnostics, spellingIssues, proseSpellCheckEnabled, flashLine]);

  // Consume pending insertion at caret
  useEffect(() => {
    if (!pendingInsertion) return;
    const view = viewRef.current;
    if (!view) return;
    const sel = view.state.selection.main;
    const insertedLength = pendingInsertion.text.length;
    const nextAnchor = Math.max(
      sel.from,
      sel.from + insertedLength - (pendingInsertion.cursorBacktrackOffset || 0)
    );
    view.dispatch({
      changes: { from: sel.from, to: sel.to, insert: pendingInsertion.text },
      selection: { anchor: nextAnchor },
      scrollIntoView: true,
    });
    view.focus();
    onConsumePendingInsertion();
  }, [pendingInsertion, onConsumePendingInsertion]);

  // Consume pendingJumpToLine (Outline click or Backward SyncTeX)
  useEffect(() => {
    if (!pendingJumpToLine) return;
    const view = viewRef.current;
    if (!view) return;
    const doc = view.state.doc;
    const clampedLine = Math.min(doc.lines, Math.max(1, pendingJumpToLine.line));
    const lineObj = doc.line(clampedLine);
    view.dispatch({
      selection: { anchor: lineObj.from },
      effects: EditorView.scrollIntoView(lineObj.from, { y: 'center' }),
    });
    view.focus();
    setFlashLine(clampedLine);
    setStatusMessage(`Jumped to line ${clampedLine}`);
    const timer = window.setTimeout(() => setFlashLine(null), 1200);
    return () => window.clearTimeout(timer);
  }, [pendingJumpToLine]);

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    const lower = file.name.toLowerCase();
    if (lower.endsWith('.bib')) {
      onDropBib(file);
    } else if (lower.endsWith('.ttf') || lower.endsWith('.otf') || lower.endsWith('.ttc')) {
      onDropFont(file);
    } else if (
      lower.endsWith('.png') ||
      lower.endsWith('.jpg') ||
      lower.endsWith('.jpeg') ||
      lower.endsWith('.pdf') ||
      lower.endsWith('.svg') ||
      lower.endsWith('.webp')
    ) {
      onDropFigure(file);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* Editor Header Bar (36px) */}
      <div className="pane-header">
        <div className="pane-header__left">
          <label htmlFor="active-file-select" className="sr-only">
            Active project file
          </label>
          <select
            id="active-file-select"
            className="select"
            value={activeFilePath}
            onChange={(e) => onChangeFile(e.target.value)}
            style={{ width: 'auto', height: 24, padding: '0 8px', fontSize: 12, fontWeight: 600 }}
          >
            {editableFiles.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
          {!studentModeHideExpl3 && (
            <span className="pane-subtitle" aria-label="LaTeX3 expl3 syntax mode">
              • LaTeX3 / expl3
            </span>
          )}
        </div>

        <div className="pane-header__right">
          <button
            type="button"
            className={`btn btn-sm ${proseSpellCheckEnabled ? 'btn-primary' : ''}`}
            aria-pressed={proseSpellCheckEnabled}
            title="Toggle Prose Spellcheck (Mod+Alt+;)"
            onClick={() => onToggleSpellCheck(!proseSpellCheckEnabled)}
          >
            <SpellCheck size={13} aria-hidden="true" />
            <span>Spell</span>
            {proseSpellCheckEnabled && spellingIssues.length > 0 && (
              <span className="badge badge-warning" style={{ padding: '0 5px', fontSize: 10 }}>
                {spellingIssues.length}
              </span>
            )}
          </button>

          <EditorTypographyPopover
            fontFamily={editorFontFamily}
            fontSize={editorFontSize}
            customFonts={customFonts}
            onChange={onChangeTypography}
          />

          <div className="segmented-control" role="group" aria-label="Editor surface theme">
            <button
              type="button"
              className="segmented-control__btn"
              aria-pressed={editorTheme === 'light'}
              onClick={() => onChangeTheme('light')}
            >
              <Sun size={11} aria-hidden="true" />
              Light
            </button>
            <button
              type="button"
              className="segmented-control__btn"
              aria-pressed={editorTheme === 'dark'}
              onClick={() => onChangeTheme('dark')}
            >
              <Moon size={11} aria-hidden="true" />
              Dark
            </button>
          </div>

          <span
            className="pane-subtitle"
            style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}
            aria-label={`Line ${cursorPos.line}, Column ${cursorPos.col}`}
          >
            Ln {cursorPos.line}, Col {cursorPos.col}
          </span>
        </div>
      </div>

      {/* Inline Quick-Fix / Spelling Bar for active line */}
      {(activeLineDiagnostic || activeSpellingIssue) && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            padding: '5px 12px',
            background: activeLineDiagnostic?.severity === 'Error' ? 'var(--danger-bg)' : 'var(--warning-bg)',
            color: activeLineDiagnostic?.severity === 'Error' ? 'var(--danger-text)' : 'var(--warning-text)',
            borderBottom: '1px solid var(--border-subtle)',
            fontSize: 12,
          }}
        >
          {activeLineDiagnostic ? (
            <>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                {activeLineDiagnostic.severity === 'Error' ? (
                  <AlertCircle size={14} aria-hidden="true" />
                ) : (
                  <AlertTriangle size={14} aria-hidden="true" />
                )}
                <strong style={{ whiteSpace: 'nowrap' }}>Line {activeLineDiagnostic.line}:</strong>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {activeLineDiagnostic.shortTitle}
                </span>
              </span>
              {activeLineDiagnostic.fixOperation && (
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => onApplyFix(activeLineDiagnostic)}
                >
                  <Wand2 size={12} aria-hidden="true" />
                  {activeLineDiagnostic.fixButtonTitle ?? 'Apply Fix'}
                </button>
              )}
            </>
          ) : (
            activeSpellingIssue && (
              <>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <SpellCheck size={14} aria-hidden="true" />
                  <span>
                    Possible typo: <strong>{activeSpellingIssue.word}</strong>
                  </span>
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {activeSpellingIssue.suggestions.slice(0, 3).map((sug) => (
                    <button
                      key={sug}
                      type="button"
                      className="btn btn-sm"
                      onClick={() => onApplySpellingSuggestion(activeSpellingIssue, sug)}
                    >
                      <Check size={11} aria-hidden="true" />
                      {sug}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => onIgnoreSpellingWord(activeSpellingIssue.word)}
                  >
                    Ignore
                  </button>
                </div>
              </>
            )
          )}
        </div>
      )}

      {/* CodeMirror 6 Mount */}
      <div
        id="latex-code-editor-region"
        className="editor-surface-wrapper"
        data-editor-theme={editorTheme}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDraggingOver(true);
        }}
        onDragLeave={() => setIsDraggingOver(false)}
        onDrop={handleDrop}
      >
        <div ref={editorHostRef} style={{ height: '100%' }} />
        {isDraggingOver && (
          <div className="editor-drop-overlay" role="status">
            <Upload size={26} aria-hidden="true" />
            <span>Drop image, .bib database, or .ttf/.otf font into project</span>
          </div>
        )}
      </div>

      {/* Screen-reader announcement for SyncTeX backward jump */}
      <div className="sr-only" aria-live="polite">
        {statusMessage}
      </div>
    </div>
  );
};
