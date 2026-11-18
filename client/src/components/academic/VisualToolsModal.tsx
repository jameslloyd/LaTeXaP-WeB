import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BarChart3, Grid, Sigma, Table, X } from 'lucide-react';
import type { PGFPlotChartConfig, PGFPlotChartType, TableColumnAlignment, TableGridData } from '@shared/types';

export interface VisualToolsModalProps {
  open: boolean;
  initialTab?: 'math' | 'matrix' | 'table' | 'chart';
  onClose: () => void;
  onInsertMath: (tex: string) => void;
  onInsertTable: (grid: TableGridData) => void;
  onInsertChart: (chart: PGFPlotChartConfig) => void;
}

const MATH_SNIPPETS = [
  { label: 'Fraction', code: '\\frac{a}{b}' },
  { label: 'Summation', code: '\\sum_{i=1}^{n} x_i' },
  { label: 'Integral', code: '\\int_{a}^{b} f(x)\\,dx' },
  { label: 'Piecewise cases', code: '\\begin{cases}\n  x & x \\ge 0 \\\\\n  0 & x < 0\n\\end{cases}' },
  { label: 'siunitx \\qty', code: '\\qty{9.81}{m/s^2}' },
  { label: 'Partial Deriv', code: '\\frac{\\partial f}{\\partial x}' },
  { label: 'Limit', code: '\\lim_{n \\to \\infty} a_n' },
  { label: 'Norm', code: '\\left\\lVert x \\right\\rVert_2' },
];

const GREEK_AND_OPS = [
  '\\alpha', '\\beta', '\\gamma', '\\delta', '\\epsilon', '\\theta', '\\lambda', '\\mu', '\\pi', '\\sigma', '\\phi', '\\omega',
  '\\sum', '\\prod', '\\int', '\\nabla', '\\partial', '\\infty', '\\le', '\\ge', '\\neq', '\\approx', '\\equiv', '\\in', '\\subset', '\\forall', '\\exists', '\\implies',
];

