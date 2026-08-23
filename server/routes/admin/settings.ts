import type { KVNamespace } from '@cloudflare/workers-types';

const ADMIN_SETTINGS_KEY = 'admin_sidebar_settings';

const DEFAULT_SETTINGS = {
<<<<<<< HEAD
        enable_2fa: false,
        otp_expiry_minutes: 5,
        otp_length: 6,
        otp_resend_cooldown_seconds: 30,
        max_otp_attempts: 5
};

export async function getAdminSettingsImpl(kv?: KVNamespace) {
        if (!kv) return { settings: null, message: 'KV not configured' };
        const stored = await kv.get(ADMIN_SETTINGS_KEY);
        if (!stored) {
                return { settings: { hidden_tabs: [], otp_settings: DEFAULT_SETTINGS } };
        }
        const parsed = JSON.parse(stored);
        // Handle both old format (array) and new format (object)
        if (Array.isArray(parsed)) {
                return { settings: { hidden_tabs: parsed, otp_settings: DEFAULT_SETTINGS } };
        }
        return { settings: { hidden_tabs: parsed.hidden_tabs || [], otp_settings: { ...DEFAULT_SETTINGS, ...parsed.otp_settings } } };
}

export async function updateAdminSettingsImpl(kv: KVNamespace, settings: any) {
        if (!kv) throw new Error('KV not configured');
        const current = await getAdminSettingsImpl(kv);
        // Handle both old format (array) and new format (object)
        const hidden_tabs = Array.isArray(settings) ? settings : (settings.hidden_tabs || []);
        const otp_settings = settings.otp_settings || current.settings?.otp_settings || DEFAULT_SETTINGS;
        const merged = { hidden_tabs, otp_settings };
        await kv.put(ADMIN_SETTINGS_KEY, JSON.stringify(merged));
        return { success: true };
=======
  enable_2fa: false,
  otp_expiry_minutes: 5,
  otp_length: 6,
  otp_resend_cooldown_seconds: 30,
  max_otp_attempts: 5
};

export async function getAdminSettingsImpl(kv?: KVNamespace) {
  if (!kv) return { settings: null, message: 'KV not configured' };
  const stored = await kv.get(ADMIN_SETTINGS_KEY);
  if (!stored) {
    return { settings: { hidden_tabs: [], otp_settings: DEFAULT_SETTINGS } };
  }
  const parsed = JSON.parse(stored);
  // Handle both old format (array) and new format (object)
  if (Array.isArray(parsed)) {
    return { settings: { hidden_tabs: parsed, otp_settings: DEFAULT_SETTINGS } };
  }
  return {
    settings: { hidden_tabs: parsed.hidden_tabs || [], otp_settings: { ...DEFAULT_SETTINGS, ...parsed.otp_settings } }
  };
}

export async function updateAdminSettingsImpl(kv: KVNamespace, settings: any) {
  if (!kv) throw new Error('KV not configured');
  const current = await getAdminSettingsImpl(kv);
  // Handle both old format (array) and new format (object)
  const hidden_tabs = Array.isArray(settings) ? settings : settings.hidden_tabs || [];
  const otp_settings = settings.otp_settings || current.settings?.otp_settings || DEFAULT_SETTINGS;
  const merged = { hidden_tabs, otp_settings };
  await kv.put(ADMIN_SETTINGS_KEY, JSON.stringify(merged));
  return { success: true };
>>>>>>> preview
}
