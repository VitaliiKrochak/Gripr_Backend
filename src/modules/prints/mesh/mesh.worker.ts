import { parentPort, workerData } from 'node:worker_threads';
import { analyzeMesh } from './mesh.analysis';
import type { MeshAnalysis } from './mesh.analysis';
import { MeshError } from './mesh.measure';

export interface MeshWorkerInput {
  fileName: string;
  bytes: ArrayBuffer;
}

export type MeshWorkerOutput =
  { ok: true; analysis: MeshAnalysis } | { ok: false; message: string };

const { fileName, bytes } = workerData as MeshWorkerInput;
let output: MeshWorkerOutput;

try {
  output = { ok: true, analysis: analyzeMesh(fileName, Buffer.from(bytes)) };
} catch (error) {
  output = {
    ok: false,
    message:
      error instanceof MeshError ? error.message : 'The file could not be read',
  };
}

parentPort?.postMessage(output);
