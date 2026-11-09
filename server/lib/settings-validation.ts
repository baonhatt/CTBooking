// Checks for the OTP settings that staff can change (settings screen).

/** A deliberate refusal. statusCode is read by the route. */
function refusal(statusCode: number, message: string): Error {
  const error: any = new Error(message);
  error.statusCode = statusCode;
  return error;
}

/** The settings of one OTP group and the allowed range of each number. */
export const OTP_SETTING_LIMITS = {
  otp_length: { min: 4, max: 8, label: 'Độ dài mã OTP' },
  otp_expiry_minutes: { min: 1, max: 30, label: 'Thời hạn OTP (phút)' },
  otp_resend_cooldown_seconds: { min: 10, max: 300, label: 'Thời gian chờ gửi lại OTP (giây)' },
  max_otp_attempts: { min: 3, max: 10, label: 'Số lần nhập sai OTP tối đa' }
} as const;

/** The two groups of settings: for customers and for staff. */
export const SETTING_GROUPS = ['otp_settings', 'admin_otp_settings'] as const;

export type OtpSettingsPatch = Partial<{
  enable_2fa: boolean;
  otp_length: number;
  otp_expiry_minutes: number;
  otp_resend_cooldown_seconds: number;
  max_otp_attempts: number;
}>;

export type SettingsPatch = Partial<Record<(typeof SETTING_GROUPS)[number], OtpSettingsPatch>>;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Checks a settings change sent by the screen and returns a clean copy.
 * Only the two groups and the keys above are accepted. A key that is not known is refused, not ignored, so a
 * typo or an attempt to store something else is noticed.
 */
export function validateSettingsPatch(body: unknown): SettingsPatch {
  if (!isPlainObject(body)) throw refusal(400, 'Dữ liệu cài đặt không hợp lệ');

  const patch: SettingsPatch = {};
  for (const [group, groupValue] of Object.entries(body)) {
    if (!(SETTING_GROUPS as readonly string[]).includes(group)) {
      throw refusal(400, 'Khóa cài đặt không hợp lệ: ' + group);
    }
    if (!isPlainObject(groupValue)) throw refusal(400, 'Nhóm cài đặt không hợp lệ: ' + group);

    const cleanGroup: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(groupValue)) {
      if (key === 'enable_2fa') {
        if (typeof value !== 'boolean') throw refusal(400, 'enable_2fa phải là bật hoặc tắt');
        cleanGroup[key] = value;
        continue;
      }
      const limit = (OTP_SETTING_LIMITS as Record<string, { min: number; max: number; label: string }>)[key];
      if (!limit) throw refusal(400, 'Khóa cài đặt không hợp lệ: ' + group + '.' + key);

      const number = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
      if (typeof number !== 'number' || !Number.isInteger(number) || number < limit.min || number > limit.max) {
        throw refusal(400, limit.label + ' phải là số nguyên từ ' + limit.min + ' đến ' + limit.max);
      }
      cleanGroup[key] = number;
    }
    (patch as any)[group] = cleanGroup;
  }
  return patch;
}

/** The settings that differ between two versions, as lines of text for the audit log. */
export function describeSettingsChange(before: any, after: any): string[] {
  const lines: string[] = [];
  for (const group of SETTING_GROUPS) {
    const oldGroup = before?.[group] || {};
    const newGroup = after?.[group] || {};
    for (const key of Object.keys(newGroup)) {
      if (oldGroup[key] !== newGroup[key]) lines.push(group + '.' + key + ': ' + String(oldGroup[key]) + ' -> ' + String(newGroup[key]));
    }
  }
  return lines;
}
