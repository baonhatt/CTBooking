import { Context } from 'hono';
import { sendMail } from '../../../../server/routes/mail-service';
import { uploadCloudinaryImageDataURI, deleteCloudinaryImage, getPublicIdFromUrl, hasCloudinary } from '../../utils';

export function getRestrictBranchIds(c: Context): number[] | null {
  const isSuperAdmin = c.get('isSuperAdmin');
  const staffBranchIds = (c.get('staffBranchIds') as number[] | undefined) || [];
  return isSuperAdmin ? null : staffBranchIds;
}

export function getMailer(c: Context) {
  return async (to: string, subject: string, html: string) => {
    const res = await sendMail(to, subject, html, c.env);
    if (res.ok) console.log(`[AdminMailer] Sent to ${to} via ${res.provider}`);
    return res;
  };
}

export const getCloudHelpers = (c: Context, env: any) => {
  return {
    uploader: async (base64: string, folder: string) => {
      try {
        if (hasCloudinary(env)) {
          const res = await uploadCloudinaryImageDataURI(env, base64, folder);
          return { url: res.url };
        }
      } catch (err) {
        console.warn('[Uploader] Cloudinary upload failed, using Data URI fallback:', err);
      }
      return { url: base64 };
    },
    deleter: async (url: string, type: 'image' | 'video' = 'image') => {
      try {
        const publicId = getPublicIdFromUrl(url);
        if (publicId && hasCloudinary(env)) {
          await deleteCloudinaryImage(env, publicId, type);
        }
      } catch (err) {
        console.warn('[Deleter] Cloudinary delete warning:', err);
      }
    }
  };
};
