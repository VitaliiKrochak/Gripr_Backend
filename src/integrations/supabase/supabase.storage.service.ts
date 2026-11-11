import { Inject, Injectable } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CONFIG } from './supabase.config';
import type { SupabaseConfig } from './supabase.config';

/** Private bucket of Gripr Lab model files. */
export const MODEL_BUCKET = 'lab-models';
/** Free-plan per-file limit; raise together with the Supabase plan. */
export const MODEL_FILE_LIMIT_BYTES = 50 * 1024 * 1024;

export interface SignedUpload {
  /** `PUT` the file body here (or use `uploadToSignedUrl` with `token`). */
  url: string;
  token: string;
}

/**
 * Supabase Storage with the secret key, so the API can sign uploads into and
 * downloads from the private model bucket. Signed upload URLs are valid for
 * two hours.
 */
@Injectable()
export class SupabaseStorageService {
  private readonly client: SupabaseClient<any, any, any, any, any> | null;
  private bucket: Promise<void> | null = null;

  constructor(@Inject(SUPABASE_CONFIG) config: SupabaseConfig) {
    this.client = config.secretKey
      ? createClient(config.url, config.secretKey, {
          auth: {
            autoRefreshToken: false,
            detectSessionInUrl: false,
            persistSession: false,
          },
        })
      : null;
  }

  isConfigured(): boolean {
    return this.client !== null;
  }

  async createUploadUrl(path: string): Promise<SignedUpload> {
    await this.ensureBucket();
    const { data, error } = await this.files().createSignedUploadUrl(path);

    if (error) throw error;

    return { url: data.signedUrl, token: data.token };
  }

  /** The stored object size in bytes, or `null` when nothing was uploaded. */
  async size(path: string): Promise<number | null> {
    const { data, error } = await this.files().info(path);

    if (error) {
      if (await this.exists(path)) throw error;
      return null;
    }

    return data.size ?? null;
  }

  async download(path: string): Promise<ArrayBuffer> {
    const { data, error } = await this.files().download(path);

    if (error) throw error;

    return data.arrayBuffer();
  }

  async createDownloadUrl(
    path: string,
    fileName: string,
    expiresInSeconds: number,
  ): Promise<string> {
    const { data, error } = await this.files().createSignedUrl(
      path,
      expiresInSeconds,
      { download: fileName },
    );

    if (error) throw error;

    return data.signedUrl;
  }

  async remove(paths: string[]): Promise<void> {
    if (!paths.length) return;

    const { error } = await this.files().remove(paths);

    if (error) throw error;
  }

  private async exists(path: string): Promise<boolean> {
    const { data } = await this.files().exists(path);
    return data;
  }

  private files() {
    if (!this.client) {
      throw new Error('SUPABASE_SECRET_KEY is not configured');
    }

    return this.client.storage.from(MODEL_BUCKET);
  }

  /** Creates the private bucket on first use when it does not exist yet. */
  private ensureBucket(): Promise<void> {
    this.bucket ??= (async () => {
      const storage = this.client!.storage;
      const { error } = await storage.getBucket(MODEL_BUCKET);

      if (!error) return;

      const created = await storage.createBucket(MODEL_BUCKET, {
        public: false,
        fileSizeLimit: MODEL_FILE_LIMIT_BYTES,
      });

      if (created.error) throw created.error;
    })().catch((error: unknown) => {
      this.bucket = null;
      throw error;
    });

    return this.bucket;
  }
}
