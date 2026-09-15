export const DEFAULT_SETTINGS = {
  enable_2fa: false,
  otp_expiry_minutes: 5,
  otp_length: 6,
  otp_resend_cooldown_seconds: 30,
  max_otp_attempts: 5
};

export async function getGlobalSettingsImpl(_kv?: any) {
  // Logic to read from KV will be implemented here
  return { hidden_tabs: [], otp_settings: DEFAULT_SETTINGS };
}
