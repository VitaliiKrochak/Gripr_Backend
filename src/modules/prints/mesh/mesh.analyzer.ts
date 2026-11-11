import { join } from 'node:path';
import { Worker } from 'node:worker_threads';
import type { WorkerOptions } from 'node:worker_threads';
import { Injectable } from '@nestjs/common';
import type { MeshAnalysis } from './mesh.analysis';
import { MeshError } from './mesh.measure';
import type { MeshWorkerInput, MeshWorkerOutput } from './mesh.worker';

/**
 * Measures model files in a worker thread with a time and memory limit, so
 * one bad file cannot block or crash the API.
 */
@Injectable()
export class MeshAnalyzer {
  timeoutMs = 60_000;
  maxMemoryMb = 1024;

  analyze(fileName: string, bytes: ArrayBuffer): Promise<MeshAnalysis> {
    const input: MeshWorkerInput = { fileName, bytes };
    const options: WorkerOptions = {
      workerData: input,
      transferList: [bytes],
      resourceLimits: { maxOldGenerationSizeMb: this.maxMemoryMb },
    };
    const worker = __filename.endsWith('.ts')
      ? new Worker(
          `require('ts-node').register({ transpileOnly: true });
           require(${JSON.stringify(join(__dirname, 'mesh.worker.ts'))});`,
          { ...options, eval: true },
        )
      : new Worker(join(__dirname, 'mesh.worker.js'), options);

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        void worker.terminate();
        reject(new MeshError('Measuring the file took too long'));
      }, this.timeoutMs);
      const settle = (done: () => void) => {
        clearTimeout(timer);
        done();
      };

      worker.once('message', (output: MeshWorkerOutput) =>
        settle(() =>
          output.ok
            ? resolve(output.analysis)
            : reject(new MeshError(output.message)),
        ),
      );
      worker.once('error', () =>
        settle(() =>
          reject(new MeshError('The file is too complex to measure')),
        ),
      );
      worker.once('exit', () =>
        settle(() => reject(new MeshError('The file could not be read'))),
      );
    });
  }
}
