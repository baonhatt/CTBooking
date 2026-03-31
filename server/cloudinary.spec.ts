import { describe, it, expect, vi } from 'vitest';

describe('Cloudinary env config', () => {
  it('should read Cloudinary env variables', async () => {
    vi.resetModules();
    process.env.CLOUDINARY_CLOUD_NAME = 'demo_cloud';
    process.env.CLOUDINARY_API_KEY = 'demo_key';
    process.env.CLOUDINARY_API_SECRET = 'demo_secret';
    const mod = await import('./cloudinary');
    expect(mod.cloudinaryEnvOk).toBe(true);
  });
});
