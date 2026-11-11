import { deflateRawSync } from 'node:zlib';

type Vertex = [number, number, number];
type Triangle = [Vertex, Vertex, Vertex];

/** A closed, outward-facing cube from the origin to `side` on every axis. */
export function cube(side: number): Triangle[] {
  const v = (x: number, y: number, z: number): Vertex => [
    x * side,
    y * side,
    z * side,
  ];
  const quads: Vertex[][] = [
    [v(0, 0, 0), v(0, 1, 0), v(1, 1, 0), v(1, 0, 0)],
    [v(0, 0, 1), v(1, 0, 1), v(1, 1, 1), v(0, 1, 1)],
    [v(0, 0, 0), v(1, 0, 0), v(1, 0, 1), v(0, 0, 1)],
    [v(0, 1, 0), v(0, 1, 1), v(1, 1, 1), v(1, 1, 0)],
    [v(0, 0, 0), v(0, 0, 1), v(0, 1, 1), v(0, 1, 0)],
    [v(1, 0, 0), v(1, 1, 0), v(1, 1, 1), v(1, 0, 1)],
  ];

  return quads.flatMap(([a, b, c, d]) => [
    [a, b, c],
    [a, c, d],
  ]);
}

export function binaryStl(triangles: Triangle[]): Buffer {
  const bytes = Buffer.alloc(84 + triangles.length * 50);
  bytes.writeUInt32LE(triangles.length, 80);
  triangles.forEach((triangle, index) => {
    triangle.flat().forEach((value, corner) => {
      bytes.writeFloatLE(value, 84 + index * 50 + 12 + corner * 4);
    });
  });
  return bytes;
}

export function asciiStl(triangles: Triangle[]): Buffer {
  const facets = triangles.map(
    (triangle) =>
      `facet normal 0 0 0\n outer loop\n${triangle
        .map((vertex) => `  vertex ${vertex.join(' ')}`)
        .join('\n')}\n endloop\nendfacet`,
  );
  return Buffer.from(`solid cube\n${facets.join('\n')}\nendsolid cube\n`);
}

/** An OBJ cube made of quads. */
export function objCube(side: number): Buffer {
  const lines = [
    [0, 0, 0],
    [1, 0, 0],
    [1, 1, 0],
    [0, 1, 0],
    [0, 0, 1],
    [1, 0, 1],
    [1, 1, 1],
    [0, 1, 1],
  ].map((vertex) => `v ${vertex.map((value) => value * side).join(' ')}`);
  lines.push(
    'f 1 4 3 2',
    'f 5/1 6/1 7/1 8/1',
    'f 1//1 2//1 6//1 5//1',
    'f 4 8 7 3',
    'f 1 5 8 4',
    'f -7 -6 -2 -3',
  );
  return Buffer.from(lines.join('\n'));
}

export function threeMf(triangles: Triangle[], unit = 'millimeter'): Buffer {
  const vertices = triangles.flat();
  const model = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="${unit}" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
  <resources>
    <object id="1" name="Cube" type="model">
      <mesh>
        <vertices>${vertices
          .map(([x, y, z]) => `<vertex x="${x}" y="${y}" z="${z}" />`)
          .join('')}</vertices>
        <triangles>${triangles
          .map(
            (_, index) =>
              `<triangle v1="${index * 3}" v2="${index * 3 + 1}" v3="${index * 3 + 2}" />`,
          )
          .join('')}</triangles>
      </mesh>
    </object>
  </resources>
  <build><item objectid="1" /></build>
</model>`;
  return zip([['3D/3dmodel.model', Buffer.from(model)]]);
}

/** A ZIP archive; entries are deflated unless `stored`. */
export function zip(
  entries: Array<[string, Buffer]>,
  options: { stored?: boolean; declaredSize?: number } = {},
): Buffer {
  const locals: Buffer[] = [];
  const directory: Buffer[] = [];
  let offset = 0;

  for (const [name, content] of entries) {
    const data = options.stored ? content : deflateRawSync(content);
    const nameBytes = Buffer.from(name);
    const size = options.declaredSize ?? content.length;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(options.stored ? 0 : 8, 8);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(size, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(options.stored ? 0 : 8, 10);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(size, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(local, nameBytes, data);
    directory.push(central, nameBytes);
    offset += local.length + nameBytes.length + data.length;
  }

  const directoryBytes = Buffer.concat(directory);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directoryBytes.length, 12);
  end.writeUInt32LE(offset, 16);

  return Buffer.concat([...locals, directoryBytes, end]);
}
