import { parse3mf, parseObj, parseStl } from './mesh.formats';
import { DEFAULT_MESH_LIMITS, MeshError } from './mesh.measure';
import type { MeshLimits, MeshPart, MeshSize } from './mesh.measure';
import { readZip } from './zip.reader';

/** Extensions measured automatically. */
export const MEASURED_EXTENSIONS = ['stl', 'obj', '3mf', 'zip'] as const;
/** Extensions accepted but measured by staff. */
export const MANUAL_EXTENSIONS = ['step', 'stp'] as const;
export const MODEL_EXTENSIONS = [
  ...MEASURED_EXTENSIONS,
  ...MANUAL_EXTENSIONS,
] as const;
export type ModelExtension = (typeof MODEL_EXTENSIONS)[number];

export const MESH_WARNINGS = [
  /** Some edge is not shared by exactly two triangles; the volume is rough. */
  'not_watertight',
  /** Several parts; the size is the largest extent per axis. */
  'multiple_parts',
  /** No units and the largest side is under 5: maybe centimetres or inches. */
  'small_model',
  /** Does not fit the default printer at its own size. */
  'exceeds_build_volume',
] as const;
export type MeshWarning = (typeof MESH_WARNINGS)[number];

export interface MeshAnalysis {
  /** The 3MF unit, or `null` when the format has none (millimetres assumed). */
  units: string | null;
  volumeMl: number;
  sizeMm: MeshSize;
  triangles: number;
  isWatertight: boolean;
  parts: MeshPart[];
  warnings: MeshWarning[];
}

const SMALL_MODEL_MM = 5;

/** Lower-cased extension when it is a model format, otherwise `null`. */
export function modelExtension(fileName: string): ModelExtension | null {
  const extension = /\.([a-z0-9]+)$/i.exec(fileName)?.[1]?.toLowerCase();

  return (MODEL_EXTENSIONS as readonly string[]).includes(extension ?? '')
    ? (extension as ModelExtension)
    : null;
}

export function isMeasured(extension: ModelExtension): boolean {
  return (MEASURED_EXTENSIONS as readonly string[]).includes(extension);
}

/** The box fits the build volume in some axis-aligned orientation. */
export function fitsBuildVolume(size: MeshSize, build: MeshSize): boolean {
  const piece = [size.x, size.y, size.z].sort((a, b) => a - b);
  const volume = [build.x, build.y, build.z].sort((a, b) => a - b);

  return piece.every((side, index) => side <= volume[index]);
}

/**
 * Measures an STL, OBJ, or 3MF file, or every such file in a ZIP archive
 * (as separate parts). Throws `MeshError` for files it cannot measure.
 */
export function analyzeMesh(
  fileName: string,
  bytes: Buffer,
  limits: MeshLimits = DEFAULT_MESH_LIMITS,
): MeshAnalysis {
  const extension = modelExtension(fileName);
  let parts: MeshPart[];
  let units: string | null = null;

  switch (extension) {
    case 'stl':
      parts = [parseStl(fileName, bytes, limits)];
      break;
    case 'obj':
      parts = [parseObj(fileName, bytes, limits)];
      break;
    case '3mf':
      ({ parts, unit: units } = parse3mf(bytes, limits));
      break;
    case 'zip':
      ({ parts, units } = parseArchive(bytes, limits));
      break;
    default:
      throw new MeshError('This file type cannot be measured automatically');
  }

  const triangles = parts.reduce((sum, part) => sum + part.triangles, 0);

  if (triangles > limits.maxTriangles) {
    throw new MeshError(
      `The model has more than ${limits.maxTriangles} triangles`,
    );
  }

  const sizeMm = {
    x: Math.max(...parts.map((part) => part.sizeMm.x)),
    y: Math.max(...parts.map((part) => part.sizeMm.y)),
    z: Math.max(...parts.map((part) => part.sizeMm.z)),
  };
  const isWatertight = parts.every((part) => part.isWatertight);
  const warnings: MeshWarning[] = [];

  if (!isWatertight) warnings.push('not_watertight');
  if (parts.length > 1) warnings.push('multiple_parts');
  if (
    units === null &&
    Math.max(sizeMm.x, sizeMm.y, sizeMm.z) < SMALL_MODEL_MM
  ) {
    warnings.push('small_model');
  }

  return {
    units,
    volumeMl: parts.reduce((sum, part) => sum + part.volumeMl, 0),
    sizeMm,
    triangles,
    isWatertight,
    parts,
    warnings,
  };
}

function parseArchive(
  bytes: Buffer,
  limits: MeshLimits,
): { parts: MeshPart[]; units: string | null } {
  const parts: MeshPart[] = [];
  const units = new Set<string | null>();

  for (const entry of readZip(bytes, limits)) {
    const extension = modelExtension(entry.name);

    if (entry.name.startsWith('__MACOSX/')) {
      continue;
    }

    if (extension === 'stl') {
      parts.push(parseStl(entry.name, entry.read(), limits));
      units.add(null);
    } else if (extension === 'obj') {
      parts.push(parseObj(entry.name, entry.read(), limits));
      units.add(null);
    } else if (extension === '3mf') {
      const model = parse3mf(entry.read(), limits);
      parts.push(
        ...model.parts.map((part) => ({
          ...part,
          name: `${entry.name}: ${part.name}`,
        })),
      );
      units.add(model.unit);
    }
  }

  if (!parts.length) {
    throw new MeshError('The archive has no STL, OBJ, or 3MF files');
  }

  return { parts, units: units.size === 1 ? [...units][0] : null };
}
