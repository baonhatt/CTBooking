import type { KVNamespace } from '@cloudflare/workers-types';

const ADMIN_SETTINGS_KEY = 'admin_sidebar_settings';

export async function getAdminSettingsImpl(kv?: KVNamespace) {
  if (!kv) return { settings: null, message: 'KV not configured' };
  const stored = await kv.get(ADMIN_SETTINGS_KEY);
  return { settings: stored ? JSON.parse(stored) : null };
}

export async function updateAdminSettingsImpl(kv: KVNamespace, settings: any) {
  if (!kv) throw new Error('KV not configured');
  await kv.put(ADMIN_SETTINGS_KEY, JSON.stringify(settings));
  return { success: true };
}
