import type { SyncTeXBox, SyncTeXData } from '@shared/types/latex.js';

const SP_TO_PT = (65536.0 * 72.27) / 72.0; // ~65781.76

export function createSyncTeXData(
  inputs: Record<number, string>,
  boxes: SyncTeXBox[],
  rawText: string
): SyncTeXData {
  return {
    inputs,
    boxes,
    rawText,
    forwardSearch(line: number, file?: string): SyncTeXBox | null {
      if (boxes.length === 0) return null;
      const targetFile = file ? file.split('/').pop() : undefined;
      const scoped = targetFile
        ? boxes.filter((b) => b.file.endsWith(targetFile))
        : boxes;
      const pool = scoped.length > 0 ? scoped : boxes;

      const exact = pool.filter((b) => b.line === line && b.widthPt > 0);
      if (exact.length > 0) return exact[0];

      let best: SyncTeXBox | null = null;
      let bestDist = Number.POSITIVE_INFINITY;
      for (const box of pool) {
        const dist = Math.abs(box.line - line);
        if (
          dist < bestDist ||
          (dist === bestDist && best && box.widthPt > best.widthPt)
        ) {
          bestDist = dist;
          best = box;
        }
      }
      return best;
    },
    backwardSearch(page: number, xPt: number, yTopPt: number): { line: number; file: string } | null {
      const pageBoxes = boxes.filter((b) => b.page === page && b.line > 0);
      if (pageBoxes.length === 0) return null;

      let best: SyncTeXBox | null = null;
      let bestScore = Number.POSITIVE_INFINITY;

      for (const box of pageBoxes) {
        const minX = box.xPt;
        const maxX = box.xPt + Math.max(box.widthPt, 8);
        const minY = box.yTopPt - Math.max(box.heightPt, 10);
        const maxY = box.yTopPt + Math.max(box.depthPt ?? 4, 4);

        const dx = xPt < minX ? minX - xPt : xPt > maxX ? xPt - maxX : 0;
        const dy = yTopPt < minY ? minY - yTopPt : yTopPt > maxY ? yTopPt - maxY : 0;

        // Vertical distance dominates text-line matching
        const score = dy * 4 * (dy * 4) + dx * dx;
        if (score < bestScore) {
          bestScore = score;
          best = box;
        }
      }

      if (!best) return null;
      return { line: best.line, file: best.file };
    },
  };
}

export function parseSyncTeX(text: string): SyncTeXData {
  const inputs: Record<number, string> = {};
  const boxes: SyncTeXBox[] = [];
  let currentPage = 1;

  const lines = (text || '').split(/\r?\n/);
  for (const raw of lines) {
    if (!raw) continue;

    if (raw.startsWith('Input:')) {
      const rest = raw.slice('Input:'.length);
      const colonIdx = rest.indexOf(':');
      if (colonIdx > 0) {
        const id = Number.parseInt(rest.slice(0, colonIdx), 10);
        const filePath = rest.slice(colonIdx + 1).trim();
        if (Number.isFinite(id) && filePath) {
          inputs[id] = filePath;
        }
      }
      continue;
    }

    const firstChar = raw[0];
    if (firstChar === '{') {
      const p = Number.parseInt(raw.slice(1), 10);
      if (Number.isFinite(p) && p > 0) currentPage = p;
      continue;
    }

    if (
      firstChar === 'h' ||
      firstChar === 'v' ||
      firstChar === '(' ||
      firstChar === 'g' ||
      firstChar === 'x' ||
      firstChar === '$' ||
      firstChar === 'k'
    ) {
      const sections = raw.slice(1).split(':');
      if (sections.length < 2) continue;
      const tagLine = sections[0].split(',');
      if (tagLine.length < 2) continue;

      const inputId = Number.parseInt(tagLine[0], 10);
      const lineNum = Number.parseInt(tagLine[1], 10);
      if (!Number.isFinite(inputId) || !Number.isFinite(lineNum) || lineNum <= 0) continue;

      const xy = sections[1].split(',');
      if (xy.length < 2) continue;
      const xSp = Number.parseFloat(xy[0]);
      const ySp = Number.parseFloat(xy[1]);
      if (!Number.isFinite(xSp) || !Number.isFinite(ySp)) continue;

      let wSp = 0;
      let hSp = 0;
      let dSp = 0;
      if (sections.length >= 3) {
        const whd = sections[2].split(',');
        if (whd[0]) wSp = Number.parseFloat(whd[0]) || 0;
        if (whd[1]) hSp = Number.parseFloat(whd[1]) || 0;
        if (whd[2]) dSp = Number.parseFloat(whd[2]) || 0;
      }

      boxes.push({
        page: currentPage,
        inputId,
        file: inputs[inputId] || 'main.tex',
        line: lineNum,
        xPt: xSp / SP_TO_PT,
        yTopPt: ySp / SP_TO_PT,
        widthPt: Math.max(0, wSp / SP_TO_PT),
        heightPt: Math.max(8, hSp / SP_TO_PT),
        depthPt: Math.max(2, dSp / SP_TO_PT),
      });
    }
  }

  return createSyncTeXData(inputs, boxes, text);
}

export function formatSyncTeXSp(pt: number): number {
  return Math.round(pt * SP_TO_PT);
}
