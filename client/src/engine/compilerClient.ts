import type { CompilerOutput, CompilerPayload } from './wasmTexAdapter.js';
import { runCompilationPipeline, type WorkerCompileResponse } from './latexCompiler.worker.js';

export class CompilerClient {
  private worker: Worker | null = null;
  private nextRequestId = 0;
  private latestRequestId = 0;
  private pendingResolvers = new Map<
    number,
    { resolve: (out: CompilerOutput) => void; reject: (err: Error) => void }
  >();

  private getWorker(): Worker | null {
    if (typeof Worker === 'undefined') return null;
    if (!this.worker) {
      this.worker = new Worker(new URL('./latexCompiler.worker.ts', import.meta.url), {
        type: 'module',
      });
      this.worker.onmessage = (event: MessageEvent<WorkerCompileResponse>) => {
        const { requestId, output, error } = event.data;
        const entry = this.pendingResolvers.get(requestId);
        if (!entry) return;
        this.pendingResolvers.delete(requestId);
        if (error || !output) {
          entry.reject(new Error(error || 'Compilation failed'));
        } else {
          entry.resolve(output);
        }
      };
      this.worker.onerror = (err) => {
        for (const entry of this.pendingResolvers.values()) {
          entry.reject(new Error(err.message || 'Web Worker crashed'));
        }
        this.pendingResolvers.clear();
        this.worker?.terminate();
        this.worker = null;
      };
    }
    return this.worker;
  }

  async compile(payload: CompilerPayload): Promise<{ output: CompilerOutput; isStale: boolean }> {
    const requestId = ++this.nextRequestId;
    this.latestRequestId = requestId;

    const worker = this.getWorker();
    if (!worker) {
      const output = await runCompilationPipeline(payload);
      return { output, isStale: requestId !== this.latestRequestId };
    }

    const output = await new Promise<CompilerOutput>((resolve, reject) => {
      this.pendingResolvers.set(requestId, { resolve, reject });
      worker.postMessage({ requestId, payload });
    });

    return {
      output,
      isStale: requestId !== this.latestRequestId,
    };
  }

  dispose(): void {
    this.worker?.terminate();
    this.worker = null;
    this.pendingResolvers.clear();
  }
}

export const compilerClient = new CompilerClient();
