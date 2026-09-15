import type { KVNamespace } from '@cloudflare/workers-types';
import { getGlobalSettingsImpl } from '../../lib/global-settings';

const ADMIN_SETTINGS_KEY = 'admin_sidebar_settings';

export async function getAdminSettingsImpl(kv?: any) {
  const globalSet = await getGlobalSettingsImpl(kv);
  return { settings: globalSet };
}

export async function updateAdminSettingsImpl(kv?: any, settings?: any) {
  return { success: true };
}
