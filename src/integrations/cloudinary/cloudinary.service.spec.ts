import { createHash } from 'node:crypto';
import { CloudinaryService } from './cloudinary.service';

describe('CloudinaryService', () => {
  const service = new CloudinaryService({
    cloudName: 'demo',
    apiKey: 'key',
    apiSecret: 'secret',
    rootFolder: 'jewelry',
  });

  it('signs uploads with the sorted parameters and the API secret', () => {
    const signature = service.createUploadSignature('jewelry/products', 100);

    expect(signature).toEqual({
      cloudName: 'demo',
      apiKey: 'key',
      timestamp: 100,
      folder: 'jewelry/products',
      signature: createHash('sha1')
        .update('folder=jewelry/products&timestamp=100secret')
        .digest('hex'),
      uploadUrl: 'https://api.cloudinary.com/v1_1/demo/image/upload',
    });
  });

  it('uploads remote images with a signed request', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(
      Response.json({
        public_id: 'jewelry/products/abc',
        secure_url: 'https://res.cloudinary.com/demo/image/upload/abc.jpg',
      }),
    );

    await expect(
      service.uploadFromUrl('https://media.test/a.jpg', 'jewelry/products'),
    ).resolves.toEqual({
      publicId: 'jewelry/products/abc',
      url: 'https://res.cloudinary.com/demo/image/upload/abc.jpg',
    });

    const body = fetchSpy.mock.calls[0][1]?.body as URLSearchParams;
    expect(body.get('file')).toBe('https://media.test/a.jpg');
    expect(body.get('folder')).toBe('jewelry/products');
    expect(body.get('signature')).toBe(
      createHash('sha1')
        .update(
          `folder=jewelry/products&timestamp=${body.get('timestamp')}secret`,
        )
        .digest('hex'),
    );
    fetchSpy.mockRestore();
  });

  it('rejects failed remote uploads', async () => {
    const fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(
        Response.json({ error: { message: 'bad url' } }, { status: 400 }),
      );

    await expect(
      service.uploadFromUrl('https://media.test/a.jpg', 'jewelry/products'),
    ).rejects.toThrow('bad url');
    fetchSpy.mockRestore();
  });

  it('builds folders below the root folder', () => {
    expect(service.folder('custom-requests', 'user-1')).toBe(
      'jewelry/custom-requests/user-1',
    );
  });

  it('accepts only assets from this cloud and folder', () => {
    const folder = 'jewelry/custom-requests/user-1';
    const publicId = `${folder}/ring`;
    const url = `https://res.cloudinary.com/demo/image/upload/v1/${publicId}.jpg`;

    expect(service.isOwnedAsset({ publicId, url }, folder)).toBe(true);
    expect(
      service.isOwnedAsset(
        { publicId, url: url.replace('/demo/', '/other/') },
        folder,
      ),
    ).toBe(false);
    expect(
      service.isOwnedAsset(
        { publicId: 'jewelry/custom-requests/user-2/ring', url },
        folder,
      ),
    ).toBe(false);
  });
});
