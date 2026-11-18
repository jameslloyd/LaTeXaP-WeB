import type {
  FigureInsertConfig,
  PGFPlotChartConfig,
  TableGridData,
} from '@shared/types/academic.js';

const DANGEROUS_TEX_COMMAND_RE =
  /\\(?:write18|immediate|openout|newwrite|catcode|input|include|@@input|verbatiminput|lstinputlisting|ShellEscape|pdffilemoddate|directlua)\b/gi;

const SAFE_MATH_COMMANDS = new Set([
  'frac', 'dfrac', 'tfrac', 'sqrt', 'sum', 'prod', 'int', 'lim',
  'sin', 'cos', 'tan', 'log', 'ln', 'exp', 'min', 'max', 'sup', 'inf', 'arg',
  'alpha', 'beta', 'gamma', 'delta', 'epsilon', 'varepsilon', 'zeta', 'eta',
  'theta', 'vartheta', 'iota', 'kappa', 'lambda', 'mu', 'nu', 'xi',
  'pi', 'rho', 'sigma', 'tau', 'upsilon', 'phi', 'varphi', 'chi', 'psi', 'omega',
  'Gamma', 'Delta', 'Theta', 'Lambda', 'Xi', 'Pi', 'Sigma', 'Phi', 'Psi', 'Omega',
  'cdot', 'times', 'pm', 'mp', 'leq', 'le', 'geq', 'ge', 'neq', 'approx', 'equiv', 'sim',
  'infty', 'partial', 'nabla', 'mathbb', 'mathcal', 'mathrm', 'mathbf', 'text',
  'left', 'right', 'bar', 'hat', 'tilde', 'vec', 'dots', 'ldots', 'cdots',
  'to', 'rightarrow', 'leftarrow', 'Rightarrow', 'forall', 'exists', 'in', 'notin', 'subset', 'cup', 'cap',
]);

function stripControlChars(input: string): string {
  return Array.from(input || '')
    .filter((ch) => {
      const code = ch.charCodeAt(0);
      if (ch === ' ') return true;
      if (ch === '\n' || ch === '\r' || ch === '\t') return false;
      return code >= 0x20 && code !== 0x7f;
    })
    .join('');
}

function escapePlainFragment(text: string): string {
  let out = '';
  for (const ch of text) {
    switch (ch) {
      case '\\':
        out += '\\textbackslash{}';
        break;
      case '{':
        out += '\\{';
        break;
      case '}':
        out += '\\}';
        break;
      case '&':
        out += '\\&';
        break;
      case '%':
        out += '\\%';
        break;
      case '$':
        out += '\\$';
        break;
      case '#':
        out += '\\#';
        break;
      case '_':
        out += '\\_';
        break;
      case '~':
        out += '\\textasciitilde{}';
        break;
      case '^':
        out += '\\textasciicircum{}';
        break;
      default:
        out += ch;
    }
  }
  return out;
}

function isSafeMathSegment(segment: string): boolean {
  let braceDepth = 0;
  let i = 0;
  while (i < segment.length) {
    const ch = segment[i];
    if (ch === '\\') {
      i += 1;
      if (i >= segment.length) return false;
      if (/[a-zA-Z]/.test(segment[i])) {
        let cmd = '';
        while (i < segment.length && /[a-zA-Z]/.test(segment[i])) {
          cmd += segment[i];
          i += 1;
        }
        if (!SAFE_MATH_COMMANDS.has(cmd)) return false;
        continue;
      } else if (segment[i] === ',' || segment[i] === ';' || segment[i] === ' ' || segment[i] === '|') {
        i += 1;
        continue;
      } else {
        return false;
      }
    } else if (ch === '{') {
      braceDepth += 1;
    } else if (ch === '}') {
      braceDepth -= 1;
      if (braceDepth < 0) return false;
    }
    i += 1;
  }
  return braceDepth === 0;
}

function containsBalancedSimpleMath(text: string): boolean {
  const parts = text.split('$');
  if (parts.length < 3 || (parts.length - 1) % 2 !== 0) return false;
  for (let idx = 1; idx < parts.length; idx += 2) {
    if (!parts[idx] || !isSafeMathSegment(parts[idx])) return false;
  }
  return true;
}

