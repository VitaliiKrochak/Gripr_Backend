import type { CloudinaryService } from '../../integrations/cloudinary/cloudinary.service';

/** Cloudinary folder where a customer may upload reference images. */
export function customerUploadFolder(
  cloudinary: CloudinaryService,
  userId: string,
): string {
  return cloudinary.folder('custom-requests', userId);
}
