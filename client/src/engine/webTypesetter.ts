import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, PDFFont, PDFPage, rgb, StandardFonts } from 'pdf-lib';
import type { LaTeXDiagnostic } from '@shared/types/latex.js';
import { formatSyncTeXSp } from './synctexParser.js';
import type { CompilerOutput, CompilerPayload } from './wasmTexAdapter.js';

interface LineNode {
  line: number;
  text: string;
}

interface ParsedBibItem {
  citeKey: string;
  author: string;
  year: string;
  title: string;
  venue: string;
}

interface TableCellBlock {
  kind: 'table';
  line: number;
  caption: string;
  label: string;
  alignments: Array<'l' | 'c' | 'r'>;
  rows: Array<{ cells: string[]; isHeader?: boolean }>;
}

interface ChartPlotBlock {
  kind: 'chart';
  line: number;
  chartType: 'line' | 'bar' | 'scatter';
  title: string;
  xLabel: string;
  yLabel: string;
  points: Array<{ x: number; y: number }>;
  caption: string;
}

interface FigureBlock {
  kind: 'figure';
  line: number;
  paths: string[];
  caption: string;
  label: string;
}

type DocBlock =
  | { kind: 'title'; line: number; title: string; author: string; date: string }
  | { kind: 'abstract'; line: number; text: string }
  | { kind: 'heading'; line: number; level: number; numberStr: string; title: string }
  | { kind: 'paragraph'; line: number; text: string }
  | { kind: 'list-item'; line: number; bullet: string; text: string; indent: number }
  | { kind: 'math'; line: number; latex: string; eqNumber?: string }
  | { kind: 'code'; line: number; lines: string[] }
  | { kind: 'slide-break'; line: number; title: string }
  | TableCellBlock
  | ChartPlotBlock
  | FigureBlock;

const WIN_ANSI_EXTRA = new Set([
  0x2013, 0x2014, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2026, 0x20ac, 0x2122,
]);

const UNICODE_ASCII_MAP: Record<string, string> = {
  '\u03b1': 'alpha',
  '\u03b2': 'beta',
  '\u03b3': 'gamma',
  '\u03b4': 'delta',
  '\u03b5': 'epsilon',
  '\u03b6': 'zeta',
  '\u03b7': 'eta',
  '\u03b8': 'theta',
  '\u03bb': 'lambda',
  '\u03bc': 'mu',
  '\u03bd': 'nu',
  '\u03be': 'xi',
  '\u03c0': 'pi',
  '\u03c1': 'rho',
  '\u03c3': 'sigma',
  '\u03c4': 'tau',
  '\u03c6': 'phi',
  '\u03c7': 'chi',
  '\u03c8': 'psi',
  '\u03c9': 'omega',
  '\u0393': 'Gamma',
  '\u0394': 'Delta',
  '\u0398': 'Theta',
  '\u039b': 'Lambda',
  '\u03a0': 'Pi',
  '\u03a3': 'Sigma',
  '\u03a6': 'Phi',
  '\u03a8': 'Psi',
  '\u03a9': 'Omega',
  '\u2211': 'Sum',
  '\u220f': 'Prod',
  '\u222b': 'Int',
  '\u221a': 'sqrt',
  '\u221e': 'inf',
  '\u2264': '<=',
  '\u2265': '>=',
  '\u2260': '!=',
  '\u2248': '~=',
  '\u2261': '===',
  '\u2192': '->',
  '\u2190': '<-',
  '\u21d2': '=>',
  '\u2200': 'forall',
  '\u2203': 'exists',
  '\u2208': 'in',
  '\u2202': 'd',
  '\u2207': 'grad',
  '\u00d7': 'x',
  '\u00b1': '+/-',
  '\u22c5': '*',
};

function sanitizeForPdfFont(text: string, hasCustomUnicodeFont: boolean): string {
  if (hasCustomUnicodeFont) {
    return text.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, ' ');
  }
  let out = '';
  for (const ch of text) {
    if (UNICODE_ASCII_MAP[ch]) {
      out += UNICODE_ASCII_MAP[ch];
      continue;
    }
    const code = ch.codePointAt(0) ?? 32;
    if ((code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff) || WIN_ANSI_EXTRA.has(code)) {
      out += ch;
    } else if (code === 0x09) {
      out += '  ';
    } else {
      out += '?';
    }
  }
  return out;
}

function evalMathExpr(expr: string): number {
  const tokens = expr
    .replace(/\s+/g, '')
    .match(/(\d+(?:\.\d+)?|[+\-*/()])/g);
  if (!tokens || tokens.length === 0) return 0;
  let pos = 0;

  const parseExpr = (): number => {
    let val = parseTerm();
    while (pos < tokens.length && (tokens[pos] === '+' || tokens[pos] === '-')) {
      const op = tokens[pos++];
      const right = parseTerm();
      val = op === '+' ? val + right : val - right;
    }
    return val;
  };

  const parseTerm = (): number => {
    let val = parseFactor();
    while (pos < tokens.length && (tokens[pos] === '*' || tokens[pos] === '/')) {
      const op = tokens[pos++];
      const right = parseFactor();
      val = op === '*' ? val * right : right === 0 ? 0 : val / right;
    }
    return val;
  };

  const parseFactor = (): number => {
    if (tokens[pos] === '-') {
      pos += 1;
      return -parseFactor();
    }
    if (tokens[pos] === '(') {
      pos += 1;
      const val = parseExpr();
      if (tokens[pos] === ')') pos += 1;
      return val;
    }
    const num = Number.parseFloat(tokens[pos++] || '0');
    return Number.isFinite(num) ? num : 0;
  };

  return parseExpr();
}

function extractBalancedArg(text: string, startBraceIdx: number): { content: string; endIdx: number } | null {
  if (text[startBraceIdx] !== '{') return null;
  let depth = 0;
  for (let i = startBraceIdx; i < text.length; i += 1) {
    if (text[i] === '\\' && i + 1 < text.length) {
      i += 1;
      continue;
    }
    if (text[i] === '{') depth += 1;
    else if (text[i] === '}') {
      depth -= 1;
      if (depth === 0) {
        return { content: text.slice(startBraceIdx + 1, i), endIdx: i };
      }
    }
  }
  return null;
}

function stripLineComment(line: string): string {
  for (let i = 0; i < line.length; i += 1) {
    if (line[i] === '%' && (i === 0 || line[i - 1] !== '\\')) {
      return line.slice(0, i);
    }
  }
  return line;
}

