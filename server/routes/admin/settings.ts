import { getGlobalSettingsImpl, updateGlobalSettingsImpl } from '../../lib/global-settings';
import { validateSettingsPatch, describeSettingsChange } from '../../lib/settings-validation';
import { logAuditAction } from '../../lib/audit-logger';

export async function getAdminSettingsImpl(kv?: any) {
  const globalSet = await getGlobalSettingsImpl(kv);
  return { settings: globalSet };
}

/**
 * Saves a change of the OTP settings.
 *  - Only known keys with values in their allowed range are accepted (see settings-validation.ts).
 *  - Without the KV store nothing can be saved, and the answer says so instead of "success".
 *  - Every change is written to the audit log with the old and the new values.
 */
export async function updateAdminSettingsImpl(
  kv?: any,
  settings?: any,
  audit?: { db: any; auditLogs: any; staff: { id: number; email: string; fullname: string } }
) {
  if (!kv) {
    throw Object.assign(new Error('Chưa cấu hình nơi lưu cài đặt nên chưa thể lưu thay đổi'), { statusCode: 503 });
  }

  const patch = validateSettingsPatch(settings);
  const before = await getGlobalSettingsImpl(kv);
  const after = await updateGlobalSettingsImpl(kv, patch);

  const changes = describeSettingsChange(before, after);
  if (audit && changes.length > 0) {
    await logAuditAction(
      audit.db,
      audit.auditLogs,
      'update',
      'settings',
      0,
      'Đổi cài đặt OTP: ' + changes.join('; '),
      audit.staff.id,
      audit.staff.email,
      audit.staff.fullname,
      JSON.stringify(before),
      JSON.stringify(after)
    );
  }

  return { success: true, settings: after, changed: changes.length };
}
