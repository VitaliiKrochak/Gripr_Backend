import {
  asciiStl,
  binaryStl,
  cube,
  objCube,
  threeMf,
  zip,
} from '../../../../test/support/mesh.fixtures';
import { analyzeMesh, modelExtension } from './mesh.analysis';
import { DEFAULT_MESH_LIMITS } from './mesh.measure';

describe('analyzeMesh', () => {
  const tenMm = { x: 10, y: 10, z: 10 };

  it.each([
    ['binary STL', 'cube.stl', binaryStl(cube(10))],
    ['ASCII STL', 'cube.STL', asciiStl(cube(10))],
    ['OBJ with quads and negative indices', 'cube.obj', objCube(10)],
    ['3MF', 'cube.3mf', threeMf(cube(10))],
  ])('measures a closed %s cube', (_, name, bytes) => {
    const analysis = analyzeMesh(name, bytes);

    expect(analysis.volumeMl).toBeCloseTo(1, 6);
    expect(analysis.sizeMm).toEqual(tenMm);
    expect(analysis).toMatchObject({
      triangles: 12,
      isWatertight: true,
      warnings: [],
    });
  });

  it('converts 3MF units to millimetres', () => {
    const analysis = analyzeMesh('cube.3mf', threeMf(cube(1), 'centimeter'));

    expect(analysis.units).toBe('centimeter');
    expect(analysis.volumeMl).toBeCloseTo(1, 6);
    expect(analysis.sizeMm).toEqual(tenMm);
  });

  it('flags open meshes but still measures them', () => {
    const analysis = analyzeMesh('open.stl', binaryStl(cube(10).slice(1)));

    expect(analysis.isWatertight).toBe(false);
    expect(analysis.warnings).toEqual(['not_watertight']);
    expect(analysis.volumeMl).toBeGreaterThan(0);
  });

  it('flags tiny unitless models that may be in centimetres or inches', () => {
    expect(analyzeMesh('cube.stl', binaryStl(cube(2))).warnings).toEqual([
      'small_model',
    ]);
  });

  it('measures every model in a ZIP as a separate part', () => {
    const analysis = analyzeMesh(
      'set.zip',
      zip([
        ['readme.txt', Buffer.from('hello')],
        ['models/body.stl', binaryStl(cube(20))],
        ['models/base.obj', objCube(10)],
      ]),
    );

    expect(analysis.parts.map((part) => part.name)).toEqual([
      'models/body.stl',
      'models/base.obj',
    ]);
    expect(analysis.volumeMl).toBeCloseTo(9, 6);
    expect(analysis.sizeMm).toEqual({ x: 20, y: 20, z: 20 });
    expect(analysis.warnings).toEqual(['multiple_parts']);
  });

  it('reads stored ZIP entries', () => {
    expect(
      analyzeMesh(
        'set.zip',
        zip([['a.stl', binaryStl(cube(10))]], { stored: true }),
      ).volumeMl,
    ).toBeCloseTo(1, 6);
  });

  it.each([
    [
      'paths outside the archive',
      zip([['../evil.stl', binaryStl(cube(10))]]),
      'Unsafe path in the archive: ../evil.stl',
    ],
    [
      'too many entries',
      zip(
        Array.from({ length: 51 }, (_, index): [string, Buffer] => [
          `part-${index}.stl`,
          binaryStl(cube(10)),
        ]),
      ),
      'The archive has more than 50 entries',
    ],
    [
      'zip bombs',
      zip([['bomb.stl', Buffer.alloc(10_000_000)]]),
      'bomb.stl is compressed suspiciously well',
    ],
    [
      'entries larger than declared',
      zip([['liar.stl', binaryStl(cube(10))]], { declaredSize: 100 }),
      'liar.stl is damaged',
    ],
    [
      'archives without models',
      zip([['readme.txt', Buffer.from('hello')]]),
      'The archive has no STL, OBJ, or 3MF files',
    ],
    ['files that are not archives', Buffer.from('nope'), 'Not a ZIP archive'],
  ])('rejects %s', (_, bytes, message) => {
    expect(() => analyzeMesh('model.zip', bytes)).toThrow(message);
  });

  it('rejects files that are not STL and models over the triangle limit', () => {
    expect(() => analyzeMesh('x.stl', Buffer.from('hello'))).toThrow(
      'x.stl is not an STL file',
    );
    expect(() =>
      analyzeMesh('cube.stl', binaryStl(cube(10)), {
        ...DEFAULT_MESH_LIMITS,
        maxTriangles: 10,
      }),
    ).toThrow('The model has more than 10 triangles');
  });

  it('recognises model extensions', () => {
    expect(modelExtension('Dragon.Final.STL')).toBe('stl');
    expect(modelExtension('part.step')).toBe('step');
    expect(modelExtension('photo.png')).toBeNull();
    expect(modelExtension('noextension')).toBeNull();
  });
});
