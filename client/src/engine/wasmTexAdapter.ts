import type { LaTeXDiagnostic } from '@shared/types/latex.js';

export interface CompilerPayload {
  mainTex: string;
  bibContent: string;
  files: Record<string, string>;
  binaryAssets: Record<string, Uint8Array>;
  customFonts: Array<{
    fileName: string;
    familyName: string;
    bytes: Uint8Array;
  }>;
  wasmTexUrl?: string;
}

export interface CompilerOutput {
  engine: 'wasm-tex' | 'web-typesetter';
  pdfBytes: Uint8Array | null;
  logText: string;
  synctexText: string;
  pageCount: number;
  diagnostics: LaTeXDiagnostic[];
  durationMs: number;
}

export function parseTeXLogDiagnostics(logText: string): LaTeXDiagnostic[] {
  const diagnostics: LaTeXDiagnostic[] = [];
  const lines = (logText || '').split(/\r?\n/);
  let currentLineHint: number | null = null;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const lineMatch = line.match(/\bl\.(\d+)\b/) || line.match(/:(\d+):/);
    if (lineMatch) {
      currentLineHint = Number.parseInt(lineMatch[1], 10);
    }

    if (line.startsWith('! ')) {
      const msg = line.slice(2).trim();
      let foundLine = currentLineHint;
      for (let j = i + 1; j < Math.min(i + 5, lines.length); j += 1) {
        const m = lines[j].match(/^l\.(\d+)\b/);
        if (m) {
          foundLine = Number.parseInt(m[1], 10);
          break;
        }
      }
      diagnostics.push({
        id: `diag-${i}-${foundLine ?? 0}`,
        line: foundLine,
        severity: 'Error',
        message: msg,
        rawLine: line,
      });
    } else if (
      line.includes('Warning:') ||
      line.startsWith('Overfull \\hbox') ||
      line.startsWith('Underfull \\hbox')
    ) {
      const m = line.match(/input line (\d+)|line (\d+)|l\.(\d+)/i);
      const ln = m ? Number.parseInt(m[1] || m[2] || m[3], 10) : currentLineHint;
      diagnostics.push({
        id: `warn-${i}-${ln ?? 0}`,
        line: ln,
        severity: 'Warning',
        message: line.trim(),
        rawLine: line,
      });
    }
  }

  return diagnostics;
}

/**
 * Optional WASM TeX adapter (SwiftLaTeX / BusyTeX).
 * Probes `/wasm/swiftlatexpdftex.wasm` (or configured URL). Returns null if unavailable
 * so the worker seamlessly uses `webTypesetter`.
 */
export async function tryCompileWithWasmTex(payload: CompilerPayload): Promise<CompilerOutput | null> {
  const wasmUrl = payload.wasmTexUrl || '/wasm/swiftlatexpdftex.wasm';
  if (typeof fetch !== 'function') return null;

  try {
    const head = await fetch(wasmUrl, { method: 'HEAD' });
    if (!head.ok) return null;
    const contentType = head.headers.get('content-type') || '';
    if (contentType.includes('text/html')) return null;

    // If a genuine SwiftLaTeX WASM module + JS bridge is deployed under /wasm/swiftlatex-engine.js,
    // invoke it dynamically. Otherwise fall back to the built-in webTypesetter.
    const bridgeUrl = '/wasm/swiftlatex-engine.js';
    const bridgeCheck = await fetch(bridgeUrl, { method: 'HEAD' });
    if (!bridgeCheck.ok || (bridgeCheck.headers.get('content-type') || '').includes('text/html')) {
      return null;
    }

    const start = performance.now();
    const mod = (await import(/* @vite-ignore */ bridgeUrl)) as {
      compileTeX?: (input: {
        mainTex: string;
        files: Record<string, string | Uint8Array>;
      }) => Promise<{ pdfBytes: Uint8Array; log: string; synctex: string; pageCount?: number }>;
    };
    if (typeof mod.compileTeX !== 'function') return null;

    const vfsFiles: Record<string, string | Uint8Array> = {
      'main.tex': payload.mainTex,
      'references.bib': payload.bibContent,
      ...payload.files,
      ...payload.binaryAssets,
    };
    for (const font of payload.customFonts) {
      vfsFiles[font.fileName] = font.bytes;
    }

    const res = await mod.compileTeX({ mainTex: payload.mainTex, files: vfsFiles });
    const durationMs = Math.max(1, Math.round(performance.now() - start));
    const diagnostics = parseTeXLogDiagnostics(res.log);
    return {
      engine: 'wasm-tex',
      pdfBytes: res.pdfBytes,
      logText: res.log,
      synctexText: res.synctex,
      pageCount: res.pageCount ?? 1,
      diagnostics,
      durationMs,
    };
  } catch {
    return null;
  }
}
