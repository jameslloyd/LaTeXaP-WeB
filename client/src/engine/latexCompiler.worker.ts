import type { CompilerOutput, CompilerPayload } from './wasmTexAdapter.js';
import { tryCompileWithWasmTex } from './wasmTexAdapter.js';
import { compileWithWebTypesetter } from './webTypesetter.js';

export interface WorkerCompileRequest {
  requestId: number;
  payload: CompilerPayload;
}

export interface WorkerCompileResponse {
  requestId: number;
  output?: CompilerOutput;
  error?: string;
}

export async function runCompilationPipeline(payload: CompilerPayload): Promise<CompilerOutput> {
  const wasmResult = await tryCompileWithWasmTex(payload);
  if (wasmResult) {
    return wasmResult;
  }
  return compileWithWebTypesetter(payload);
}

if (typeof self !== 'undefined' && typeof (self as unknown as { postMessage?: unknown }).postMessage === 'function') {
  self.onmessage = async (event: MessageEvent<WorkerCompileRequest>) => {
    const { requestId, payload } = event.data;
    try {
      const output = await runCompilationPipeline(payload);
      const response: WorkerCompileResponse = { requestId, output };
      const transferables: Transferable[] = [];
      if (output.pdfBytes) {
        transferables.push(output.pdfBytes.buffer);
      }
      (self as unknown as { postMessage: (msg: unknown, transfer?: Transferable[]) => void }).postMessage(
        response,
        transferables
      );
    } catch (err) {
      const response: WorkerCompileResponse = {
        requestId,
        error: err instanceof Error ? err.message : 'Worker compilation error',
      };
      (self as unknown as { postMessage: (msg: unknown) => void }).postMessage(response);
    }
  };
}