export const AcademicSanitizer = {
  escapeLaTeXText(raw: string, allowSafeInlineMath = false): string {
    const cleaned = stripControlChars(raw).trim().replace(DANGEROUS_TEX_COMMAND_RE, '');
    if (allowSafeInlineMath && containsBalancedSimpleMath(cleaned)) {
      const parts = cleaned.split('$');
      return parts
        .map((part, idx) => {
          if (idx % 2 === 0) return escapePlainFragment(part);
          const safeMath = part.replace(/&/g, '\\&').replace(/%/g, '\\%').replace(/#/g, '\\#');
          return `$${safeMath}$`;
        })
        .join('');
    }
    return escapePlainFragment(cleaned);
  },

  sanitizeExternalMetadata(raw: string, fallback = ''): string {
    const cleaned = stripControlChars(raw).replace(/[\\{}]/g, '').trim();
    const escaped = escapePlainFragment(cleaned);
    return escaped || fallback;
  },

  sanitizeIdentifier(raw: string, fallback = 'item'): string {
    let out = (raw || '')
      .trim()
      .replace(/ /g, '-')
      .replace(/[^a-zA-Z0-9_:.-]/g, '');
    while (out.includes('..')) {
      out = out.replace(/\.\./g, '.');
    }
    out = out.replace(/^[.:-]+|[.:-]+$/g, '');
    return out || fallback;
  },

  sanitizeCitationLocator(raw: string): string {
    return (raw || '')
      .replace(/[{}\\%$\r\n#&~^_\[\]\t\0\x00-\x1f]/g, '')
      .trim();
  },

  sanitizeFigureFileName(raw: string, defaultExtension = 'png'): string {
    const leaf = (raw || '').split(/[\\/]/).pop() || `figure.${defaultExtension}`;
    const dotIdx = leaf.lastIndexOf('.');
    const stemRaw = dotIdx > 0 ? leaf.slice(0, dotIdx) : leaf;
    const extRaw = (dotIdx > 0 ? leaf.slice(dotIdx + 1) : defaultExtension).toLowerCase();
    const safeStem =
      stemRaw
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'figure';
    const allowed = new Set(['png', 'jpg', 'jpeg', 'pdf', 'svg', 'webp']);
    const finalExt = allowed.has(extRaw) ? extRaw : defaultExtension;
    return `${safeStem}.${finalExt}`;
  },

  validatedRelativeAssetPath(raw: string, allowedPrefixes?: string[]): string | null {
    const trimmed = (raw || '').trim();
    if (
      !trimmed ||
      trimmed.startsWith('/') ||
      trimmed.startsWith('\\') ||
      trimmed.includes('..') ||
      trimmed.includes('\\') ||
      trimmed.includes(':') ||
      trimmed.includes('\0') ||
      /[\x00-\x1f]/.test(trimmed)
    ) {
      return null;
    }
    const parts = trimmed.split('/');
    if (parts.some((p) => !p || p === '.' || p === '..')) return null;
    if (allowedPrefixes && allowedPrefixes.length > 0) {
      const ok = allowedPrefixes.some((pfx) => trimmed === pfx || trimmed.startsWith(`${pfx}/`));
      if (!ok) return null;
    }
    return parts.join('/');
  },

  sanitizePlacement(raw: string): string {
    const filtered = (raw || '').replace(/[^htbpH!]/g, '').slice(0, 5);
    return filtered || 'htbp';
  },
};

export function generateBooktabsTable(grid: TableGridData): string {
  const colCount = Math.max(1, grid.headers.length);
  const aligns = Array.from({ length: colCount }, (_, i) => grid.alignments[i] ?? 'l').join('');
  const headerCells = grid.headers.map((h) => {
    const safe = AcademicSanitizer.escapeLaTeXText(h, true);
    return grid.boldHeader ? `\\textbf{${safe}}` : safe;
  });

  const bodyRows = grid.rows.map((row) => {
    const cells = Array.from({ length: colCount }, (_, i) =>
      AcademicSanitizer.escapeLaTeXText(row[i] ?? '', true)
    );
    return `    ${cells.join(' & ')} \\\\`;
  });

  const caption = AcademicSanitizer.escapeLaTeXText(grid.caption || 'Table caption.', true);
  const label = AcademicSanitizer.sanitizeIdentifier(grid.label || 'tab:data', 'tab:data');

  return `\\begin{table}[htbp]
  \\centering
  \\caption{${caption}}
  \\label{${label}}
  \\begin{tabular}{${aligns}}
    \\toprule
    ${headerCells.join(' & ')} \\\\
    \\midrule
${bodyRows.join('\n')}
    \\bottomrule
  \\end{tabular}
\\end{table}
`;
}

export function generatePGFPlotChart(chart: PGFPlotChartConfig): string {
  const safeTitle = AcademicSanitizer.escapeLaTeXText(chart.title || 'Chart');
  const safeX = AcademicSanitizer.escapeLaTeXText(chart.xLabel || 'X');
  const safeY = AcademicSanitizer.escapeLaTeXText(chart.yLabel || 'Y');
  const safeCaption = AcademicSanitizer.escapeLaTeXText(chart.caption || 'Plot overview.');
  const safeLabel = AcademicSanitizer.sanitizeIdentifier(chart.label || 'fig:chart', 'fig:chart');

  const points: Array<{ x: string; y: string }> = [];
  for (const rawLine of (chart.csvText || '').split(/\r?\n/)) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;
    const parts = trimmed.split(/[,\t;]+/).map((p) => p.trim());
    if (parts.length < 2) continue;
    const xNum = Number.parseFloat(parts[0]);
    const yNum = Number.parseFloat(parts[1]);
    if (Number.isFinite(xNum) && Number.isFinite(yNum)) {
      points.push({ x: String(xNum), y: String(yNum) });
    }
  }
  if (points.length === 0) {
    points.push({ x: '1', y: '1' }, { x: '2', y: '2' });
  }

  const axisOpts = [
    `title={${safeTitle}}`,
    `xlabel={${safeX}}`,
    `ylabel={${safeY}}`,
  ];
  if (chart.showGrid) axisOpts.push('grid=major');
  if (chart.chartType === 'bar') axisOpts.push('ybar');

  const plotOpts =
    chart.chartType === 'scatter'
      ? '[only marks, mark=*]'
      : chart.chartType === 'bar'
        ? '[fill=blue!45]'
        : '[mark=*, thick]';

  const coords = points.map((p) => `      (${p.x}, ${p.y})`).join('\n');
  const legendLine = chart.showLegend ? `\n    \\legend{${safeY}}` : '';

  return `\\begin{figure}[htbp]
  \\centering
  \\begin{tikzpicture}
    \\begin{axis}[
      ${axisOpts.join(',\n      ')}
    ]
    \\addplot${plotOpts} coordinates {
${coords}
    };${legendLine}
    \\end{axis}
  \\end{tikzpicture}
  \\caption{${safeCaption}}
  \\label{${safeLabel}}
\\end{figure}
`;
}

export function generateFigureSnippet(config: FigureInsertConfig): string {
  const placement = AcademicSanitizer.sanitizePlacement(config.placement);
  const caption = AcademicSanitizer.escapeLaTeXText(config.caption || 'Figure caption.', true);
  const label = AcademicSanitizer.sanitizeIdentifier(config.label || 'fig:overview', 'fig:overview');
  const primaryPath =
    AcademicSanitizer.validatedRelativeAssetPath(config.primaryRelativePath, ['figures']) ??
    'figures/figure.png';
  const width = Math.min(1.0, Math.max(0.25, config.widthFraction || 0.75)).toFixed(2);

  const secondaryPath = config.secondaryRelativePath
    ? AcademicSanitizer.validatedRelativeAssetPath(config.secondaryRelativePath, ['figures'])
    : null;

  if (secondaryPath) {
    const subA = AcademicSanitizer.escapeLaTeXText(config.primarySubcaption || 'Condition A', true);
    const subB = AcademicSanitizer.escapeLaTeXText(config.secondarySubcaption || 'Condition B', true);
    return `\\begin{figure}[${placement}]
  \\centering
  \\begin{subfigure}{0.48\\textwidth}
    \\centering
    \\includegraphics[width=\\linewidth]{${primaryPath}}
    \\caption{${subA}}
  \\end{subfigure}\\hfill
  \\begin{subfigure}{0.48\\textwidth}
    \\centering
    \\includegraphics[width=\\linewidth]{${secondaryPath}}
    \\caption{${subB}}
  \\end{subfigure}
  \\caption{${caption}}
  \\label{${label}}
\\end{figure}
`;
  }

  return `\\begin{figure}[${placement}]
  \\centering
  \\includegraphics[width=${width}\\textwidth]{${primaryPath}}
  \\caption{${caption}}
  \\label{${label}}
\\end{figure}
`;
}

export function generateMatrixSnippet(
  rows: number,
  cols: number,
  env: 'pmatrix' | 'bmatrix' | 'vmatrix' | 'Bmatrix' = 'bmatrix',
  cells?: string[][]
): string {
  const rCount = Math.min(8, Math.max(1, rows));
  const cCount = Math.min(8, Math.max(1, cols));
  const bodyRows: string[] = [];
  for (let r = 0; r < rCount; r += 1) {
    const rowCells: string[] = [];
    for (let c = 0; c < cCount; c += 1) {
      rowCells.push(cells?.[r]?.[c] ?? `a_{${r + 1}${c + 1}}`);
    }
    bodyRows.push(`  ${rowCells.join(' & ')}${r < rCount - 1 ? ' \\\\' : ''}`);
  }
  return `\\begin{${env}}\n${bodyRows.join('\n')}\n\\end{${env}}`;
}
