import React, { useState, useEffect, useId } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '@/admin/layouts/AdminLayout';
import { useStaffStore } from '@/store/staffStore';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { request } from '@/lib/api/http';
import { useStaffPermission } from '@/hooks/useStaffPermission';
import { PageHeader } from '@/components/admin/common/PageHeader';
import { ConfirmDialog } from '@/components/admin/common/ConfirmDialog';
import { notify } from '@/components/admin/common/notify';
import { ADMIN_BTN_PRIMARY, ADMIN_CARD, ADMIN_INPUT, ADMIN_TEXT } from '@/components/admin/common/adminTokens';

// ====================================================================================================================
// TYPES AND CONSTANTS
// ====================================================================================================================
interface OtpConfig {
  enable_2fa: boolean;
  otp_expiry_minutes: number;
  otp_length: number;
  otp_resend_cooldown_seconds: number;
  max_otp_attempts: number;
}

interface AdminSettingsResponse {
  settings: {
    otp_settings?: OtpConfig;
    admin_otp_settings?: OtpConfig;
  };
}

type OtpNumberKey = 'otp_expiry_minutes' | 'otp_length' | 'otp_resend_cooldown_seconds' | 'max_otp_attempts';

// The four number fields of an OTP config. The ranges are the same ones the server accepts.
const OTP_FIELDS: Array<{ key: OtpNumberKey; label: string; unit: string; min: number; max: number }> = [
  { key: 'otp_expiry_minutes', label: 'Hết hạn sau', unit: 'phút', min: 1, max: 60 },
  { key: 'otp_length', label: 'Độ dài mã', unit: 'ký tự', min: 4, max: 8 },
  { key: 'otp_resend_cooldown_seconds', label: 'Chờ giữa 2 lần gửi', unit: 'giây', min: 10, max: 300 },
  { key: 'max_otp_attempts', label: 'Số lần nhập sai tối đa', unit: 'lần', min: 3, max: 10 }
];

const DEFAULT_OTP_CONFIG: OtpConfig = {
  enable_2fa: false,
  otp_expiry_minutes: 5,
  otp_length: 6,
  otp_resend_cooldown_seconds: 30,
  max_otp_attempts: 5
};

// ====================================================================================================================
// OTP CARD: one card per audience (staff or customers), with its own Save button
// ====================================================================================================================
interface OtpCardProps {
  title: string;
  description: string;
  savedConfig: OtpConfig;
  canEdit: boolean;
  isSaving: boolean;
  onSave: (config: OtpConfig) => void;
}

function config_to_draft(config: OtpConfig) {
  const draft: Record<string, string> = {};
  for (const field of OTP_FIELDS) draft[field.key] = String(config[field.key]);
  return draft;
}