function resolveInputsAndValidate(
  mainTex: string,
  files: Record<string, string>
): { lines: LineNode[]; diagnostics: LaTeXDiagnostic[]; logLines: string[] } {
  const diagnostics: LaTeXDiagnostic[] = [];
  const logLines: string[] = [
    'This is LaTeXaP-WeB WebTypesetter (pdf-lib + expl3/xparse engine)',
    'entering extended mode',
    '(./main.tex',
  ];

  const rawLines = mainTex.split(/\r?\n/);
  const expandedLines: LineNode[] = [];

  for (let i = 0; i < rawLines.length; i += 1) {
    const lineNum = i + 1;
    const raw = rawLines[i];
    const clean = stripLineComment(raw);
    const inputMatch = clean.match(/\\(?:input|include)\{([^}]+)\}/);
    if (inputMatch) {
      const target = inputMatch[1].trim();
      const candidates = [target, `${target}.tex`];
      const foundKey = candidates.find((c) => typeof files[c] === 'string');
      if (foundKey) {
        logLines.push(`(./${foundKey})`);
        for (const subLine of files[foundKey].split(/\r?\n/)) {
          expandedLines.push({ line: lineNum, text: subLine });
        }
        continue;
      }
    }
    expandedLines.push({ line: lineNum, text: raw });
  }

  const fullStripped = expandedLines.map((l) => stripLineComment(l.text)).join('\n');

  if (!/\\documentclass(?:\[[^\]]*\])?\{[^}]+\}/.test(fullStripped)) {
    diagnostics.push({
      id: 'err-no-documentclass',
      line: 1,
      severity: 'Error',
      message: 'Missing \\documentclass{...} declaration.',
      rawLine: '! LaTeX Error: Missing \\documentclass declaration.',
    });
    logLines.push('! LaTeX Error: Missing \\documentclass declaration.', 'l.1');
  }

  if (!/\\begin\{document\}/.test(fullStripped)) {
    diagnostics.push({
      id: 'err-no-begin-doc',
      line: 1,
      severity: 'Error',
      message: 'Missing \\begin{document}.',
      rawLine: '! LaTeX Error: Missing \\begin{document}.',
    });
    logLines.push('! LaTeX Error: Missing \\begin{document}.', 'l.1');
  }

  if (/\\begin\{document\}/.test(fullStripped) && !/\\end\{document\}/.test(fullStripped)) {
    const lastLine = expandedLines.length || 1;
    diagnostics.push({
      id: 'err-no-end-doc',
      line: lastLine,
      severity: 'Error',
      message: 'Missing \\end{document}.',
      rawLine: '! LaTeX Error: Missing \\end{document}.',
    });
    logLines.push('! LaTeX Error: Missing \\end{document}.', `l.${lastLine}`);
  }

  // Brace & environment matching
  const braceStack: number[] = [];
  const envStack: Array<{ name: string; line: number }> = [];
  let inTabularOrMath = false;

  for (const node of expandedLines) {
    const line = stripLineComment(node.text);
    for (let j = 0; j < line.length; j += 1) {
      const ch = line[j];
      if (ch === '\\') {
        j += 1;
        continue;
      }
      if (ch === '{') braceStack.push(node.line);
      else if (ch === '}') {
        if (braceStack.length === 0) {
          diagnostics.push({
            id: `err-extra-brace-${node.line}-${j}`,
            line: node.line,
            severity: 'Error',
            message: 'Extra closing brace `}` with no matching `{`.',
            rawLine: '! Argument of extra `}` has an extra }.',
          });
          logLines.push('! Extra }, or forgotten $.', `l.${node.line}`);
        } else {
          braceStack.pop();
        }
      }
    }

    const beginMatches = Array.from(line.matchAll(/\\begin\{([^}]+)\}/g));
    for (const m of beginMatches) {
      const env = m[1].trim();
      envStack.push({ name: env, line: node.line });
      if (/^(tabular|tabularx|array|align\*?|gather\*?|matrix|pmatrix|bmatrix)$/.test(env)) {
        inTabularOrMath = true;
      }
    }

    const endMatches = Array.from(line.matchAll(/\\end\{([^}]+)\}/g));
    for (const m of endMatches) {
      const env = m[1].trim();
      const top = envStack[envStack.length - 1];
      if (!top) {
        diagnostics.push({
          id: `err-unmatched-end-${node.line}-${env}`,
          line: node.line,
          severity: 'Error',
          message: `\\end{${env}} found without matching \\begin{${env}}.`,
          rawLine: `! LaTeX Error: \\begin{...} on input line ended by \\end{${env}}.`,
        });
        logLines.push(`! LaTeX Error: Unmatched \\end{${env}}.`, `l.${node.line}`);
      } else if (top.name !== env) {
        diagnostics.push({
          id: `err-mismatch-env-${node.line}-${env}`,
          line: node.line,
          severity: 'Error',
          message: `\\begin{${top.name}} on line ${top.line} closed by \\end{${env}}.`,
          rawLine: `! LaTeX Error: \\begin{${top.name}} on input line ${top.line} ended by \\end{${env}}.`,
        });
        logLines.push(
          `! LaTeX Error: \\begin{${top.name}} on input line ${top.line} ended by \\end{${env}}.`,
          `l.${node.line}`
        );
        envStack.pop();
      } else {
        envStack.pop();
        if (/^(tabular|tabularx|array|align\*?|gather\*?|matrix|pmatrix|bmatrix)$/.test(env)) {
          inTabularOrMath = false;
        }
      }
    }

    // Check unescaped & in prose (outside tabular/align and after \begin{document})
    if (!inTabularOrMath && /(?:^|[^\\])&/.test(line) && !/\\(begin|end)\{/.test(line)) {
      const idxDoc = fullStripped.indexOf('\\begin{document}');
      if (idxDoc >= 0) {
        const lineStartOffset = fullStripped.indexOf(line);
        if (lineStartOffset > idxDoc) {
          diagnostics.push({
            id: `err-unescaped-amp-${node.line}`,
            line: node.line,
            severity: 'Error',
            message: 'Misplaced alignment tab character &. Use \\& in prose.',
            rawLine: '! Misplaced alignment tab character &.',
          });
          logLines.push('! Misplaced alignment tab character &.', `l.${node.line}`);
        }
      }
    }
  }

  if (braceStack.length > 0) {
    const ln = braceStack[braceStack.length - 1];
    diagnostics.push({
      id: `err-unclosed-brace-${ln}`,
      line: ln,
      severity: 'Error',
      message: 'Unclosed `{` brace opened in document.',
      rawLine: '! File ended while scanning use of group.',
    });
    logLines.push('! File ended while scanning use of {.', `l.${ln}`);
  }

  for (const unclosed of envStack) {
    if (unclosed.name === 'document') continue;
    diagnostics.push({
      id: `err-unclosed-env-${unclosed.line}-${unclosed.name}`,
      line: unclosed.line,
      severity: 'Error',
      message: `Environment \\begin{${unclosed.name}} on line ${unclosed.line} was never closed.`,
      rawLine: `! LaTeX Error: \\begin{${unclosed.name}} on input line ${unclosed.line} ended by \\end{document}.`,
    });
    logLines.push(
      `! LaTeX Error: \\begin{${unclosed.name}} on input line ${unclosed.line} unclosed.`,
      `l.${unclosed.line}`
    );
  }

  return { lines: expandedLines, diagnostics, logLines };
}

