export const DEFAULT_SETTINGS = {
  enable_2fa: false,
  otp_expiry_minutes: 5,
  otp_length: 6,
  otp_resend_cooldown_seconds: 30,
  max_otp_attempts: 5
};

export const DEFAULT_ADMIN_SETTINGS = {
  enable_2fa: true, // Mặc định bật 2FA cho Admin để bảo mật
  otp_expiry_minutes: 5,
  otp_length: 6,
  otp_resend_cooldown_seconds: 30,
  max_otp_attempts: 5
};

export async function getGlobalSettingsImpl(kv?: any) {
  if (!kv) {
    return {

      otp_settings: { ...DEFAULT_SETTINGS },
      admin_otp_settings: { ...DEFAULT_ADMIN_SETTINGS }
    };
  }

  try {
    const dataStr = await kv.get('global_settings');
    if (dataStr) {
      const parsed = JSON.parse(dataStr);
      // Merge for backwards safety
      return {

        otp_settings: { ...DEFAULT_SETTINGS, ...(parsed.otp_settings || {}) },
        admin_otp_settings: { ...DEFAULT_ADMIN_SETTINGS, ...(parsed.admin_otp_settings || {}) }
      };
    }
  } catch (err) {
    console.warn('Failed to parse global_settings from KV', err);
  }

  return {
    otp_settings: { ...DEFAULT_SETTINGS },
    admin_otp_settings: { ...DEFAULT_ADMIN_SETTINGS }
  };
}

export async function updateGlobalSettingsImpl(kv: any, newSettings: any) {
  if (!kv) return null;
  const current = await getGlobalSettingsImpl(kv);
  const updated = { ...current, ...newSettings };
  
  await kv.put('global_settings', JSON.stringify(updated));
  return updated;
}
