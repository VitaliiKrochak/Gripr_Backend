import { binaryStl, cube } from '../../../../test/support/mesh.fixtures';
import { MeshAnalyzer } from './mesh.analyzer';

function arrayBuffer(bytes: Buffer): ArrayBuffer {
  return new Uint8Array(bytes).buffer;
}

describe('MeshAnalyzer', () => {
  const analyzer = new MeshAnalyzer();

  it('measures a file in a worker thread', async () => {
    const analysis = await analyzer.analyze(
      'cube.stl',
      arrayBuffer(binaryStl(cube(10))),
    );

    expect(analysis.volumeMl).toBeCloseTo(1, 6);
    expect(analysis.isWatertight).toBe(true);
  });

  it('reports files it cannot measure', async () => {
    await expect(
      analyzer.analyze('broken.stl', arrayBuffer(Buffer.from('broken'))),
    ).rejects.toThrow('broken.stl is not an STL file');
  });

  it('stops a worker that takes too long', async () => {
    const slow = new MeshAnalyzer();
    slow.timeoutMs = 1;

    await expect(
      slow.analyze('cube.stl', arrayBuffer(binaryStl(cube(10)))),
    ).rejects.toThrow('Measuring the file took too long');
  });
});