function expandExpl3AndXparse(text: string): string {
  const tlVars = new Map<string, string>();
  const intVars = new Map<string, number>();
  const fpVars = new Map<string, number>();
  const seqVars = new Map<string, string[]>();
  const customMacros = new Map<string, { argCount: number; body: string }>();

  let out = text;

  // 1. Parse \tl_set:Nn, \tl_put_right:Nn, \int_set:Nn, \fp_set:Nn, \seq_set_from_clist:Nn
  out = out.replace(/\\tl_(?:g_)?set:Nn\s+(\\[a-zA-Z0-9_]+)\s*\{([^{}]*)\}/g, (_m, name: string, val: string) => {
    tlVars.set(name, val.replace(/~/g, ' '));
    return '';
  });
  out = out.replace(/\\tl_(?:g_)?put_right:Nn\s+(\\[a-zA-Z0-9_]+)\s*\{([^{}]*)\}/g, (_m, name: string, val: string) => {
    tlVars.set(name, (tlVars.get(name) ?? '') + val.replace(/~/g, ' '));
    return '';
  });
  out = out.replace(/\\int_(?:g_)?set:Nn\s+(\\[a-zA-Z0-9_]+)\s*\{([^{}]*)\}/g, (_m, name: string, expr: string) => {
    intVars.set(name, Math.trunc(evalMathExpr(expr)));
    return '';
  });
  out = out.replace(/\\fp_(?:g_)?set:Nn\s+(\\[a-zA-Z0-9_]+)\s*\{([^{}]*)\}/g, (_m, name: string, expr: string) => {
    fpVars.set(name, evalMathExpr(expr));
    return '';
  });
  out = out.replace(/\\seq_set_from_clist:Nn\s+(\\[a-zA-Z0-9_]+)\s*\{([^{}]*)\}/g, (_m, name: string, csv: string) => {
    const items = csv
      .split(',')
      .map((s) => s.trim().replace(/~/g, ' '))
      .filter(Boolean);
    seqVars.set(name, items);
    return '';
  });
  out = out.replace(/\\clist_set:Nn\s+(\\[a-zA-Z0-9_]+)\s*\{([^{}]*)\}/g, (_m, name: string, csv: string) => {
    const items = csv
      .split(',')
      .map((s) => s.trim().replace(/~/g, ' '))
      .filter(Boolean);
    seqVars.set(name, items);
    return '';
  });

  // 2. Parse \NewDocumentCommand / \DeclareDocumentCommand / \ProvideDocumentCommand & \newcommand with balanced braces
  const consumeBalancedCommandDefs = (input: string): string => {
    let cursor = 0;
    let rebuilt = '';
    const xparseRe = /\\(?:NewDocumentCommand|DeclareDocumentCommand|ProvideDocumentCommand)\b/g;
    while (cursor < input.length) {
      xparseRe.lastIndex = cursor;
      const m = xparseRe.exec(input);
      if (!m) {
        rebuilt += input.slice(cursor);
        break;
      }
      rebuilt += input.slice(cursor, m.index);
      let p = m.index + m[0].length;
      while (p < input.length && /\s/.test(input[p])) p += 1;
      const nameArg = extractBalancedArg(input, p);
      if (!nameArg) {
        rebuilt += m[0];
        cursor = m.index + m[0].length;
        continue;
      }
      p = nameArg.endIdx + 1;
      while (p < input.length && /\s/.test(input[p])) p += 1;
      const specArg = extractBalancedArg(input, p);
      if (!specArg) {
        rebuilt += m[0];
        cursor = m.index + m[0].length;
        continue;
      }
      p = specArg.endIdx + 1;
      while (p < input.length && /\s/.test(input[p])) p += 1;
      const bodyArg = extractBalancedArg(input, p);
      if (!bodyArg) {
        rebuilt += m[0];
        cursor = m.index + m[0].length;
        continue;
      }
      const cmdName = nameArg.content.trim();
      const argCount = (specArg.content.match(/[mMoOvV]/g) || []).length;
      customMacros.set(cmdName, { argCount, body: bodyArg.content });
      cursor = bodyArg.endIdx + 1;
    }
    return rebuilt;
  };

  const consumeBalancedNewcommandDefs = (input: string): string => {
    let cursor = 0;
    let rebuilt = '';
    const cmdRe = /\\(?:newcommand|renewcommand)\*?/g;
    while (cursor < input.length) {
      cmdRe.lastIndex = cursor;
      const m = cmdRe.exec(input);
      if (!m) {
        rebuilt += input.slice(cursor);
        break;
      }
      rebuilt += input.slice(cursor, m.index);
      let p = m.index + m[0].length;
      while (p < input.length && /\s/.test(input[p])) p += 1;
      const nameArg = extractBalancedArg(input, p);
      if (!nameArg) {
        rebuilt += m[0];
        cursor = m.index + m[0].length;
        continue;
      }
      p = nameArg.endIdx + 1;
      while (p < input.length && /\s/.test(input[p])) p += 1;
      let argCount = 0;
      if (input[p] === '[') {
        const closeBracket = input.indexOf(']', p);
        if (closeBracket !== -1) {
          argCount = Number.parseInt(input.slice(p + 1, closeBracket), 10) || 0;
          p = closeBracket + 1;
          while (p < input.length && /\s/.test(input[p])) p += 1;
        }
      }
      // Optional default arg [...]
      if (input[p] === '[') {
        const closeDefault = input.indexOf(']', p);
        if (closeDefault !== -1) {
          p = closeDefault + 1;
          while (p < input.length && /\s/.test(input[p])) p += 1;
        }
      }
      const bodyArg = extractBalancedArg(input, p);
      if (!bodyArg) {
        rebuilt += m[0];
        cursor = m.index + m[0].length;
        continue;
      }
      customMacros.set(nameArg.content.trim(), { argCount, body: bodyArg.content });
      cursor = bodyArg.endIdx + 1;
    }
    return rebuilt;
  };

  out = consumeBalancedCommandDefs(out);
  out = consumeBalancedNewcommandDefs(out);

  // 3. Expand \seq_map_inline:Nn & \clist_map_inline:Nn with balanced braces
  const expandBalancedSeqMap = (input: string): string => {
    let cursor = 0;
    let rebuilt = '';
    const mapRe = /\\(?:seq|clist)_map_inline:Nn\s+(\\[a-zA-Z0-9_]+)/g;
    while (cursor < input.length) {
      mapRe.lastIndex = cursor;
      const m = mapRe.exec(input);
      if (!m) {
        rebuilt += input.slice(cursor);
        break;
      }
      rebuilt += input.slice(cursor, m.index);
      let p = m.index + m[0].length;
      while (p < input.length && /\s/.test(input[p])) p += 1;
      const bodyArg = extractBalancedArg(input, p);
      if (!bodyArg) {
        rebuilt += m[0];
        cursor = m.index + m[0].length;
        continue;
      }
      const items = seqVars.get(m[1]) ?? [];
      rebuilt += items
        .map((item) => bodyArg.content.replace(/#1/g, item).replace(/~/g, ' '))
        .join(' ');
      cursor = bodyArg.endIdx + 1;
    }
    return rebuilt;
  };

  out = expandBalancedSeqMap(out);

  // 4. Expand custom macros (2 passes)
  for (let pass = 0; pass < 2; pass += 1) {
    for (const [cmdName, def] of customMacros.entries()) {
      const escaped = cmdName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (def.argCount === 0) {
        const re = new RegExp(`${escaped}(?:\\{\\})?(?![a-zA-Z0-9_:])`, 'g');
        out = out.replace(re, def.body);
      } else {
        let searchFrom = 0;
        while (searchFrom < out.length) {
          const idx = out.indexOf(cmdName, searchFrom);
          if (idx === -1) break;
          let cursor = idx + cmdName.length;
          // Skip optional [...] if present
          while (cursor < out.length && /\s/.test(out[cursor])) cursor += 1;
          if (out[cursor] === '[') {
            const close = out.indexOf(']', cursor);
            if (close !== -1) cursor = close + 1;
          }
          const args: string[] = [];
          let valid = true;
          for (let a = 0; a < def.argCount; a += 1) {
            while (cursor < out.length && /\s/.test(out[cursor])) cursor += 1;
            const arg = extractBalancedArg(out, cursor);
            if (!arg) {
              valid = false;
              break;
            }
            args.push(arg.content);
            cursor = arg.endIdx + 1;
          }
          if (!valid) {
            searchFrom = idx + cmdName.length;
            continue;
          }
          let expanded = def.body;
          for (let a = 0; a < args.length; a += 1) {
            expanded = expanded.replace(new RegExp(`#${a + 1}`, 'g'), args[a]);
          }
          out = out.slice(0, idx) + expanded + out.slice(cursor);
          searchFrom = idx + expanded.length;
        }
      }
    }

    // Expand \tl_use:N, \int_use:N, \int_eval:n, \fp_eval:n
    out = out.replace(/\\tl_use:N\s*(\\[a-zA-Z0-9_]+)/g, (_m, n: string) => tlVars.get(n) ?? '');
    out = out.replace(/\\int_use:N\s*(\\[a-zA-Z0-9_]+)/g, (_m, n: string) => String(intVars.get(n) ?? 0));
    out = out.replace(/\\fp_use:N\s*(\\[a-zA-Z0-9_]+)/g, (_m, n: string) => String(fpVars.get(n) ?? 0));
    out = out.replace(/\\int_eval:n\s*\{([^{}]+)\}/g, (_m, expr: string) => String(Math.trunc(evalMathExpr(expr))));
    out = out.replace(/\\fp_eval:n\s*\{([^{}]+)\}/g, (_m, expr: string) => {
      const val = evalMathExpr(expr);
      return Number.isInteger(val) ? String(val) : val.toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
    });
  }

  // Remove \ExplSyntaxOn / \ExplSyntaxOff / \tl_new:N declarations from visible text
  out = out.replace(/\\ExplSyntax(?:On|Off)/g, '');
  out = out.replace(/\\(?:tl|int|fp|seq|clist|bool)_new:N\s*\\[a-zA-Z0-9_]+/g, '');
  return out;
}

function parseBibTeXEntries(bibText: string): Map<string, ParsedBibItem> {
  const map = new Map<string, ParsedBibItem>();
  if (!bibText.trim()) return map;
  const entryRegex = /@([a-zA-Z]+)\s*\{\s*([^,\s]+)\s*,([\s\S]*?)\n\s*\}/g;
  for (const match of bibText.matchAll(entryRegex)) {
    const citeKey = match[2].trim();
    const body = match[3];
    const readField = (name: string): string => {
      const m = body.match(new RegExp(`${name}\\s*=\\s*(?:\\{([\\s\\S]*?)\\}|"([^"]*)")`, 'i'));
      return (m?.[1] || m?.[2] || '').replace(/\s+/g, ' ').trim();
    };
    map.set(citeKey, {
      citeKey,
      author: readField('author') || 'Unknown Author',
      year: readField('year') || 'n.d.',
      title: readField('title') || citeKey,
      venue: readField('journal') || readField('booktitle') || readField('publisher') || '',
    });
  }
  return map;
}

function prettifyInlineTeX(
  raw: string,
  bibMap: Map<string, ParsedBibItem>,
  citedKeysOrder: string[],
  labelNumbers: Map<string, string>
): string {
  let s = raw;

  // Resolve citations
  s = s.replace(/\\(cite|parencite|textcite|autocite|footcite)(?:\[([^\]]*)\])?\{([^}]+)\}/g, (_m, cmd: string, loc: string | undefined, keysStr: string) => {
    const keys = keysStr.split(',').map((k) => k.trim()).filter(Boolean);
    const nums: number[] = [];
    const authorYears: string[] = [];
    for (const k of keys) {
      let idx = citedKeysOrder.indexOf(k);
      if (idx === -1) {
        citedKeysOrder.push(k);
        idx = citedKeysOrder.length - 1;
      }
      nums.push(idx + 1);
      const item = bibMap.get(k);
      if (item) {
        const last = item.author.split(',')[0].split(' and ')[0].trim();
        authorYears.push(`${last}, ${item.year}`);
      } else {
        authorYears.push(k);
      }
    }
    const locSuffix = loc ? `, ${loc}` : '';
    if (cmd === 'parencite' || cmd === 'textcite') {
      return `(${authorYears.join('; ')}${locSuffix})`;
    }
    return `[${nums.join(', ')}${locSuffix}]`;
  });

  // Resolve \ref and \cref
  s = s.replace(/\\(?:cref|Cref|ref|eqref)\{([^}]+)\}/g, (_m, key: string) => labelNumbers.get(key.trim()) ?? '1');

  // Inline formatting commands
  s = s.replace(/\\(?:textbf|textit|emph|texttt|textsc|underline)\{([^{}]*)\}/g, '$1');
  s = s.replace(/\\(?:href|url)\{([^}]*)\}(?:\{([^}]*)\})?/g, (_m, u: string, label?: string) => label || u);
  s = s.replace(/\\qty\{([^}]+)\}\{([^}]+)\}/g, '$1 $2');
  s = s.replace(/\\today\b/g, new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }));
  s = s.replace(/\\LaTeX\b/g, 'LaTeX');
  s = s.replace(/\\TeX\b/g, 'TeX');

  // Inline math prettification
  s = s.replace(/\$([^$]+)\$/g, (_m, math: string) => prettifyMath(math));
  s = s.replace(/\\([a-zA-Z]+)\b/g, (_m, cmd: string) => UNICODE_ASCII_MAP[cmd] ?? '');
  s = s.replace(/\\([&%$#_{}])/g, '$1');
  s = s.replace(/[{}]/g, '');
  s = s.replace(/~/g, ' ');
  s = s.replace(/---/g, ' -- ').replace(/--/g, '-');
  return s.replace(/\s+/g, ' ').trim();
}

function prettifyMath(raw: string): string {
  let m = raw.trim();
  m = m.replace(/\\d?frac\{([^{}]+)\}\{([^{}]+)\}/g, '($1)/($2)');
  m = m.replace(/\\sqrt\{([^{}]+)\}/g, 'sqrt($1)');
  m = m.replace(/\\text\{([^{}]+)\}/g, '$1');
  m = m.replace(/\\(?:mathbf|mathrm|mathcal|mathbb)\{([^{}]+)\}/g, '$1');
  const map: Record<string, string> = {
    alpha: '\u03b1', beta: '\u03b2', gamma: '\u03b3', delta: '\u03b4', epsilon: '\u03b5',
    theta: '\u03b8', lambda: '\u03bb', mu: '\u03bc', pi: '\u03c0', sigma: '\u03c3',
    phi: '\u03c6', omega: '\u03c9', Sigma: '\u03a3', Delta: '\u0394', Omega: '\u03a9',
    sum: '\u2211', prod: '\u220f', int: '\u222b', infty: '\u221e', partial: '\u2202',
    nabla: '\u2207', leq: '\u2264', le: '\u2264', geq: '\u2265', ge: '\u2265',
    neq: '\u2260', approx: '\u2248', equiv: '\u2261', times: '\u00d7', pm: '\u00b1',
    cdot: '\u22c5', to: '\u2192', rightarrow: '\u2192', leftarrow: '\u2190',
    Rightarrow: '\u21d2', forall: '\u2200', exists: '\u2203', in: '\u2208',
    left: '', right: '', quad: '  ', qquad: '    ',
  };
  m = m.replace(/\\([a-zA-Z]+)/g, (_full, cmd: string) => map[cmd] ?? cmd);
  m = m.replace(/[{}]/g, '');
  return m.replace(/\s+/g, ' ').trim();
}

function parseTableBlock(envBody: string, line: number): TableCellBlock {
  const captionMatch = envBody.match(/\\caption\{([^}]*)\}/);
  const labelMatch = envBody.match(/\\label\{([^}]*)\}/);
  const tabularMatch = envBody.match(/\\begin\{tabularx?\}(?:\{[^}]*\})?\{([^}]*)\}([\s\S]*?)\\end\{tabularx?\}/);
  const colSpec = tabularMatch?.[1] || 'lll';
  const alignments = Array.from(colSpec.replace(/[^lcr]/g, '')).map(
    (c) => (c === 'c' ? 'c' : c === 'r' ? 'r' : 'l')
  );
  const inner = (tabularMatch?.[2] || envBody)
    .replace(/\\(?:toprule|midrule|bottomrule|hline)/g, '')
    .trim();

  const rawRows = inner
    .split(/\\\\/)
    .map((r) => r.trim())
    .filter((r) => r.length > 0 && !r.startsWith('\\caption') && !r.startsWith('\\label'));

  const rows = rawRows.map((rowStr, idx) => ({
    cells: rowStr.split('&').map((c) => c.replace(/\\textbf\{([^}]*)\}/g, '$1').replace(/[{}]/g, '').trim()),
    isHeader: idx === 0,
  }));

  return {
    kind: 'table',
    line,
    caption: captionMatch?.[1]?.trim() || '',
    label: labelMatch?.[1]?.trim() || '',
    alignments: alignments.length > 0 ? alignments : ['l', 'c', 'r'],
    rows,
  };
}

