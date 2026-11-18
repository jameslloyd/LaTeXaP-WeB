import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Loader2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import type { CompilationState, SyncTeXBox } from '@shared/types';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

type ZoomMode = number | 'fit-width' | 'fit-page';

export interface PDFPreviewPaneProps {
  pdfBytes: Uint8Array | null;
  compilationState: CompilationState;
  autoCompileEnabled: boolean;
  forwardSyncBox: { box: SyncTeXBox; nonce: number } | null;
  onBackwardSync: (page: number, xPt: number, yTopPt: number) => void;
  onExportPDF: () => void;
  onCompileNow: () => void;
}

interface RenderedPageMeta {
  pageNumber: number;
  widthPt: number;
  heightPt: number;
}

export const PDFPreviewPane: React.FC<PDFPreviewPaneProps> = ({
  pdfBytes,
  compilationState,
  autoCompileEnabled,
  forwardSyncBox,
  onBackwardSync,
  onExportPDF,
  onCompileNow,
}) => {
  const wellRef = useRef<HTMLDivElement | null>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const canvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map());
  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);

  const [numPages, setNumPages] = useState(0);
  const [pagesMeta, setPagesMeta] = useState<RenderedPageMeta[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInput, setPageInput] = useState('1');
  const [zoomMode, setZoomMode] = useState<ZoomMode>(1.0);
  const [wellSize, setWellSize] = useState({ width: 560, height: 720 });
  const [renderError, setRenderError] = useState<string | null>(null);
  const [activeSyncHighlight, setActiveSyncHighlight] = useState<SyncTeXBox | null>(null);

  // Measure container for Fit Width / Fit Page
  useEffect(() => {
    const el = wellRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setWellSize({
          width: Math.max(240, entry.contentRect.width - 40),
          height: Math.max(240, entry.contentRect.height - 40),
        });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const effectiveScale = useMemo(() => {
    const first = pagesMeta[0];
    if (zoomMode === 'fit-width') {
      const w = first?.widthPt ?? 612;
      return Math.min(2.5, Math.max(0.4, wellSize.width / w));
    }
    if (zoomMode === 'fit-page') {
      const w = first?.widthPt ?? 612;
      const h = first?.heightPt ?? 792;
      return Math.min(2.5, Math.max(0.4, Math.min(wellSize.width / w, wellSize.height / h)));
    }
    return zoomMode;
  }, [pagesMeta, wellSize.height, wellSize.width, zoomMode]);

  // Load PDF document when pdfBytes updates (preserving scroll position)
  useEffect(() => {
    if (!pdfBytes || pdfBytes.byteLength === 0) {
      pdfDocRef.current = null;
      setNumPages(0);
      setPagesMeta([]);
      setRenderError(null);
      return;
    }

    let cancelled = false;
    const prevScrollTop = wellRef.current?.scrollTop ?? 0;

    (async () => {
      try {
        // Defensive copy so worker/transfer never mutates store's Uint8Array
        const copy = new Uint8Array(pdfBytes);
        const loadingTask = pdfjsLib.getDocument({ data: copy });
        const doc = await loadingTask.promise;
        if (cancelled) {
          await doc.destroy();
          return;
        }
        if (pdfDocRef.current) {
          await pdfDocRef.current.destroy().catch(() => {});
        }
        pdfDocRef.current = doc;
        setNumPages(doc.numPages);
        setRenderError(null);

        const metas: RenderedPageMeta[] = [];
        for (let p = 1; p <= doc.numPages; p += 1) {
          const page = await doc.getPage(p);
          const vp = page.getViewport({ scale: 1 });
          metas.push({ pageNumber: p, widthPt: vp.width, heightPt: vp.height });
        }
        if (!cancelled) {
          setPagesMeta(metas);
          setCurrentPage((prev) => Math.min(doc.numPages, Math.max(1, prev)));
          requestAnimationFrame(() => {
            if (wellRef.current) {
              wellRef.current.scrollTop = prevScrollTop;
            }
          });
        }
      } catch (err) {
        if (!cancelled) {
          setRenderError(err instanceof Error ? err.message : 'Unable to render PDF');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pdfBytes]);

  // Render pages onto canvases whenever pagesMeta or effectiveScale updates
  useEffect(() => {
    const doc = pdfDocRef.current;
    if (!doc || pagesMeta.length === 0) return;

    let cancelled = false;
    const dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2.5) : 1;

    (async () => {
      for (const meta of pagesMeta) {
        if (cancelled) return;
        const canvas = canvasRefs.current.get(meta.pageNumber);
        if (!canvas) continue;
        const page = await doc.getPage(meta.pageNumber);
        if (cancelled) return;

        const cssViewport = page.getViewport({ scale: effectiveScale });
        const renderViewport = page.getViewport({ scale: effectiveScale * dpr });

        canvas.width = Math.ceil(renderViewport.width);
        canvas.height = Math.ceil(renderViewport.height);
        canvas.style.width = `${Math.ceil(cssViewport.width)}px`;
        canvas.style.height = `${Math.ceil(cssViewport.height)}px`;

        const ctx = canvas.getContext('2d');
        if (!ctx) continue;

        await page.render({
          canvasContext: ctx,
          viewport: renderViewport,
        }).promise;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pagesMeta, effectiveScale]);

  // Forward SyncTeX highlight & scroll
  useEffect(() => {
    if (!forwardSyncBox) return;
    const { box } = forwardSyncBox;
    const pageEl = pageRefs.current.get(box.page);
    if (pageEl) {
      pageEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    setCurrentPage(box.page);
    setPageInput(String(box.page));
    setActiveSyncHighlight(box);
    const timer = window.setTimeout(() => setActiveSyncHighlight(null), 1800);
    return () => window.clearTimeout(timer);
  }, [forwardSyncBox]);

  useEffect(() => {
    setPageInput(String(currentPage));
  }, [currentPage]);

  const scrollToPage = useCallback(
    (targetPage: number) => {
      const clamped = Math.min(Math.max(1, targetPage), Math.max(1, numPages));
      setCurrentPage(clamped);
      setPageInput(String(clamped));
      const el = pageRefs.current.get(clamped);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    },
    [numPages]
  );

  const handleWellScroll = () => {
    const well = wellRef.current;
    if (!well || pagesMeta.length === 0) return;
    const wellTop = well.getBoundingClientRect().top;
    let bestPage = 1;
    let bestDist = Infinity;
    for (const meta of pagesMeta) {
      const el = pageRefs.current.get(meta.pageNumber);
      if (!el) continue;
      const dist = Math.abs(el.getBoundingClientRect().top - wellTop);
      if (dist < bestDist) {
        bestDist = dist;
        bestPage = meta.pageNumber;
      }
    }
    if (bestPage !== currentPage) {
      setCurrentPage(bestPage);
    }
  };

  const handlePageClick = (pageNumber: number, e: React.MouseEvent<HTMLDivElement>) => {
    if (!(e.metaKey || e.ctrlKey) && e.detail < 2) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const xPt = (e.clientX - rect.left) / effectiveScale;
    const yTopPt = (e.clientY - rect.top) / effectiveScale;
    onBackwardSync(pageNumber, xPt, yTopPt);
  };

  const handleWheelZoom = (e: React.WheelEvent<HTMLDivElement>) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.1 : -0.1;
    setZoomMode(Number(Math.min(2.5, Math.max(0.4, effectiveScale + delta)).toFixed(2)));
  };

  const isStale = compilationState.status === 'failed' && Boolean(pdfBytes);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* Preview Header Bar (36px) */}
      <div className="pane-header">
        <div className="pane-header__left">
          <span className="pane-title">Live PDF Preview</span>
          {autoCompileEnabled && (
            <span className="badge badge-success" style={{ fontSize: 10.5 }}>
              Auto-Compile Active
            </span>
          )}
          <span className="pane-subtitle" style={{ fontSize: 11 }}>
            Ctrl/Cmd+Click PDF to jump to line
          </span>
        </div>

        <div className="pane-header__right">
          {/* Page Navigation */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <button
              type="button"
              className="btn btn-icon btn-sm"
              aria-label="Previous PDF page"
              disabled={currentPage <= 1 || numPages === 0}
              onClick={() => scrollToPage(currentPage - 1)}
            >
              <ChevronLeft size={14} aria-hidden="true" />
            </button>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5 }}>
              <label htmlFor="pdf-page-jump-input" className="sr-only">
                Current PDF page
              </label>
              <input
                id="pdf-page-jump-input"
                type="text"
                inputMode="numeric"
                value={pageInput}
                disabled={numPages === 0}
                onChange={(e) => setPageInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const parsed = Number.parseInt(pageInput, 10);
                    if (!Number.isNaN(parsed)) scrollToPage(parsed);
                  }
                }}
                onBlur={() => {
                  const parsed = Number.parseInt(pageInput, 10);
                  if (!Number.isNaN(parsed)) scrollToPage(parsed);
                  else setPageInput(String(currentPage));
                }}
                style={{
                  width: 34,
                  height: 22,
                  textAlign: 'center',
                  borderRadius: 4,
                  border: '1px solid var(--border-subtle)',
                  background: 'var(--bg-surface-subtle)',
                  fontSize: 11.5,
                }}
              />
              <span className="pane-subtitle">/ {numPages || 0}</span>
            </span>
            <button
              type="button"
              className="btn btn-icon btn-sm"
              aria-label="Next PDF page"
              disabled={currentPage >= numPages || numPages === 0}
              onClick={() => scrollToPage(currentPage + 1)}
            >
              <ChevronRight size={14} aria-hidden="true" />
            </button>
          </div>

          {/* Zoom Controls */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
            <button
              type="button"
              className="btn btn-icon btn-sm"
              aria-label="Zoom out PDF"
              onClick={() => setZoomMode(Number(Math.max(0.4, effectiveScale - 0.15).toFixed(2)))}
            >
              <ZoomOut size={13} aria-hidden="true" />
            </button>
            <label htmlFor="pdf-zoom-select" className="sr-only">
              PDF zoom level
            </label>
            <select
              id="pdf-zoom-select"
              className="select"
              value={typeof zoomMode === 'string' ? zoomMode : String(Math.round(effectiveScale * 100))}
              onChange={(e) => {
                const v = e.target.value;
                if (v === 'fit-width' || v === 'fit-page') {
                  setZoomMode(v);
                } else {
                  setZoomMode(Number(v) / 100);
                }
              }}
              style={{ width: 'auto', height: 24, padding: '0 6px', fontSize: 11.5 }}
            >
              <option value="50">50%</option>
              <option value="75">75%</option>
              <option value="100">100%</option>
              <option value="125">125%</option>
              <option value="150">150%</option>
              <option value="200">200%</option>
              <option value="fit-width">Fit Width</option>
              <option value="fit-page">Fit Page</option>
              {typeof zoomMode === 'number' &&
                ![50, 75, 100, 125, 150, 200].includes(Math.round(effectiveScale * 100)) && (
                  <option value={String(Math.round(effectiveScale * 100))}>
                    {Math.round(effectiveScale * 100)}%
                  </option>
                )}
            </select>
            <button
              type="button"
              className="btn btn-icon btn-sm"
              aria-label="Zoom in PDF"
              onClick={() => setZoomMode(Number(Math.min(2.5, effectiveScale + 0.15).toFixed(2)))}
            >
              <ZoomIn size={13} aria-hidden="true" />
            </button>
          </div>

          <button
            type="button"
            className="btn btn-icon btn-sm"
            aria-label="Download compiled PDF"
            title="Download Compiled PDF (Mod+Shift+E)"
            disabled={!pdfBytes}
            onClick={onExportPDF}
          >
            <Download size={13} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Stale PDF Banner when latest compile failed */}
      {isStale && compilationState.status === 'failed' && (
        <div className="studio-banner studio-banner--warning" role="status">
          <span className="studio-banner__content">
            <AlertTriangle size={14} aria-hidden="true" />
            <span>
              Showing previous PDF — fix {compilationState.errorCount} error(s) in editor to update
            </span>
          </span>
        </div>
      )}

      {renderError && (
        <div className="studio-banner studio-banner--danger" role="alert">
          <span className="studio-banner__content">
            <AlertTriangle size={14} aria-hidden="true" />
            <span>PDF render error: {renderError}</span>
          </span>
        </div>
      )}

      {/* Scrollable Page Well */}
      <div
        ref={wellRef}
        className="pdf-preview-well"
        onScroll={handleWheelScrollAndSpy(handleWellScroll)}
        onWheel={handleWheelZoom}
      >
        {!pdfBytes && (
          <div className="pdf-empty-card" role="status">
            {compilationState.status === 'compiling' ? (
              <>
                <Loader2
                  size={28}
                  className="spin-icon"
                  style={{ color: 'var(--accent-text)', marginBottom: 10 }}
                  aria-hidden="true"
                />
                <div style={{ fontWeight: 700, marginBottom: 4 }}>
                  Compiling LaTeX3 document in Browser (WASM)...
                </div>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
                  Generating real PDF pages, SyncTeX coordinates, and TeX diagnostics locally.
                </p>
              </>
            ) : (
              <>
                <FileText
                  size={28}
                  style={{ color: 'var(--text-muted)', marginBottom: 10 }}
                  aria-hidden="true"
                />
                <div style={{ fontWeight: 700, marginBottom: 6 }}>No PDF Compiled Yet</div>
                <p style={{ margin: '0 0 12px 0', fontSize: 12, color: 'var(--text-muted)' }}>
                  Edit the LaTeX3 source or trigger a manual client-side build.
                </p>
                <button type="button" className="btn btn-primary" onClick={onCompileNow}>
                  Compile Now (Mod+B)
                </button>
              </>
            )}
          </div>
        )}

        {pagesMeta.map((meta) => {
          const highlight =
            activeSyncHighlight && activeSyncHighlight.page === meta.pageNumber
              ? activeSyncHighlight
              : null;

          return (
            <div
              key={meta.pageNumber}
              ref={(el) => {
                if (el) pageRefs.current.set(meta.pageNumber, el);
                else pageRefs.current.delete(meta.pageNumber);
              }}
              className={`pdf-page-frame ${isStale ? 'is-stale' : ''}`}
              style={{
                width: Math.ceil(meta.widthPt * effectiveScale),
                height: Math.ceil(meta.heightPt * effectiveScale),
              }}
              onClick={(e) => handlePageClick(meta.pageNumber, e)}
              onDoubleClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                onBackwardSync(
                  meta.pageNumber,
                  (e.clientX - rect.left) / effectiveScale,
                  (e.clientY - rect.top) / effectiveScale
                );
              }}
              aria-label={`PDF Page ${meta.pageNumber} of ${numPages}. Ctrl+Click or Double-click to jump to source line.`}
            >
              <canvas
                ref={(el) => {
                  if (el) canvasRefs.current.set(meta.pageNumber, el);
                  else canvasRefs.current.delete(meta.pageNumber);
                }}
                className="pdf-page-canvas"
              />
              {highlight && (
                <div
                  className="pdf-synctex-highlight"
                  style={{
                    left: `${Math.max(4, highlight.xPt * effectiveScale - 4)}px`,
                    top: `${Math.max(4, highlight.yTopPt * effectiveScale - 4)}px`,
                    width: `${Math.max(48, highlight.widthPt * effectiveScale + 8)}px`,
                    height: `${Math.max(16, highlight.heightPt * effectiveScale + 8)}px`,
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

function handleWheelScrollAndSpy(onScroll: () => void) {
  return () => onScroll();
}
