import { inflateRawSync } from 'node:zlib';
import { MeshError } from './mesh.measure';
import type { MeshLimits } from './mesh.measure';

export interface ZipEntry {
  name: string;
  size: number;
  read(): Buffer;
}

const END_OF_DIRECTORY = 0x06054b50;
const DIRECTORY_ENTRY = 0x02014b50;
const LOCAL_HEADER = 0x04034b50;

/**
 * Lists the files of a ZIP archive without extracting them. Rejects
 * encrypted and ZIP64 archives, paths outside the archive, too many entries,
 * too much uncompressed data, and suspicious compression ratios; extraction
 * never inflates more than the declared size.
 */
export function readZip(bytes: Buffer, limits: MeshLimits): ZipEntry[] {
  const end = findEndOfDirectory(bytes);
  const count = bytes.readUInt16LE(end + 10);
  const directoryOffset = bytes.readUInt32LE(end + 16);

  if (count === 0xffff || directoryOffset === 0xffffffff) {
    throw new MeshError('ZIP64 archives are not supported');
  }

  if (count > limits.maxEntries) {
    throw new MeshError(
      `The archive has more than ${limits.maxEntries} entries`,
    );
  }

  const entries: ZipEntry[] = [];
  let total = 0;
  let position = directoryOffset;

  for (let index = 0; index < count; index += 1) {
    if (
      position + 46 > bytes.length ||
      bytes.readUInt32LE(position) !== DIRECTORY_ENTRY
    ) {
      throw new MeshError('The archive is damaged');
    }

    const flags = bytes.readUInt16LE(position + 8);
    const method = bytes.readUInt16LE(position + 10);
    const compressedSize = bytes.readUInt32LE(position + 20);
    const size = bytes.readUInt32LE(position + 24);
    const nameLength = bytes.readUInt16LE(position + 28);
    const extraLength = bytes.readUInt16LE(position + 30);
    const commentLength = bytes.readUInt16LE(position + 32);
    const localOffset = bytes.readUInt32LE(position + 42);
    const name = bytes.toString(
      flags & 0x800 ? 'utf8' : 'latin1',
      position + 46,
      position + 46 + nameLength,
    );
    position += 46 + nameLength + extraLength + commentLength;

    if (name.endsWith('/')) {
      continue;
    }

    if (!isSafePath(name)) {
      throw new MeshError(`Unsafe path in the archive: ${name}`);
    }

    if (flags & 0x1) {
      throw new MeshError('Encrypted archives are not supported');
    }

    if (method !== 0 && method !== 8) {
      throw new MeshError(`Unsupported compression in ${name}`);
    }

    total += size;

    if (total > limits.maxUncompressedBytes) {
      throw new MeshError('The archive is too large when unpacked');
    }

    if (
      size > 0 &&
      (compressedSize === 0 ||
        size / compressedSize > limits.maxCompressionRatio)
    ) {
      throw new MeshError(`${name} is compressed suspiciously well`);
    }

    entries.push({
      name,
      size,
      read: () =>
        extract(bytes, localOffset, method, compressedSize, size, name),
    });
  }

  return entries;
}

function findEndOfDirectory(bytes: Buffer): number {
  const last = bytes.length - 22;

  for (
    let position = last;
    position >= Math.max(0, last - 0xffff);
    position -= 1
  ) {
    if (bytes.readUInt32LE(position) === END_OF_DIRECTORY) {
      return position;
    }
  }

  throw new MeshError('Not a ZIP archive');
}

function isSafePath(name: string): boolean {
  if (name.startsWith('/') || name.includes('\\') || /^[a-z]:/i.test(name)) {
    return false;
  }

  return name.split('/').every((segment) => segment !== '..');
}

function extract(
  bytes: Buffer,
  offset: number,
  method: number,
  compressedSize: number,
  size: number,
  name: string,
): Buffer {
  if (
    offset + 30 > bytes.length ||
    bytes.readUInt32LE(offset) !== LOCAL_HEADER
  ) {
    throw new MeshError(`${name} is damaged`);
  }

  const start =
    offset +
    30 +
    bytes.readUInt16LE(offset + 26) +
    bytes.readUInt16LE(offset + 28);
  const data = bytes.subarray(start, start + compressedSize);

  if (data.length !== compressedSize) {
    throw new MeshError(`${name} is damaged`);
  }

  let content: Buffer;

  try {
    content =
      method === 0
        ? Buffer.from(data)
        : inflateRawSync(data, { maxOutputLength: Math.max(size, 1) });
  } catch {
    throw new MeshError(`${name} is damaged`);
  }

  if (content.length !== size) {
    throw new MeshError(`${name} is damaged`);
  }

  return content;
}