function sanitizeTableCell(val: string): string {
  return val
    .replace(/\\/g, '\\textbackslash{}')
    .replace(/([&%$#_{}])/g, '\\$1');
}

export const VisualToolsModal: React.FC<VisualToolsModalProps> = ({
  open,
  initialTab = 'math',
  onClose,
  onInsertMath,
  onInsertTable,
  onInsertChart,
}) => {
  const [tab, setTab] = useState<'math' | 'matrix' | 'table' | 'chart'>(initialTab);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);

  // Matrix state
  const [matRows, setMatRows] = useState(2);
  const [matCols, setMatCols] = useState(2);
  const [matBracket, setMatBracket] = useState<'pmatrix' | 'bmatrix' | 'vmatrix' | 'Bmatrix'>('pmatrix');
  const [matCells, setMatCells] = useState<string[][]>(() =>
    Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => '0'))
  );

  // Table state
  const [tableInputMode, setTableInputMode] = useState<'grid' | 'csv'>('grid');
  const [headers, setHeaders] = useState<string[]>(['Method', 'Accuracy', 'Latency']);
  const [rows, setRows] = useState<string[][]>([
    ['Baseline', '89.2%', '14 ms'],
    ['LaTeXaP-Net', '94.8%', '11 ms'],
  ]);
  const [alignments, setAlignments] = useState<TableColumnAlignment[]>(['l', 'r', 'r']);
  const [boldHeader, setBoldHeader] = useState(true);
  const [tableCaption, setTableCaption] = useState('Comparison of model accuracy and latency.');
  const [tableLabel, setTableLabel] = useState('tab:results');
  const [csvPaste, setCsvPaste] = useState('Method,Accuracy,Latency\nBaseline,89.2%,14 ms\nLaTeXaP-Net,94.8%,11 ms');
  const [tableLabelError, setTableLabelError] = useState<string | null>(null);

  // Chart state
  const [chartType, setChartType] = useState<PGFPlotChartType>('line');
  const [chartTitle, setChartTitle] = useState('Training Loss vs Epoch');
  const [xLabel, setXLabel] = useState('Epoch');
  const [yLabel, setYLabel] = useState('Loss');
  const [chartCsv, setChartCsv] = useState('1,0.82\n2,0.54\n3,0.36\n4,0.24\n5,0.18');
  const [showGrid, setShowGrid] = useState(true);
  const [showLegend, setShowLegend] = useState(false);
  const [chartCaption, setChartCaption] = useState('Convergence curve across 5 epochs.');
  const [chartLabel, setChartLabel] = useState('fig:loss-curve');

  useEffect(() => {
    if (!open) return;
    setTab(initialTab);
    setTableLabelError(null);
    requestAnimationFrame(() => closeBtnRef.current?.focus());
  }, [initialTab, open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const matrixTeX = useMemo(() => {
    const body = Array.from({ length: matRows }, (_, r) =>
      Array.from({ length: matCols }, (_, c) => matCells[r]?.[c] || '0').join(' & ')
    ).join(' \\\\\n  ');
    return `\\begin{${matBracket}}\n  ${body}\n\\end{${matBracket}}`;
  }, [matBracket, matCells, matCols, matRows]);

  const tableTeXPreview = useMemo(() => {
    const colSpec = alignments.join('');
    const headerLine = headers
      .map((h) => (boldHeader ? `\\textbf{${sanitizeTableCell(h)}}` : sanitizeTableCell(h)))
      .join(' & ');
    const rowLines = rows.map((r) => r.map(sanitizeTableCell).join(' & ')).join(' \\\\\n    ');
    return `\\begin{table}[htbp]\n  \\centering\n  \\caption{${sanitizeTableCell(tableCaption)}}\n  \\label{${tableLabel}}\n  \\begin{tabular}{${colSpec}}\n    \\toprule\n    ${headerLine} \\\\\n    \\midrule\n    ${rowLines} \\\\\n    \\bottomrule\n  \\end{tabular}\n\\end{table}`;
  }, [alignments, boldHeader, headers, rows, tableCaption, tableLabel]);

  const chartTeXPreview = useMemo(() => {
    const coords = chartCsv
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [x, y] = line.split(/[,\t]/).map((s) => s.trim());
        return `(${x || '0'},${y || '0'})`;
      })
      .join(' ');
    const plotOpts =
      chartType === 'bar'
        ? 'ybar, fill=blue!45'
        : chartType === 'scatter'
          ? 'only marks, mark=*'
          : 'thick, mark=*';
    return `\\begin{figure}[htbp]\n  \\centering\n  \\begin{tikzpicture}\n    \\begin{axis}[\n      title={${chartTitle}},\n      xlabel={${xLabel}},\n      ylabel={${yLabel}},\n      ${showGrid ? 'grid=major,' : ''}\n    ]\n      \\addplot[${plotOpts}] coordinates { ${coords} };\n    \\end{axis}\n  \\end{tikzpicture}\n  \\caption{${chartCaption}}\n  \\label{${chartLabel}}\n\\end{figure}`;
  }, [chartCaption, chartCsv, chartLabel, chartTitle, chartType, showGrid, xLabel, yLabel]);

  if (!open) return null;

  const parseCsvToTable = () => {
    const lines = csvPaste
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) return;
    const splitRow = (line: string) => line.split(line.includes('\t') ? '\t' : ',').map((c) => c.trim());
    const parsedHeaders = splitRow(lines[0]).slice(0, 12);
    const parsedRows = lines.slice(1, 31).map((l) => {
      const cells = splitRow(l);
      return parsedHeaders.map((_, idx) => cells[idx] ?? '');
    });
    setHeaders(parsedHeaders);
    setRows(parsedRows.length > 0 ? parsedRows : [parsedHeaders.map(() => '')]);
    setAlignments(parsedHeaders.map((_, idx) => alignments[idx] ?? 'l'));
    setTableInputMode('grid');
  };

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="visual-tools-title"
        className="modal-dialog"
        style={{ maxWidth: 800, height: 580 }}
      >
        <div className="modal-header">
          <h2 id="visual-tools-title" className="modal-title">
            Visual Authoring Tools (Math, Matrices, Tables &amp; Charts)
          </h2>
          <button
            ref={closeBtnRef}
            type="button"
            className="btn btn-icon btn-ghost"
            aria-label="Close Visual Tools"
            onClick={onClose}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <div
          role="tablist"
          aria-label="Visual Tool Mode"
          style={{
            display: 'flex',
            gap: 6,
            padding: '8px 18px',
            borderBottom: '1px solid var(--border-subtle)',
            background: 'var(--bg-surface-subtle)',
          }}
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'math'}
            className={`btn btn-sm ${tab === 'math' ? 'btn-primary' : ''}`}
            onClick={() => setTab('math')}
          >
            <Sigma size={12} aria-hidden="true" />
            Math Palette
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'matrix'}
            className={`btn btn-sm ${tab === 'matrix' ? 'btn-primary' : ''}`}
            onClick={() => setTab('matrix')}
          >
            <Grid size={12} aria-hidden="true" />
            Matrix Builder
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'table'}
            className={`btn btn-sm ${tab === 'table' ? 'btn-primary' : ''}`}
            onClick={() => setTab('table')}
          >
            <Table size={12} aria-hidden="true" />
            Booktabs Table
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'chart'}
            className={`btn btn-sm ${tab === 'chart' ? 'btn-primary' : ''}`}
            onClick={() => setTab('chart')}
          >
            <BarChart3 size={12} aria-hidden="true" />
            PGFPlots Chart
          </button>
        </div>

        <div className="modal-body">
          {tab === 'math' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <div className="sidebar-section-heading">Quick Academic Equations</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {MATH_SNIPPETS.map((s) => (
                    <button
                      key={s.label}
                      type="button"
                      className="btn"
                      onClick={() => {
                        onInsertMath(s.code);
                        onClose();
                      }}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="sidebar-section-heading">Greek Letters &amp; Operators</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {GREEK_AND_OPS.map((op) => (
                    <button
                      key={op}
                      type="button"
                      className="btn btn-sm"
                      style={{ fontFamily: 'var(--font-mono)' }}
                      onClick={() => {
                        onInsertMath(`${op} `);
                        onClose();
                      }}
                    >
                      {op}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === 'matrix' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <label>
                  Rows:{' '}
                  <input
                    type="number"
                    min={1}
                    max={8}
                    className="input"
                    style={{ width: 64, display: 'inline-block' }}
                    value={matRows}
                    onChange={(e) => setMatRows(Math.min(8, Math.max(1, Number(e.target.value) || 1)))}
                  />
                </label>
                <label>
                  Cols:{' '}
                  <input
                    type="number"
                    min={1}
                    max={8}
                    className="input"
                    style={{ width: 64, display: 'inline-block' }}
                    value={matCols}
                    onChange={(e) => setMatCols(Math.min(8, Math.max(1, Number(e.target.value) || 1)))}
                  />
                </label>
                <label>
                  Bracket:{' '}
                  <select
                    className="select"
                    style={{ width: 120, display: 'inline-block' }}
                    value={matBracket}
                    onChange={(e) => setMatBracket(e.target.value as 'pmatrix' | 'bmatrix' | 'vmatrix' | 'Bmatrix')}
                  >
                    <option value="pmatrix">( ) pmatrix</option>
                    <option value="bmatrix">[ ] bmatrix</option>
                    <option value="vmatrix">| | vmatrix</option>
                    <option value="Bmatrix">{'{ }'} Bmatrix</option>
                  </select>
                </label>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table className="spreadsheet-grid" role="grid" aria-label="Matrix cell grid">
                  <tbody>
                    {Array.from({ length: matRows }, (_, r) => (
                      <tr key={r} role="row">
                        {Array.from({ length: matCols }, (_, c) => (
                          <td key={c} role="gridcell">
                            <input
                              type="text"
                              aria-label={`Row ${r + 1}, Column ${c + 1}`}
                              value={matCells[r][c]}
                              onChange={(e) => {
                                const val = e.target.value;
                                setMatCells((prev) =>
                                  prev.map((row, ri) =>
                                    ri === r ? row.map((cell, ci) => (ci === c ? val : cell)) : row
                                  )
                                );
                              }}
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <pre className="code-preview">{matrixTeX}</pre>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    onInsertMath(`$$\n${matrixTeX}\n$$\n`);
                    onClose();
                  }}
                >
                  Insert Matrix
                </button>
              </div>
            </div>
          )}

          {tab === 'table' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                <div className="segmented-control">
                  <button
                    type="button"
                    className="segmented-control__btn"
                    aria-pressed={tableInputMode === 'grid'}
                    onClick={() => setTableInputMode('grid')}
                  >
                    Visual Grid
                  </button>
                  <button
                    type="button"
                    className="segmented-control__btn"
                    aria-pressed={tableInputMode === 'csv'}
                    onClick={() => setTableInputMode('csv')}
                  >
                    Paste CSV / TSV
                  </button>
                </div>

                {tableInputMode === 'grid' && (
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button
                      type="button"
                      className="btn btn-sm"
                      disabled={rows.length >= 30}
                      onClick={() => setRows((prev) => [...prev, headers.map(() => '')])}
                    >
                      + Row
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm"
                      disabled={rows.length <= 1}
                      onClick={() => setRows((prev) => prev.slice(0, -1))}
                    >
                      - Row
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm"
                      disabled={headers.length >= 12}
                      onClick={() => {
                        setHeaders((prev) => [...prev, `Col ${prev.length + 1}`]);
                        setAlignments((prev) => [...prev, 'l']);
                        setRows((prev) => prev.map((r) => [...r, '']));
                      }}
                    >
                      + Col
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm"
                      disabled={headers.length <= 1}
                      onClick={() => {
                        setHeaders((prev) => prev.slice(0, -1));
                        setAlignments((prev) => prev.slice(0, -1));
                        setRows((prev) => prev.map((r) => r.slice(0, -1)));
                      }}
                    >
                      - Col
                    </button>
                  </div>
                )}
              </div>

              {tableInputMode === 'csv' ? (
                <div>
                  <textarea
                    className="textarea"
                    rows={5}
                    value={csvPaste}
                    onChange={(e) => setCsvPaste(e.target.value)}
                  />
                  <button type="button" className="btn btn-sm" style={{ marginTop: 6 }} onClick={parseCsvToTable}>
                    Import CSV/TSV into Grid
                  </button>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="spreadsheet-grid" role="grid" aria-label="Booktabs table editor grid">
                    <thead>
                      <tr role="row">
                        {headers.map((h, ci) => (
                          <th key={ci} role="columnheader">
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <input
                                type="text"
                                aria-label={`Header Column ${ci + 1}`}
                                value={h}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setHeaders((prev) => prev.map((item, idx) => (idx === ci ? val : item)));
                                }}
                                style={{ fontWeight: 700 }}
                              />
                              <select
                                aria-label={`Column ${ci + 1} alignment`}
                                value={alignments[ci] ?? 'l'}
                                onChange={(e) => {
                                  const val = e.target.value as TableColumnAlignment;
                                  setAlignments((prev) => prev.map((a, idx) => (idx === ci ? val : a)));
                                }}
                                style={{ width: 38, fontSize: 11, background: 'var(--bg-surface)' }}
                              >
                                <option value="l">L</option>
                                <option value="c">C</option>
                                <option value="r">R</option>
                              </select>
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, ri) => (
                        <tr key={ri} role="row">
                          {r.map((cell, ci) => (
                            <td key={ci} role="gridcell">
                              <input
                                type="text"
                                aria-label={`Row ${ri + 1}, Column ${ci + 1}, ${headers[ci] ?? ''}`}
                                value={cell}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setRows((prev) =>
                                    prev.map((row, rIdx) =>
                                      rIdx === ri ? row.map((c, cIdx) => (cIdx === ci ? val : c)) : row
                                    )
                                  );
                                }}
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 180px auto', gap: 8, alignItems: 'end' }}>
                <div>
                  <label htmlFor="table-caption-input" style={{ display: 'block', fontSize: 11, marginBottom: 3 }}>
                    Caption
                  </label>
                  <input
                    id="table-caption-input"
                    type="text"
                    className="input"
                    value={tableCaption}
                    onChange={(e) => setTableCaption(e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="table-label-input" style={{ display: 'block', fontSize: 11, marginBottom: 3 }}>
                    Label (tab:...)
                  </label>
                  <input
                    id="table-label-input"
                    type="text"
                    className="input"
                    aria-invalid={Boolean(tableLabelError)}
                    value={tableLabel}
                    onChange={(e) => {
                      setTableLabel(e.target.value);
                      setTableLabelError(null);
                    }}
                  />
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, height: 32, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={boldHeader}
                    onChange={(e) => setBoldHeader(e.target.checked)}
                  />
                  <span>Bold Header</span>
                </label>
              </div>
              {tableLabelError && (
                <div className="field-error" role="alert">
                  {tableLabelError}
                </div>
              )}

              <pre className="code-preview">{tableTeXPreview}</pre>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    if (!/^tab:[a-zA-Z0-9_-]+$/.test(tableLabel.trim())) {
                      setTableLabelError('Table label must start with "tab:" and use letters, numbers, or hyphens.');
                      return;
                    }
                    onInsertTable({
                      headers,
                      rows,
                      alignments,
                      boldHeader,
                      caption: tableCaption,
                      label: tableLabel.trim(),
                    });
                    onClose();
                  }}
                >
                  Insert Booktabs Table
                </button>
              </div>
            </div>
          )}

          {tab === 'chart' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr 1fr 1fr', gap: 8 }}>
                <div>
                  <label htmlFor="chart-type-select" style={{ display: 'block', fontSize: 11, marginBottom: 3 }}>
                    Chart Type
                  </label>
                  <select
                    id="chart-type-select"
                    className="select"
                    value={chartType}
                    onChange={(e) => setChartType(e.target.value as PGFPlotChartType)}
                  >
                    <option value="line">Line</option>
                    <option value="bar">Bar</option>
                    <option value="scatter">Scatter</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="chart-title-input" style={{ display: 'block', fontSize: 11, marginBottom: 3 }}>
                    Plot Title
                  </label>
                  <input
                    id="chart-title-input"
                    type="text"
                    className="input"
                    value={chartTitle}
                    onChange={(e) => setChartTitle(e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="chart-xlabel-input" style={{ display: 'block', fontSize: 11, marginBottom: 3 }}>
                    X Label
                  </label>
                  <input
                    id="chart-xlabel-input"
                    type="text"
                    className="input"
                    value={xLabel}
                    onChange={(e) => setXLabel(e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="chart-ylabel-input" style={{ display: 'block', fontSize: 11, marginBottom: 3 }}>
                    Y Label
                  </label>
                  <input
                    id="chart-ylabel-input"
                    type="text"
                    className="input"
                    value={yLabel}
                    onChange={(e) => setYLabel(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 12 }}>
                <div>
                  <label htmlFor="chart-csv-input" style={{ display: 'block', fontSize: 11, marginBottom: 3 }}>
                    CSV (x, y) Data
                  </label>
                  <textarea
                    id="chart-csv-input"
                    className="textarea"
                    rows={6}
                    style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5 }}
                    value={chartCsv}
                    onChange={(e) => setChartCsv(e.target.value)}
                  />
                  <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5 }}>
                      <input type="checkbox" checked={showGrid} onChange={(e) => setShowGrid(e.target.checked)} />
                      Grid
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5 }}>
                      <input type="checkbox" checked={showLegend} onChange={(e) => setShowLegend(e.target.checked)} />
                      Legend
                    </label>
                  </div>
                </div>
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 150px', gap: 8, marginBottom: 8 }}>
                    <input
                      type="text"
                      className="input"
                      aria-label="Chart caption"
                      placeholder="Caption"
                      value={chartCaption}
                      onChange={(e) => setChartCaption(e.target.value)}
                    />
                    <input
                      type="text"
                      className="input"
                      aria-label="Chart label"
                      placeholder="fig:chart"
                      value={chartLabel}
                      onChange={(e) => setChartLabel(e.target.value)}
                    />
                  </div>
                  <pre className="code-preview" style={{ marginTop: 0, maxHeight: 170 }}>
                    {chartTeXPreview}
                  </pre>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    onInsertChart({
                      chartType,
                      title: chartTitle,
                      xLabel,
                      yLabel,
                      csvText: chartCsv,
                      showGrid,
                      showLegend,
                      caption: chartCaption,
                      label: chartLabel,
                    });
                    onClose();
                  }}
                >
                  Insert PGFPlots Chart
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
