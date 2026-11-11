/** A file that cannot be measured; the message is shown to the customer. */
export class MeshError extends Error {}

export interface MeshSize {
  x: number;
  y: number;
  z: number;
}

/** Measurements of one mesh, already in millimetres. */
export interface MeshPart {
  name: string;
  triangles: number;
  volumeMl: number;
  sizeMm: MeshSize;
  /** Every edge is shared by exactly two triangles. */
  isWatertight: boolean;
}

export interface MeshLimits {
  maxTriangles: number;
  /** ZIP archives, including 3MF. */
  maxEntries: number;
  maxUncompressedBytes: number;
  maxCompressionRatio: number;
}

export const DEFAULT_MESH_LIMITS: MeshLimits = {
  maxTriangles: 5_000_000,
  maxEntries: 50,
  maxUncompressedBytes: 300 * 1024 * 1024,
  maxCompressionRatio: 100,
};

const MAX_VERTICES = 2 ** 26;

/**
 * Collects the triangles of one mesh. The volume is the sum of the signed
 * tetrahedra between each triangle and the origin (the divergence theorem),
 * which is exact only for closed meshes; vertices are welded by their exact
 * coordinates to check that.
 */
export class MeshAccumulator {
  private signedVolume = 0;
  private count = 0;
  private readonly min = [Infinity, Infinity, Infinity];
  private readonly max = [-Infinity, -Infinity, -Infinity];
  private readonly vertices = new Map<string, number>();
  private readonly edges = new Map<number, number>();
  private trackEdges = true;

  constructor(
    readonly name: string,
    private readonly limits: MeshLimits,
    /** Millimetres per file unit. */
    private readonly scale = 1,
  ) {}

  addTriangle(
    ax: number,
    ay: number,
    az: number,
    bx: number,
    by: number,
    bz: number,
    cx: number,
    cy: number,
    cz: number,
  ): void {
    if (!Number.isFinite(ax + ay + az + bx + by + bz + cx + cy + cz)) {
      throw new MeshError(`${this.name}: invalid vertex coordinates`);
    }

    this.count += 1;

    if (this.count > this.limits.maxTriangles) {
      throw new MeshError(
        `The model has more than ${this.limits.maxTriangles} triangles`,
      );
    }

    this.signedVolume +=
      (ax * (by * cz - bz * cy) -
        ay * (bx * cz - bz * cx) +
        az * (bx * cy - by * cx)) /
      6;
    this.extend(ax, ay, az);
    this.extend(bx, by, bz);
    this.extend(cx, cy, cz);

    if (this.trackEdges) {
      const a = this.vertex(ax, ay, az);
      const b = this.vertex(bx, by, bz);
      const c = this.vertex(cx, cy, cz);

      if (a !== b && b !== c && a !== c) {
        this.edge(a, b);
        this.edge(b, c);
        this.edge(c, a);
      }
    }
  }

  get triangles(): number {
    return this.count;
  }

  result(): MeshPart {
    if (this.count === 0) {
      throw new MeshError(`${this.name}: the model has no triangles`);
    }

    const scale = this.scale;

    return {
      name: this.name,
      triangles: this.count,
      volumeMl: (Math.abs(this.signedVolume) * scale ** 3) / 1000,
      sizeMm: {
        x: (this.max[0] - this.min[0]) * scale,
        y: (this.max[1] - this.min[1]) * scale,
        z: (this.max[2] - this.min[2]) * scale,
      },
      isWatertight:
        this.trackEdges &&
        this.edges.size > 0 &&
        [...this.edges.values()].every((uses) => uses === 2),
    };
  }

  private extend(x: number, y: number, z: number): void {
    if (x < this.min[0]) this.min[0] = x;
    if (y < this.min[1]) this.min[1] = y;
    if (z < this.min[2]) this.min[2] = z;
    if (x > this.max[0]) this.max[0] = x;
    if (y > this.max[1]) this.max[1] = y;
    if (z > this.max[2]) this.max[2] = z;
  }

  private vertex(x: number, y: number, z: number): number {
    const key = `${x},${y},${z}`;
    let index = this.vertices.get(key);

    if (index === undefined) {
      index = this.vertices.size;

      if (index >= MAX_VERTICES) {
        this.trackEdges = false;
        this.vertices.clear();
        this.edges.clear();
        return 0;
      }

      this.vertices.set(key, index);
    }

    return index;
  }

  private edge(a: number, b: number): void {
    const key = a < b ? a * MAX_VERTICES + b : b * MAX_VERTICES + a;
    this.edges.set(key, (this.edges.get(key) ?? 0) + 1);
  }
}
