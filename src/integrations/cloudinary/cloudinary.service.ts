import { createHash } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { CLOUDINARY_CONFIG } from './cloudinary.config';
import type { CloudinaryConfig } from './cloudinary.config';

export interface UploadSignature {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  folder: string;
  signature: string;
  uploadUrl: string;
}

@Injectable()
export class CloudinaryService {
  constructor(
    @Inject(CLOUDINARY_CONFIG) private readonly config: CloudinaryConfig,
  ) {}

  /** Absolute folder path below the application root folder. */
  folder(...segments: string[]): string {
    return [this.config.rootFolder, ...segments].join('/');
  }

  /**
   * Signs a direct browser upload restricted to `folder`. The browser posts
   * the file with these fields to `uploadUrl`.
   */
  createUploadSignature(
    folder: string,
    timestamp = Math.floor(Date.now() / 1000),
  ): UploadSignature {
    return {
      cloudName: this.config.cloudName,
      apiKey: this.config.apiKey,
      timestamp,
      folder,
      signature: this.sign({ folder, timestamp }),
      uploadUrl: `https://api.cloudinary.com/v1_1/${this.config.cloudName}/image/upload`,
    };
  }

  /** Server-side upload of a remote image into `folder`. */
  async uploadFromUrl(
    url: string,
    folder: string,
  ): Promise<{ publicId: string; url: string }> {
    const timestamp = Math.floor(Date.now() / 1000);
    const body = new URLSearchParams({
      file: url,
      folder,
      timestamp: String(timestamp),
      api_key: this.config.apiKey,
      signature: this.sign({ folder, timestamp }),
    });
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${this.config.cloudName}/image/upload`,
      { method: 'POST', body },
    );
    const payload = (await response.json()) as {
      public_id?: string;
      secure_url?: string;
      error?: { message?: string };
    };

    if (!response.ok || !payload.public_id || !payload.secure_url) {
      throw new Error(
        `Cloudinary upload failed: ${payload.error?.message ?? response.status}`,
      );
    }

    return { publicId: payload.public_id, url: payload.secure_url };
  }

  async destroy(publicId: string): Promise<void> {
    const timestamp = Math.floor(Date.now() / 1000);
    const body = new URLSearchParams({
      public_id: publicId,
      timestamp: String(timestamp),
      api_key: this.config.apiKey,
      signature: this.sign({ public_id: publicId, timestamp }),
    });
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${this.config.cloudName}/image/destroy`,
      { method: 'POST', body },
    );
    const payload = (await response.json()) as { result?: string };

    if (payload.result !== 'ok' && payload.result !== 'not found') {
      throw new Error(`Cloudinary destroy failed: ${payload.result}`);
    }
  }

  /** `true` when the asset was uploaded to this cloud inside `folder`. */
  isOwnedAsset(asset: { publicId: string; url: string }, folder: string) {
    return (
      asset.publicId.startsWith(`${folder}/`) &&
      asset.url.startsWith(
        `https://res.cloudinary.com/${this.config.cloudName}/`,
      ) &&
      asset.url.includes(`/${asset.publicId}`)
    );
  }

  private sign(params: Record<string, string | number>): string {
    const payload = Object.keys(params)
      .sort()
      .map((key) => `${key}=${params[key]}`)
      .join('&');

    return createHash('sha1')
      .update(payload + this.config.apiSecret)
      .digest('hex');
  }
}
