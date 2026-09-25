export interface CloudinaryConfig {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
  /** Root folder for every asset uploaded by this application. */
  rootFolder: string;
}

export const CLOUDINARY_CONFIG = Symbol('CLOUDINARY_CONFIG');

export function getCloudinaryConfig(): CloudinaryConfig {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error(
      'CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET must be configured',
    );
  }

  return { cloudName, apiKey, apiSecret, rootFolder: 'jewelry' };
}