function parseChartBlock(envBody: string, line: number): ChartPlotBlock {
  const title = envBody.match(/title\s*=\s*\{([^}]*)\}/)?.[1] || 'Plot';
  const xLabel = envBody.match(/xlabel\s*=\s*\{([^}]*)\}/)?.[1] || 'X';
  const yLabel = envBody.match(/ylabel\s*=\s*\{([^}]*)\}/)?.[1] || 'Y';
  const isBar = /ybar/.test(envBody);
  const isScatter = /only marks/.test(envBody);
  const chartType: 'line' | 'bar' | 'scatter' = isBar ? 'bar' : isScatter ? 'scatter' : 'line';

  const points: Array<{ x: number; y: number }> = [];
  const coordsMatch = envBody.match(/coordinates\s*\{([\s\S]*?)\}/);
  if (coordsMatch) {
    for (const m of coordsMatch[1].matchAll(/\(\s*([-+]?\d*\.?\d+)\s*,\s*([-+]?\d*\.?\d+)\s*\)/g)) {
      points.push({ x: Number.parseFloat(m[1]), y: Number.parseFloat(m[2]) });
    }
  } else {
    const tableMatch = envBody.match(/table(?:\[[^\]]*\])?\s*\{([\s\S]*?)\}/);
    if (tableMatch) {
      for (const row of tableMatch[1].split(/\r?\n/)) {
        const parts = row.trim().split(/[\s,]+/);
        if (parts.length >= 2) {
          const x = Number.parseFloat(parts[0]);
          const y = Number.parseFloat(parts[1]);
          if (Number.isFinite(x) && Number.isFinite(y)) {
            points.push({ x, y });
          }
        }
      }
    }
  }

  return {
    kind: 'chart',
    line,
    chartType,
    title,
    xLabel,
    yLabel,
    points,
    caption: envBody.match(/\\caption\{([^}]*)\}/)?.[1] || '',
  };
}