function OtpCard({ title, description, savedConfig, canEdit, isSaving, onSave }: OtpCardProps) {
  const [isEnabled, setIsEnabled] = useState(savedConfig.enable_2fa);
  // Numbers are kept as text while typing, so a field can be cleared and retyped
  const [draft, setDraft] = useState(config_to_draft(savedConfig));
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Start again from the saved values whenever they change (after loading or after a save)
  useEffect(() => {
    setIsEnabled(savedConfig.enable_2fa);
    setDraft(config_to_draft(savedConfig));
    setErrors({});
  }, [savedConfig]);

  const isDirty =
    isEnabled !== savedConfig.enable_2fa || OTP_FIELDS.some((field) => draft[field.key] !== String(savedConfig[field.key]));

  const handleSave = () => {
    const nextErrors: Record<string, string> = {};
    const nextConfig: OtpConfig = { ...savedConfig, enable_2fa: isEnabled };
    for (const field of OTP_FIELDS) {
      const value = Number(draft[field.key]);
      if (draft[field.key].trim() === '' || !Number.isInteger(value) || value < field.min || value > field.max) {
        nextErrors[field.key] = `Nhập số nguyên từ ${field.min} đến ${field.max}`;
      } else {
        nextConfig[field.key] = value;
      }
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length === 0) onSave(nextConfig);
  };

  const fieldPrefix = `fmi_${useId()}_`;

  return (
    <section className={ADMIN_CARD}>
      <div className="flex items-start justify-between gap-4 p-5 border-b border-slate-100">
        <div>
          <h2 className="text-base font-bold text-slate-900">{title}</h2>
          <p className="text-sm text-slate-500 mt-0.5">{description}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-xs font-semibold ${isEnabled ? 'text-blue-600' : 'text-slate-400'}`}>
            {isEnabled ? 'Đang bật' : 'Đang tắt'}
          </span>
          <Switch
            aria-label={`Bật xác thực 2 lớp: ${title}`}
            checked={isEnabled}
            disabled={!canEdit}
            onCheckedChange={setIsEnabled}
            className="data-[state=checked]:bg-blue-600"
          />
        </div>
      </div>

      <div className={`p-5 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 transition-opacity ${isEnabled ? '' : 'opacity-50'}`}>
        {OTP_FIELDS.map((field) => (
          <div key={field.key}>
            <Label htmlFor={fieldPrefix + field.key} className="text-sm text-slate-700">
              {field.label}
            </Label>
            <div className="flex items-center gap-2 mt-1.5">
              <Input
                id={fieldPrefix + field.key}
                type="number"
                inputMode="numeric"
                min={field.min}
                max={field.max}
                value={draft[field.key]}
                disabled={!canEdit}
                onChange={(event) => setDraft({ ...draft, [field.key]: event.target.value })}
                className={`w-28 ${ADMIN_INPUT} ${errors[field.key] ? 'border-red-400' : ''}`}
              />
              <span className="text-sm text-slate-500">{field.unit}</span>
            </div>
            {errors[field.key] && <p className="text-xs text-red-600 mt-1">{errors[field.key]}</p>}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-end gap-3 px-5 py-3 border-t border-slate-100 bg-slate-50/60 rounded-b-xl">
        {isDirty && <span className="text-xs text-amber-600">Có thay đổi chưa lưu</span>}
        <button
          onClick={handleSave}
          disabled={!isDirty || isSaving || !canEdit}
          className={`${ADMIN_BTN_PRIMARY} disabled:opacity-40 disabled:cursor-not-allowed`}
        >
          {isSaving ? 'Đang lưu...' : ADMIN_TEXT.save}
        </button>
      </div>
    </section>
  );
}

// ====================================================================================================================
// PAGE
// ====================================================================================================================
export default function SettingsPage() {
  const navigate = useNavigate();
  const staff = useStaffStore((state) => state.staff);
  const clearStaff = useStaffStore((state) => state.clearStaff);
  const canManageSettings = useStaffPermission('settings', 'manage');

  // The settings as they were loaded or last saved. Saving is blocked until they have been loaded, so the screen's
  // default values can never overwrite the real ones.
  const [staffConfig, setStaffConfig] = useState<OtpConfig>({ ...DEFAULT_OTP_CONFIG, enable_2fa: true });
  const [customerConfig, setCustomerConfig] = useState<OtpConfig>({ ...DEFAULT_OTP_CONFIG });
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [savingKey, setSavingKey] = useState<'staff' | 'customer' | null>(null);
  // Two-factor toggle waiting for the user's confirmation
  const [pendingToggle, setPendingToggle] = useState<{ kind: 'staff' | 'customer'; config: OtpConfig; message: string } | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const data = await request<AdminSettingsResponse>('/api/admin/settings');
      if (data && data.settings) {
        if (data.settings.admin_otp_settings) setStaffConfig(data.settings.admin_otp_settings);
        if (data.settings.otp_settings) setCustomerConfig(data.settings.otp_settings);
        setIsLoaded(true);
        setLoadFailed(false);
      } else {
        setLoadFailed(true);
      }
    } catch (err) {
      console.error('Failed to fetch admin settings:', err);
      setLoadFailed(true);
    }
  };

  // Saves one card only: the server takes each config under its own key
  const requestSave = (kind: 'staff' | 'customer', nextConfig: OtpConfig) => {
    if (!canManageSettings || !isLoaded) return;
    const savedConfig = kind === 'staff' ? staffConfig : customerConfig;

    // Turning two-factor login on or off is confirmed first
    if (nextConfig.enable_2fa !== savedConfig.enable_2fa) {
      let message: string;
      if (kind === 'staff') {
        message = nextConfig.enable_2fa
          ? 'Bật xác thực 2 lớp cho nhân viên? Chỉ bật khi TẤT CẢ nhân viên (trừ Super Admin) có email thật, vì họ sẽ nhận mã OTP qua email để đăng nhập.'
          : 'Tắt xác thực 2 lớp cho nhân viên? Đăng nhập admin sẽ chỉ cần mật khẩu.';
      } else {
        message = nextConfig.enable_2fa
          ? 'Bật xác thực OTP cho khách hàng? Khách sẽ nhận mã OTP qua email khi đăng nhập.'
          : 'Tắt xác thực OTP cho khách hàng?';
      }
      setPendingToggle({ kind, config: nextConfig, message });
      return;
    }
    void saveConfig(kind, nextConfig);
  };

  const saveConfig = async (kind: 'staff' | 'customer', nextConfig: OtpConfig) => {
    if (!canManageSettings || !isLoaded) return;
    setSavingKey(kind);
    try {
      await request('/api/admin/settings', {
        method: 'POST',
        body: JSON.stringify(kind === 'staff' ? { admin_otp_settings: nextConfig } : { otp_settings: nextConfig })
      });
      notify.success('Đã lưu cấu hình thành công');
      if (kind === 'staff') setStaffConfig(nextConfig);
      else setCustomerConfig(nextConfig);
    } catch (err: any) {
      console.error('Failed to save admin settings:', err);
      // The server says why a value was refused (for example a number outside its range)
      notify.error(err, 'Có lỗi xảy ra khi lưu cấu hình');
    } finally {
      setSavingKey(null);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('staffToken');
    clearStaff();
    navigate('/login');
  };

  return (
    <AdminLayout
      active="settings"
      setActive={() => {}}
      adminEmailState={staff?.email || 'admin@email.com'}
      handleLogout={handleLogout}
    >
      <div className="max-w-3xl mx-auto space-y-5">
        <PageHeader
          title="Cấu hình hệ thống"
          description="Xác thực OTP khi đăng nhập. Thay đổi áp dụng ngay cho các mã OTP tạo sau đó."
        />

        {loadFailed && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 flex items-center justify-between gap-3">
            <span>Không tải được cấu hình hiện tại nên chưa thể lưu, để tránh ghi đè giá trị thật.</span>
            <button onClick={fetchSettings} className="font-semibold underline">
              Tải lại
            </button>
          </div>
        )}

        <OtpCard
          title="Đăng nhập nhân viên (Admin)"
          description="Nhân viên nhập mật khẩu rồi nhập mã OTP gửi qua email. Super Admin không bị yêu cầu mã."
          savedConfig={staffConfig}
          canEdit={canManageSettings && isLoaded}
          isSaving={savingKey === 'staff'}
          onSave={(config) => requestSave('staff', config)}
        />

        <OtpCard
          title="Đăng nhập khách hàng"
          description="Khách hàng nhận mã OTP qua email khi đăng nhập trên website."
          savedConfig={customerConfig}
          canEdit={canManageSettings && isLoaded}
          isSaving={savingKey === 'customer'}
          onSave={(config) => requestSave('customer', config)}
        />
      </div>

      <ConfirmDialog
        open={pendingToggle !== null}
        onOpenChange={(open) => {
          if (!open) setPendingToggle(null);
        }}
        variant="warning"
        title="Thay đổi xác thực 2 lớp"
        description={pendingToggle?.message}
        confirmText="Xác nhận"
        onConfirm={() => {
          const toggle = pendingToggle;
          setPendingToggle(null);
          if (toggle) void saveConfig(toggle.kind, toggle.config);
        }}
      />
    </AdminLayout>
  );
}
