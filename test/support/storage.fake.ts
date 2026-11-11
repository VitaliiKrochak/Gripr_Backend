import type { SignedUpload } from '../../src/integrations/supabase/supabase.storage.service';

/** In-memory stand-in for the private model bucket. */
export class FakeStorage {
  configured = true;
  readonly objects = new Map<string, { bytes: Buffer; size: number }>();

  isConfigured(): boolean {
    return this.configured;
  }

  /** What the browser does with the signed upload URL. */
  put(path: string, bytes: Buffer, size = bytes.length): void {
    this.objects.set(path, { bytes, size });
  }

  createUploadUrl(path: string): Promise<SignedUpload> {
    return Promise.resolve({
      url: `https://storage.test/upload/${path}?token=upload-token`,
      token: 'upload-token',
    });
  }

  size(path: string): Promise<number | null> {
    return Promise.resolve(this.objects.get(path)?.size ?? null);
  }

  download(path: string): Promise<ArrayBuffer> {
    const object = this.objects.get(path);

    if (!object) return Promise.reject(new Error('Object not found'));

    return Promise.resolve(new Uint8Array(object.bytes).buffer);
  }

  createDownloadUrl(
    path: string,
    fileName: string,
    expiresInSeconds: number,
  ): Promise<string> {
    return Promise.resolve(
      `https://storage.test/download/${path}?download=${fileName}&expires=${expiresInSeconds}`,
    );
  }

  remove(paths: string[]): Promise<void> {
    for (const path of paths) this.objects.delete(path);
    return Promise.resolve();
  }
}