export async function compileWithWebTypesetter(payload: CompilerPayload): Promise<CompilerOutput> {
  const start = performance.now();
  const { lines, diagnostics, logLines } = resolveInputsAndValidate(payload.mainTex, payload.files);
  const bibMap = parseBibTeXEntries(payload.bibContent);

  // Extract documentclass options
  const rawJoined = lines.map((l) => l.text).join('\n');
  const docClassMatch = rawJoined.match(/\\documentclass(?:\[([^\]]*)\])?\{([^}]+)\}/);
  const docOpts = (docClassMatch?.[1] || '').toLowerCase();
  const docClass = (docClassMatch?.[2] || 'article').toLowerCase();
  const isBeamer = docClass === 'beamer';
  const isA4 = docOpts.includes('a4paper');
  const baseFontPt = docOpts.includes('12pt') ? 12 : docOpts.includes('10pt') ? 10 : 11;
  const lineSpacingMult = /\\doublespacing\b/.test(rawJoined)
    ? 1.75
    : /\\onehalfspacing\b/.test(rawJoined)
      ? 1.4
      : 1.25;
  const showLineNumbers = /\\linenumbers\b/.test(rawJoined);

  // Expand expl3 & xparse macros across the joined text while preserving line count hints
  const expandedSource = expandExpl3AndXparse(rawJoined);
  const titleMatch = expandedSource.match(/\\title(?:\[[^\]]*\])?\{([\s\S]*?)\}/);
  const authorMatch = expandedSource.match(/\\author(?:\[[^\]]*\])?\{([\s\S]*?)\}/);
  const dateMatch = expandedSource.match(/\\date\{([\s\S]*?)\}/);

  const docStartIdx = expandedSource.indexOf('\\begin{document}');
  const docEndIdx = expandedSource.lastIndexOf('\\end{document}');
  const bodyText =
    docStartIdx >= 0
      ? expandedSource.slice(
          docStartIdx + '\\begin{document}'.length,
          docEndIdx > docStartIdx ? docEndIdx : undefined
        )
      : expandedSource;

  const lineOffset =
    docStartIdx >= 0 ? expandedSource.slice(0, docStartIdx + '\\begin{document}'.length).split('\n').length - 1 : 0;

  // First pass: collect labels for \ref
  const labelNumbers = new Map<string, string>();
  let secCounter = 0;
  let subCounter = 0;
  let figCounter = 0;
  let tabCounter = 0;
  for (const rawLine of bodyText.split('\n')) {
    if (/\\section\{/.test(rawLine)) {
      secCounter += 1;
      subCounter = 0;
    } else if (/\\subsection\{/.test(rawLine)) {
      subCounter += 1;
    } else if (/\\begin\{figure/.test(rawLine)) {
      figCounter += 1;
    } else if (/\\begin\{table/.test(rawLine)) {
      tabCounter += 1;
    }
    const lm = rawLine.match(/\\label\{([^}]+)\}/);
    if (lm) {
      const k = lm[1].trim();
      if (k.startsWith('fig:')) labelNumbers.set(k, String(Math.max(1, figCounter)));
      else if (k.startsWith('tab:')) labelNumbers.set(k, String(Math.max(1, tabCounter)));
      else labelNumbers.set(k, subCounter > 0 ? `${secCounter}.${subCounter}` : String(Math.max(1, secCounter)));
    }
  }

  // Parse body into blocks
  const blocks: DocBlock[] = [];
  const citedKeysOrder: string[] = [];
  const bodyLines = bodyText.split('\n');
  let secNum = 0;
  let subNum = 0;
  let subSubNum = 0;
  let eqNum = 0;
  let paraBuf: string[] = [];
  let paraStartLine = lineOffset + 1;

  const flushParagraph = () => {
    const joined = paraBuf.join(' ').trim();
    if (joined) {
      const clean = prettifyInlineTeX(joined, bibMap, citedKeysOrder, labelNumbers);
      if (clean) {
        blocks.push({ kind: 'paragraph', line: paraStartLine, text: clean });
      }
    }
    paraBuf = [];
  };

  for (let i = 0; i < bodyLines.length; i += 1) {
    const lineNum = lineOffset + i + 1;
    const rawLine = stripLineComment(bodyLines[i]).trim();

    if (!rawLine) {
      flushParagraph();
      continue;
    }

    if (rawLine === '\\maketitle') {
      flushParagraph();
      blocks.push({
        kind: 'title',
        line: lineNum,
        title: prettifyInlineTeX(titleMatch?.[1] || 'Untitled Document', bibMap, citedKeysOrder, labelNumbers),
        author: prettifyInlineTeX(authorMatch?.[1] || '', bibMap, citedKeysOrder, labelNumbers),
        date: prettifyInlineTeX(dateMatch?.[1] || '\\today', bibMap, citedKeysOrder, labelNumbers),
      });
      continue;
    }

    if (rawLine.startsWith('\\begin{abstract}')) {
      flushParagraph();
      const collected: string[] = [];
      const inline = rawLine.replace('\\begin{abstract}', '');
      if (inline) collected.push(inline);
      while (i + 1 < bodyLines.length && !bodyLines[i].includes('\\end{abstract}')) {
        i += 1;
        collected.push(stripLineComment(bodyLines[i]));
      }
      const absText = collected.join(' ').replace('\\end{abstract}', '').trim();
      blocks.push({
        kind: 'abstract',
        line: lineNum,
        text: prettifyInlineTeX(absText, bibMap, citedKeysOrder, labelNumbers),
      });
      continue;
    }

    if (rawLine.startsWith('\\begin{frame}')) {
      flushParagraph();
      const frameTitleMatch = rawLine.match(/\\begin\{frame\}(?:\{([^}]*)\})?/);
      blocks.push({ kind: 'slide-break', line: lineNum, title: frameTitleMatch?.[1] || 'Slide' });
      continue;
    }
    if (rawLine.startsWith('\\end{frame}')) {
      flushParagraph();
      continue;
    }

    const secMatch = rawLine.match(/^\\(part|chapter|section|subsection|subsubsection)(\*)?\{([^}]+)\}/);
    if (secMatch) {
      flushParagraph();
      const kind = secMatch[1];
      const starred = Boolean(secMatch[2]);
      const title = prettifyInlineTeX(secMatch[3], bibMap, citedKeysOrder, labelNumbers);
      let level = 1;
      let numberStr = '';
      if (kind === 'part' || kind === 'chapter' || kind === 'section') {
        level = 1;
        if (!starred) {
          secNum += 1;
          subNum = 0;
          subSubNum = 0;
          numberStr = `${secNum}.`;
        }
      } else if (kind === 'subsection') {
        level = 2;
        if (!starred) {
          subNum += 1;
          subSubNum = 0;
          numberStr = `${secNum}.${subNum}`;
        }
      } else {
        level = 3;
        if (!starred) {
          subSubNum += 1;
          numberStr = `${secNum}.${subNum}.${subSubNum}`;
        }
      }
      blocks.push({ kind: 'heading', line: lineNum, level, numberStr, title });
      continue;
    }

    if (rawLine.startsWith('\\begin{table}') || rawLine.startsWith('\\begin{table*}')) {
      flushParagraph();
      const envLines: string[] = [rawLine];
      while (i + 1 < bodyLines.length && !/\\end\{table\*?\}/.test(bodyLines[i])) {
        i += 1;
        envLines.push(stripLineComment(bodyLines[i]));
      }
      blocks.push(parseTableBlock(envLines.join('\n'), lineNum));
      continue;
    }

    if (rawLine.startsWith('\\begin{tikzpicture}')) {
      flushParagraph();
      const envLines: string[] = [rawLine];
      while (i + 1 < bodyLines.length && !bodyLines[i].includes('\\end{tikzpicture}')) {
        i += 1;
        envLines.push(stripLineComment(bodyLines[i]));
      }
      const joinedEnv = envLines.join('\n');
      if (joinedEnv.includes('axis')) {
        blocks.push(parseChartBlock(joinedEnv, lineNum));
      } else {
        blocks.push({
          kind: 'figure',
          line: lineNum,
          paths: [],
          caption: 'TikZ Diagram',
          label: '',
        });
      }
      continue;
    }

    if (rawLine.startsWith('\\begin{figure}') || rawLine.startsWith('\\begin{figure*}')) {
      flushParagraph();
      const envLines: string[] = [rawLine];
      while (i + 1 < bodyLines.length && !/\\end\{figure\*?\}/.test(bodyLines[i])) {
        i += 1;
        envLines.push(stripLineComment(bodyLines[i]));
      }
      const joinedEnv = envLines.join('\n');
      const paths = Array.from(joinedEnv.matchAll(/\\includegraphics(?:\[[^\]]*\])?\{([^}]+)\}/g)).map(
        (m) => m[1].trim()
      );
      const cap = joinedEnv.match(/\\caption\{([^}]*)\}/)?.[1] || '';
      const lbl = joinedEnv.match(/\\label\{([^}]*)\}/)?.[1] || '';
      blocks.push({ kind: 'figure', line: lineNum, paths, caption: cap, label: lbl });
      continue;
    }

    if (
      rawLine.startsWith('\\[') ||
      rawLine.startsWith('$$') ||
      rawLine.startsWith('\\begin{equation') ||
      rawLine.startsWith('\\begin{align')
    ) {
      flushParagraph();
      const envLines: string[] = [rawLine];
      const endTag = rawLine.startsWith('\\[')
        ? '\\]'
        : rawLine.startsWith('$$')
          ? '$$'
          : rawLine.startsWith('\\begin{equation')
            ? '\\end{equation'
            : '\\end{align';
      if (!rawLine.slice(2).includes(endTag)) {
        while (i + 1 < bodyLines.length && !bodyLines[i].includes(endTag)) {
          i += 1;
          envLines.push(stripLineComment(bodyLines[i]));
        }
      }
      const rawMath = envLines
        .join(' ')
        .replace(/\\\[|\\\]|\$\$/g, '')
        .replace(/\\(?:begin|end)\{(?:equation|align)\*?\}/g, '')
        .trim();
      const numbered = rawLine.startsWith('\\begin{equation}');
      if (numbered) eqNum += 1;
      blocks.push({
        kind: 'math',
        line: lineNum,
        latex: prettifyMath(rawMath),
        eqNumber: numbered ? `(${eqNum})` : undefined,
      });
      continue;
    }

    if (rawLine.startsWith('\\begin{verbatim}') || rawLine.startsWith('\\begin{lstlisting}')) {
      flushParagraph();
      const codeLines: string[] = [];
      while (
        i + 1 < bodyLines.length &&
        !bodyLines[i].includes('\\end{verbatim}') &&
        !bodyLines[i].includes('\\end{lstlisting}')
      ) {
        i += 1;
        if (
          !bodyLines[i].includes('\\end{verbatim}') &&
          !bodyLines[i].includes('\\end{lstlisting}')
        ) {
          codeLines.push(bodyLines[i]);
        }
      }
      blocks.push({ kind: 'code', line: lineNum, lines: codeLines });
      continue;
    }

    if (rawLine.startsWith('\\item')) {
      flushParagraph();
      const itemText = rawLine.replace(/^\\item(?:\[[^\]]*\])?\s*/, '');
      blocks.push({
        kind: 'list-item',
        line: lineNum,
        bullet: '\u2022',
        text: prettifyInlineTeX(itemText, bibMap, citedKeysOrder, labelNumbers),
        indent: 14,
      });
      continue;
    }

    if (
      /^\\(?:begin|end)\{(?:itemize|enumerate|center|flushleft)\}/.test(rawLine) ||
      /^\\(?:usepackage|printbibliography|bibliography|bibliographystyle|tableofcontents|newpage|clearpage|vspace|hspace)/.test(rawLine)
    ) {
      flushParagraph();
      continue;
    }

    if (paraBuf.length === 0) paraStartLine = lineNum;
    paraBuf.push(rawLine);
  }
  flushParagraph();

  // Append References section if citations were used
  if (citedKeysOrder.length > 0) {
    blocks.push({
      kind: 'heading',
      line: lines.length,
      level: 1,
      numberStr: '',
      title: 'References',
    });
    citedKeysOrder.forEach((key, idx) => {
      const entry = bibMap.get(key);
      const citationText = entry
        ? `${entry.author} (${entry.year}). ${entry.title}.${entry.venue ? ` ${entry.venue}.` : ''}`
        : `Reference key: ${key}`;
      blocks.push({
        kind: 'list-item',
        line: lines.length,
        bullet: `[${idx + 1}]`,
        text: citationText,
        indent: 18,
      });
    });
  }

  // Render PDF via pdf-lib
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  let bodyFont: PDFFont = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  let boldFont: PDFFont = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
  let italicFont: PDFFont = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);
  const monoFont: PDFFont = await pdfDoc.embedFont(StandardFonts.Courier);
  let hasCustomFont = false;

  if (payload.customFonts.length > 0) {
    try {
      const custom = await pdfDoc.embedFont(payload.customFonts[0].bytes);
      bodyFont = custom;
      hasCustomFont = true;
    } catch {
      // Fallback safely to StandardFonts
    }
  }

  const pageWidth = isBeamer ? 720 : isA4 ? 595.28 : 612;
  const pageHeight = isBeamer ? 450 : isA4 ? 841.89 : 792;
  const marginX = isBeamer ? 48 : 64;
  const marginTop = 62;
  const marginBottom = 58;
  const contentWidth = pageWidth - marginX * 2;

  let pages: PDFPage[] = [];
  let currentPage!: PDFPage;
  let cursorYFromTop = marginTop;
  let currentPageNum = 0;
  let lineCounter = 0;

  const synctexPages: Array<{ page: number; entries: string[] }> = [];

  const startNewPage = () => {
    currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
    pages.push(currentPage);
    currentPageNum = pages.length;
    cursorYFromTop = marginTop;
    synctexPages.push({ page: currentPageNum, entries: [] });
  };

  const ensureSpace = (neededHeight: number) => {
    if (cursorYFromTop + neededHeight > pageHeight - marginBottom) {
      startNewPage();
    }
  };

  const recordSyncBox = (line: number, xPt: number, yTopPt: number, widthPt: number, heightPt: number) => {
    const currentSync = synctexPages[synctexPages.length - 1];
    if (!currentSync) return;
    currentSync.entries.push(
      `h1,${Math.max(1, line)}:${formatSyncTeXSp(xPt)},${formatSyncTeXSp(yTopPt)}:${formatSyncTeXSp(
        Math.max(8, widthPt)
      )},${formatSyncTeXSp(Math.max(8, heightPt))},0`
    );
  };

  const drawTextLine = (
    text: string,
    line: number,
    xPt: number,
    sizePt: number,
    font: PDFFont,
    color = rgb(0.11, 0.13, 0.17)
  ) => {
    const safe = sanitizeForPdfFont(text, hasCustomFont && font === bodyFont);
    const baselineFromBottom = pageHeight - cursorYFromTop - sizePt;
    currentPage.drawText(safe, {
      x: xPt,
      y: baselineFromBottom,
      size: sizePt,
      font,
      color,
    });
    if (showLineNumbers && sizePt <= baseFontPt + 1) {
      lineCounter += 1;
      currentPage.drawText(String(lineCounter), {
        x: marginX - 24,
        y: baselineFromBottom,
        size: 8,
        font: monoFont,
        color: rgb(0.55, 0.58, 0.65),
      });
    }
    const widthPt = Math.min(contentWidth, font.widthOfTextAtSize(safe, sizePt));
    recordSyncBox(line, xPt, cursorYFromTop, widthPt, sizePt);
  };

  const wrapTextLines = (text: string, font: PDFFont, sizePt: number, maxWidth: number): string[] => {
    const safe = sanitizeForPdfFont(text, hasCustomFont && font === bodyFont);
    const words = safe.split(/\s+/).filter(Boolean);
    if (words.length === 0) return [];
    const result: string[] = [];
    let current = words[0];
    for (let i = 1; i < words.length; i += 1) {
      const candidate = `${current} ${words[i]}`;
      if (font.widthOfTextAtSize(candidate, sizePt) <= maxWidth) {
        current = candidate;
      } else {
        result.push(current);
        current = words[i];
      }
    }
    result.push(current);
    return result;
  };

  startNewPage();

  let tableCount = 0;
  let figureCount = 0;

  for (const block of blocks) {
    if (block.kind === 'slide-break') {
      if (cursorYFromTop > marginTop + 10) startNewPage();
      const barHeight = 36;
      currentPage.drawRectangle({
        x: 0,
        y: pageHeight - barHeight - 16,
        width: pageWidth,
        height: barHeight,
        color: rgb(0.12, 0.25, 0.48),
      });
      cursorYFromTop = 26;
      drawTextLine(block.title, block.line, marginX, 16, boldFont, rgb(1, 1, 1));
      cursorYFromTop = 76;
      continue;
    }

    if (block.kind === 'title') {
      const titleLines = wrapTextLines(block.title, boldFont, 18, contentWidth);
      ensureSpace(titleLines.length * 24 + 44);
      for (const tl of titleLines) {
        const w = boldFont.widthOfTextAtSize(tl, 18);
        drawTextLine(tl, block.line, marginX + Math.max(0, (contentWidth - w) / 2), 18, boldFont);
        cursorYFromTop += 24;
      }
      if (block.author) {
        const safeAuth = sanitizeForPdfFont(block.author, false);
        const w = bodyFont.widthOfTextAtSize(safeAuth, 12);
        drawTextLine(safeAuth, block.line, marginX + Math.max(0, (contentWidth - w) / 2), 12, bodyFont);
        cursorYFromTop += 16;
      }
      if (block.date) {
        const safeDate = sanitizeForPdfFont(block.date, false);
        const w = italicFont.widthOfTextAtSize(safeDate, 10.5);
        drawTextLine(
          safeDate,
          block.line,
          marginX + Math.max(0, (contentWidth - w) / 2),
          10.5,
          italicFont,
          rgb(0.35, 0.38, 0.45)
        );
        cursorYFromTop += 20;
      }
      cursorYFromTop += 8;
      continue;
    }

    if (block.kind === 'abstract') {
      const absWidth = contentWidth - 40;
      const linesOut = wrapTextLines(block.text, bodyFont, baseFontPt - 0.5, absWidth);
      ensureSpace(linesOut.length * 14 + 34);
      const heading = 'Abstract';
      const hw = boldFont.widthOfTextAtSize(heading, 11);
      drawTextLine(heading, block.line, marginX + (contentWidth - hw) / 2, 11, boldFont);
      cursorYFromTop += 16;
      for (const ln of linesOut) {
        drawTextLine(ln, block.line, marginX + 20, baseFontPt - 0.5, bodyFont);
        cursorYFromTop += (baseFontPt - 0.5) * lineSpacingMult;
      }
      cursorYFromTop += 10;
      continue;
    }

    if (block.kind === 'heading') {
      const size = block.level === 1 ? 14 : block.level === 2 ? 12 : 11;
      const fullTitle = block.numberStr ? `${block.numberStr}  ${block.title}` : block.title;
      const wrapped = wrapTextLines(fullTitle, boldFont, size, contentWidth);
      ensureSpace(wrapped.length * (size + 5) + 14);
      cursorYFromTop += block.level === 1 ? 10 : 6;
      for (const ln of wrapped) {
        drawTextLine(ln, block.line, marginX, size, boldFont);
        cursorYFromTop += size + 6;
      }
      cursorYFromTop += 2;
      continue;
    }

    if (block.kind === 'paragraph') {
      const wrapped = wrapTextLines(block.text, bodyFont, baseFontPt, contentWidth);
      const lineH = baseFontPt * lineSpacingMult;
      for (const ln of wrapped) {
        ensureSpace(lineH + 2);
        drawTextLine(ln, block.line, marginX, baseFontPt, bodyFont);
        cursorYFromTop += lineH;
      }
      cursorYFromTop += 6;
      continue;
    }

    if (block.kind === 'list-item') {
      const lineH = baseFontPt * lineSpacingMult;
      const wrapped = wrapTextLines(block.text, bodyFont, baseFontPt, contentWidth - block.indent - 12);
      ensureSpace(lineH + 2);
      drawTextLine(block.bullet, block.line, marginX + 4, baseFontPt, boldFont);
      for (const ln of wrapped) {
        ensureSpace(lineH + 2);
        drawTextLine(ln, block.line, marginX + block.indent + 8, baseFontPt, bodyFont);
        cursorYFromTop += lineH;
      }
      cursorYFromTop += 3;
      continue;
    }

    if (block.kind === 'math') {
      const boxH = 28;
      ensureSpace(boxH + 10);
      currentPage.drawRectangle({
        x: marginX,
        y: pageHeight - cursorYFromTop - boxH,
        width: contentWidth,
        height: boxH,
        color: rgb(0.965, 0.975, 0.99),
        borderColor: rgb(0.86, 0.89, 0.94),
        borderWidth: 0.7,
      });
      cursorYFromTop += 8;
      const safeMath = sanitizeForPdfFont(block.latex, false);
      const w = italicFont.widthOfTextAtSize(safeMath, baseFontPt);
      drawTextLine(
        safeMath,
        block.line,
        marginX + Math.max(12, (contentWidth - w) / 2),
        baseFontPt,
        italicFont,
        rgb(0.1, 0.16, 0.32)
      );
      if (block.eqNumber) {
        const nw = bodyFont.widthOfTextAtSize(block.eqNumber, baseFontPt);
        drawTextLine(block.eqNumber, block.line, marginX + contentWidth - nw - 10, baseFontPt, bodyFont);
      }
      cursorYFromTop += 26;
      continue;
    }

    if (block.kind === 'code') {
      const boxH = Math.max(24, block.lines.length * 13 + 12);
      ensureSpace(boxH + 8);
      currentPage.drawRectangle({
        x: marginX,
        y: pageHeight - cursorYFromTop - boxH,
        width: contentWidth,
        height: boxH,
        color: rgb(0.95, 0.96, 0.97),
        borderColor: rgb(0.84, 0.86, 0.9),
        borderWidth: 0.6,
      });
      cursorYFromTop += 8;
      for (const cl of block.lines) {
        drawTextLine(cl, block.line, marginX + 10, 9.5, monoFont);
        cursorYFromTop += 13;
      }
      cursorYFromTop += 10;
      continue;
    }

    if (block.kind === 'table') {
      tableCount += 1;
      const rowH = 18;
      const totalH = block.rows.length * rowH + 34;
      ensureSpace(totalH);
      if (block.caption) {
        drawTextLine(`Table ${tableCount}: ${block.caption}`, block.line, marginX, 10, boldFont);
        cursorYFromTop += 16;
      }
      const numCols = Math.max(1, ...block.rows.map((r) => r.cells.length));
      const colW = contentWidth / numCols;
      // Top rule
      currentPage.drawLine({
        start: { x: marginX, y: pageHeight - cursorYFromTop },
        end: { x: marginX + contentWidth, y: pageHeight - cursorYFromTop },
        thickness: 1.2,
        color: rgb(0.15, 0.18, 0.24),
      });
      cursorYFromTop += 4;
      for (let rIdx = 0; rIdx < block.rows.length; rIdx += 1) {
        const row = block.rows[rIdx];
        const f = row.isHeader ? boldFont : bodyFont;
        for (let cIdx = 0; cIdx < numCols; cIdx += 1) {
          const cellText = sanitizeForPdfFont(row.cells[cIdx] || '', false);
          drawTextLine(cellText, block.line, marginX + cIdx * colW + 4, 9.5, f);
        }
        cursorYFromTop += rowH;
        if (rIdx === 0) {
          currentPage.drawLine({
            start: { x: marginX, y: pageHeight - cursorYFromTop + 4 },
            end: { x: marginX + contentWidth, y: pageHeight - cursorYFromTop + 4 },
            thickness: 0.7,
            color: rgb(0.25, 0.28, 0.35),
          });
        }
      }
      currentPage.drawLine({
        start: { x: marginX, y: pageHeight - cursorYFromTop + 4 },
        end: { x: marginX + contentWidth, y: pageHeight - cursorYFromTop + 4 },
        thickness: 1.2,
        color: rgb(0.15, 0.18, 0.24),
      });
      cursorYFromTop += 12;
      continue;
    }

    if (block.kind === 'chart') {
      figureCount += 1;
      const chartW = contentWidth * 0.82;
      const chartH = 150;
      const chartX = marginX + (contentWidth - chartW) / 2;
      ensureSpace(chartH + 54);
      drawTextLine(block.title, block.line, chartX + chartW / 2 - 40, 10.5, boldFont);
      cursorYFromTop += 16;

      const boxTopY = pageHeight - cursorYFromTop;
      const boxBottomY = boxTopY - chartH;
      currentPage.drawRectangle({
        x: chartX,
        y: boxBottomY,
        width: chartW,
        height: chartH,
        color: rgb(0.99, 0.995, 1),
        borderColor: rgb(0.3, 0.35, 0.44),
        borderWidth: 0.9,
      });

      const pts = block.points.length > 0 ? block.points : [{ x: 1, y: 1 }, { x: 2, y: 2 }];
      const minX = Math.min(...pts.map((p) => p.x));
      const maxX = Math.max(...pts.map((p) => p.x), minX + 1);
      const minY = Math.min(0, ...pts.map((p) => p.y));
      const maxY = Math.max(...pts.map((p) => p.y), minY + 1);

      const pad = 18;
      const mapX = (x: number) => chartX + pad + ((x - minX) / (maxX - minX)) * (chartW - pad * 2);
      const mapY = (y: number) => boxBottomY + pad + ((y - minY) / (maxY - minY)) * (chartH - pad * 2);

      // Grid lines
      for (let g = 1; g <= 3; g += 1) {
        const gy = boxBottomY + pad + (g / 4) * (chartH - pad * 2);
        currentPage.drawLine({
          start: { x: chartX + pad, y: gy },
          end: { x: chartX + chartW - pad, y: gy },
          thickness: 0.4,
          color: rgb(0.86, 0.88, 0.92),
        });
      }

      if (block.chartType === 'bar') {
        const bw = Math.max(8, (chartW - pad * 2) / (pts.length * 1.8));
        for (const pt of pts) {
          const px = mapX(pt.x) - bw / 2;
          const py = mapY(pt.y);
          const base = mapY(minY);
          currentPage.drawRectangle({
            x: px,
            y: base,
            width: bw,
            height: Math.max(2, py - base),
            color: rgb(0.18, 0.46, 0.82),
          });
        }
      } else {
        for (let idx = 0; idx < pts.length; idx += 1) {
          const px = mapX(pts[idx].x);
          const py = mapY(pts[idx].y);
          if (block.chartType === 'line' && idx > 0) {
            currentPage.drawLine({
              start: { x: mapX(pts[idx - 1].x), y: mapY(pts[idx - 1].y) },
              end: { x: px, y: py },
              thickness: 1.6,
              color: rgb(0.15, 0.42, 0.8),
            });
          }
          currentPage.drawCircle({
            x: px,
            y: py,
            size: 3,
            color: rgb(0.12, 0.34, 0.68),
          });
        }
      }

      recordSyncBox(block.line, chartX, cursorYFromTop, chartW, chartH);
      cursorYFromTop += chartH + 14;
      drawTextLine(
        `Figure ${figureCount}: ${block.caption || `${block.xLabel} vs. ${block.yLabel}`}`,
        block.line,
        marginX,
        9.5,
        italicFont
      );
      cursorYFromTop += 16;
      continue;
    }

    if (block.kind === 'figure') {
      figureCount += 1;
      const figH = 120;
      ensureSpace(figH + 34);
      const count = Math.max(1, block.paths.length);
      const slotW = (contentWidth - (count - 1) * 12) / count;

      for (let idx = 0; idx < count; idx += 1) {
        const assetPath = block.paths[idx];
        const rawBytes = assetPath ? payload.binaryAssets[assetPath] : undefined;
        const slotX = marginX + idx * (slotW + 12);
        let embedded = false;

        if (rawBytes && assetPath) {
          try {
            const lower = assetPath.toLowerCase();
            const image = lower.endsWith('.png')
              ? await pdfDoc.embedPng(rawBytes)
              : lower.endsWith('.jpg') || lower.endsWith('.jpeg')
                ? await pdfDoc.embedJpg(rawBytes)
                : null;
            if (image) {
              const scale = Math.min(slotW / image.width, figH / image.height);
              const drawW = image.width * scale;
              const drawH = image.height * scale;
              currentPage.drawImage(image, {
                x: slotX + (slotW - drawW) / 2,
                y: pageHeight - cursorYFromTop - drawH,
                width: drawW,
                height: drawH,
              });
              embedded = true;
            }
          } catch {
            embedded = false;
          }
        }

        if (!embedded) {
          currentPage.drawRectangle({
            x: slotX,
            y: pageHeight - cursorYFromTop - figH,
            width: slotW,
            height: figH,
            color: rgb(0.95, 0.96, 0.98),
            borderColor: rgb(0.75, 0.79, 0.85),
            borderWidth: 0.8,
          });
          const labelTxt = assetPath ? `Figure Asset: ${assetPath}` : 'TikZ / Vector Figure';
          drawTextLine(labelTxt, block.line, slotX + 12, 9.5, italicFont, rgb(0.4, 0.45, 0.55));
        }
      }

      recordSyncBox(block.line, marginX, cursorYFromTop, contentWidth, figH);
      cursorYFromTop += figH + 14;
      if (block.caption) {
        drawTextLine(`Figure ${figureCount}: ${block.caption}`, block.line, marginX, 9.5, italicFont);
        cursorYFromTop += 16;
      }
    }
  }

  // Draw page numbers
  pages.forEach((p, idx) => {
    const numStr = String(idx + 1);
    const w = bodyFont.widthOfTextAtSize(numStr, 10);
    p.drawText(numStr, {
      x: (pageWidth - w) / 2,
      y: 26,
      size: 10,
      font: bodyFont,
      color: rgb(0.35, 0.38, 0.45),
    });
  });

  const pdfBytes = await pdfDoc.save();
  const synctexLines: string[] = ['SyncTeX Version:1', 'Input:1:main.tex'];
  for (const sp of synctexPages) {
    synctexLines.push(`{${sp.page}`);
    synctexLines.push(...sp.entries);
    synctexLines.push(`}${sp.page}`);
  }

  const durationMs = Math.max(1, Math.round(performance.now() - start));
  logLines.push(`Output written on main.pdf (${pages.length} page(s), ${pdfBytes.byteLength} bytes).`);

  return {
    engine: 'web-typesetter',
    pdfBytes,
    logText: logLines.join('\n'),
    synctexText: synctexLines.join('\n'),
    pageCount: pages.length,
    diagnostics,
    durationMs,
  };
}
