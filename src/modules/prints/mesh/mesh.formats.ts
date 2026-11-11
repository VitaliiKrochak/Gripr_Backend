import { MeshAccumulator, MeshError } from './mesh.measure';
import type { MeshLimits, MeshPart } from './mesh.measure';
import { readZip } from './zip.reader';

/** Binary or ASCII STL; STL has no units, millimetres are assumed. */
export function parseStl(
  name: string,
  bytes: Buffer,
  limits: MeshLimits,
): MeshPart {
  const mesh = new MeshAccumulator(name, limits);

  if (bytes.length >= 84 && 84 + 50 * bytes.readUInt32LE(80) === bytes.length) {
    const count = bytes.readUInt32LE(80);

    for (let index = 0; index < count; index += 1) {
      const at = 84 + index * 50 + 12;
      mesh.addTriangle(
        bytes.readFloatLE(at),
        bytes.readFloatLE(at + 4),
        bytes.readFloatLE(at + 8),
        bytes.readFloatLE(at + 12),
        bytes.readFloatLE(at + 16),
        bytes.readFloatLE(at + 20),
        bytes.readFloatLE(at + 24),
        bytes.readFloatLE(at + 28),
        bytes.readFloatLE(at + 32),
      );
    }

    return mesh.result();
  }

  const text = bytes.toString('latin1');

  if (!/^\s*solid\b/.test(text)) {
    throw new MeshError(`${name} is not an STL file`);
  }

  const vertex = /vertex\s+(\S+)\s+(\S+)\s+(\S+)/g;
  const corners: number[] = [];

  for (const match of text.matchAll(vertex)) {
    corners.push(Number(match[1]), Number(match[2]), Number(match[3]));

    if (corners.length === 9) {
      mesh.addTriangle(
        corners[0],
        corners[1],
        corners[2],
        corners[3],
        corners[4],
        corners[5],
        corners[6],
        corners[7],
        corners[8],
      );
      corners.length = 0;
    }
  }

  return mesh.result();
}

/** Wavefront OBJ: polygons are split into triangle fans; millimetres assumed. */
export function parseObj(
  name: string,
  bytes: Buffer,
  limits: MeshLimits,
): MeshPart {
  const mesh = new MeshAccumulator(name, limits);
  const vertices: number[] = [];

  for (const line of bytes.toString('utf8').split(/\r?\n/)) {
    const tokens = line.trim().split(/\s+/);

    if (tokens[0] === 'v') {
      vertices.push(Number(tokens[1]), Number(tokens[2]), Number(tokens[3]));
    } else if (tokens[0] === 'f') {
      const count = vertices.length / 3;
      const corners = tokens.slice(1).map((token) => {
        const index = parseInt(token, 10);
        const resolved = index < 0 ? count + index : index - 1;

        if (!Number.isInteger(resolved) || resolved < 0 || resolved >= count) {
          throw new MeshError(`${name}: a face refers to a missing vertex`);
        }

        return resolved * 3;
      });

      for (let corner = 1; corner + 1 < corners.length; corner += 1) {
        const [a, b, c] = [corners[0], corners[corner], corners[corner + 1]];
        mesh.addTriangle(
          vertices[a],
          vertices[a + 1],
          vertices[a + 2],
          vertices[b],
          vertices[b + 1],
          vertices[b + 2],
          vertices[c],
          vertices[c + 1],
          vertices[c + 2],
        );
      }
    }
  }

  return mesh.result();
}

const UNIT_SCALES: Record<string, number> = {
  micron: 0.001,
  millimeter: 1,
  centimeter: 10,
  inch: 25.4,
  foot: 304.8,
  meter: 1000,
};

/**
 * 3MF: every mesh object of every model part is measured as stored, in the
 * declared unit. Build item transforms and repeated copies are ignored.
 */
export function parse3mf(
  bytes: Buffer,
  limits: MeshLimits,
): { parts: MeshPart[]; unit: string } {
  const models = readZip(bytes, limits).filter((entry) =>
    entry.name.toLowerCase().endsWith('.model'),
  );

  if (!models.length) {
    throw new MeshError('The 3MF file has no model');
  }

  const parts: MeshPart[] = [];
  let unit = 'millimeter';

  for (const entry of models) {
    const xml = entry.read().toString('utf8');
    unit =
      /<(?:\w+:)?model\b[^>]*\bunit="([^"]+)"/.exec(xml)?.[1] ?? 'millimeter';
    const scale = UNIT_SCALES[unit];

    if (scale === undefined) {
      throw new MeshError(`Unknown 3MF unit: ${unit}`);
    }

    const objects = /<(?:\w+:)?object\b([^>]*)>([\s\S]*?)<\/(?:\w+:)?object>/g;

    for (const [, attributes, body] of xml.matchAll(objects)) {
      const vertices: number[] = [];

      for (const [, vertex] of body.matchAll(
        /<(?:\w+:)?vertex\b([^>]*?)\/?>/g,
      )) {
        vertices.push(
          Number(attribute(vertex, 'x')),
          Number(attribute(vertex, 'y')),
          Number(attribute(vertex, 'z')),
        );
      }

      if (!vertices.length) {
        continue;
      }

      const label =
        attribute(attributes, 'name') ??
        `object ${attribute(attributes, 'id') ?? parts.length + 1}`;
      const mesh = new MeshAccumulator(label, limits, scale);
      const count = vertices.length / 3;

      for (const [, triangle] of body.matchAll(
        /<(?:\w+:)?triangle\b([^>]*?)\/?>/g,
      )) {
        const [a, b, c] = ['v1', 'v2', 'v3'].map((key) => {
          const index = Number(attribute(triangle, key));

          if (!Number.isInteger(index) || index < 0 || index >= count) {
            throw new MeshError(
              `${label}: a triangle refers to a missing vertex`,
            );
          }

          return index * 3;
        });
        mesh.addTriangle(
          vertices[a],
          vertices[a + 1],
          vertices[a + 2],
          vertices[b],
          vertices[b + 1],
          vertices[b + 2],
          vertices[c],
          vertices[c + 1],
          vertices[c + 2],
        );
      }

      parts.push(mesh.result());
    }
  }

  if (!parts.length) {
    throw new MeshError('The 3MF file has no mesh objects');
  }

  return { parts, unit };
}

function attribute(attributes: string, name: string): string | undefined {
  return new RegExp(`\\b${name}="([^"]*)"`).exec(attributes)?.[1];
}
