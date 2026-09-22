import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '@/admin/layouts/AdminLayout';
import { useStaffStore } from '@/store/staffStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Settings as SettingsIcon,
  LayoutDashboard,
  Mail
} from 'lucide-react';
import { buildUrl, request } from '@/lib/api/http';
import { useStaffPermission } from '@/hooks/useStaffPermission';
import { toast } from 'sonner';

interface AdminSettingsResponse {
  settings: {
    otp_settings?: {
      enable_2fa: boolean;
      otp_expiry_minutes: number;
      otp_length: number;
      otp_resend_cooldown_seconds: number;
      max_otp_attempts: number;
    };
    admin_otp_settings?: {
      enable_2fa: boolean;
      otp_expiry_minutes: number;
      otp_length: number;
      otp_resend_cooldown_seconds: number;
      max_otp_attempts: number;
    };
  };
}

export default function SettingsPage() {
  const navigate = useNavigate();
  const staff = useStaffStore((state) => state.staff);
  const clearStaff = useStaffStore((state) => state.clearStaff);
  const [adminEmail, setAdminEmail] = useState('');
  const defaultOtpConf = {
    enable_2fa: false,
    otp_expiry_minutes: 5,
    otp_length: 6,
    otp_resend_cooldown_seconds: 30,
    max_otp_attempts: 5
  };

  const [otpSettings, setOtpSettings] = useState({ ...defaultOtpConf });
  const [adminOtpSettings, setAdminOtpSettings] = useState({ ...defaultOtpConf, enable_2fa: true });
  const [viewMode, setViewMode] = useState<'admin' | 'user'>('admin');
  const [isSyncing, setIsSyncing] = useState(false);
  const canManageSettings = useStaffPermission('settings', 'manage');

  const isProd = window.location.hostname !== 'localhost';

  useEffect(() => {
    setAdminEmail(staff?.email || 'admin@email.com');

    // Luôn fetch config từ server
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const data = await request<AdminSettingsResponse>('/api/admin/settings');
      if (data && data.settings) {
        if (data.settings.otp_settings) setOtpSettings(data.settings.otp_settings);
        if (data.settings.admin_otp_settings) setAdminOtpSettings(data.settings.admin_otp_settings);
      }
    } catch (err) {
      console.error('Failed to fetch admin settings:', err);
    }
  };

  const handleSaveOtpSettings = async () => {
    if (!canManageSettings) return;
    await saveSettings();
  };

  const saveSettings = async () => {
    setIsSyncing(true);
    try {
      await request('/api/admin/settings', {
        method: 'POST',
        body: JSON.stringify({
          otp_settings: otpSettings,
          admin_otp_settings: adminOtpSettings
        })
      });
      toast.success('Đã lưu cấu hình cài đặt thành công!');
    } catch (err) {
      console.error('Failed to save admin settings:', err);
      toast.error('Có lỗi xảy ra khi lưu cấu hình');
    } finally {
      setIsSyncing(false);
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
      <div className="space-y-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-100">
              <SettingsIcon size={28} className="text-blue-600" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-none mb-1">Cấu hình hệ thống</h1>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-[0.2em]">
                Tùy chỉnh hệ thống & xác thực
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: OTP Settings */}
          <div className="lg:col-span-2 space-y-6">

            {/* OTP Settings Card */}
            <Card className="border-none shadow-2xl shadow-slate-200/50 rounded-[2rem] overflow-hidden bg-white">
              <div className="p-8 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
                <div className="relative z-10 flex items-center gap-4">
                  <div className="p-3 bg-white/10 backdrop-blur-md rounded-2xl border border-white/10">
                    <Mail size={24} className="text-blue-400" />
                  </div>
                  <div>
                    <CardTitle className="text-2xl font-black tracking-tight">Cấu hình OTP / 2FA</CardTitle>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-slate-400 text-sm font-medium">Bật xác thực 2 lớp cho đăng nhập người dùng</p>
                      {isProd && (
                        <Badge
                          variant="outline"
                          className={`ml-2 text-[10px] ${isSyncing ? 'animate-pulse bg-blue-500/10 text-blue-400 border-blue-400/20' : 'bg-green-500/10 text-green-400 border-green-400/20'}`}
                        >
                          {isSyncing ? 'Đang lưu...' : 'Đã đồng bộ cloud'}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <CardContent className="p-8 space-y-6">
                
                {/* Tabs / Segment control */}
                <div className="flex bg-slate-100 p-1.5 rounded-xl w-fit">
                  <button
                    onClick={() => setViewMode('admin')}
                    className={`px-6 py-2 rounded-lg text-sm font-bold transition-all duration-300 flex-1 min-w-[140px] text-center ${viewMode === 'admin' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    Bảo mật Admin
                  </button>
                  <button
                    onClick={() => setViewMode('user')}
                    className={`px-6 py-2 rounded-lg text-sm font-bold transition-all duration-300 flex-1 min-w-[140px] text-center ${viewMode === 'user' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    Khách Hàng (User)
                  </button>
                </div>

                {/* Enable 2FA */}
                <div className="flex items-center justify-between p-5 bg-slate-50 rounded-2xl border border-slate-100">
                  <div>
                    <Label className="text-base font-semibold">Bật 2FA cho đăng nhập ({viewMode === 'admin' ? 'Admin' : 'Khách hàng'})</Label>
                    <p className="text-sm text-slate-500 mt-1">
                      Khi bật, tài khoản sẽ cần nhập OTP gửi qua email sau khi nhập mật khẩu
                    </p>
                  </div>
                  <Switch
                    checked={viewMode === 'admin' ? adminOtpSettings.enable_2fa : otpSettings.enable_2fa}
                    disabled={!canManageSettings}
                    onCheckedChange={(checked) => {
                      if (viewMode === 'admin') setAdminOtpSettings({ ...adminOtpSettings, enable_2fa: checked });
                      else setOtpSettings({ ...otpSettings, enable_2fa: checked });
                    }}
                    className="data-[state=checked]:bg-blue-600"
                  />
                </div>

                {/* OTP Settings Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label>Thời gian hết hạn OTP (phút)</Label>
                    <Input
                      type="number"
                      min={1}
                      max={60}
                      value={viewMode === 'admin' ? adminOtpSettings.otp_expiry_minutes : otpSettings.otp_expiry_minutes}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 5;
                        if (viewMode === 'admin') setAdminOtpSettings({ ...adminOtpSettings, otp_expiry_minutes: val });
                        else setOtpSettings({ ...otpSettings, otp_expiry_minutes: val });
                      }}
                      className="mt-2"
                    />
                    <p className="text-sm text-slate-500 mt-1">OTP sẽ hết hạn sau số phút này</p>
                  </div>

                  <div>
                    <Label>Độ dài OTP</Label>
                    <Input
                      type="number"
                      min={4}
                      max={8}
                      value={viewMode === 'admin' ? adminOtpSettings.otp_length : otpSettings.otp_length}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 6;
                        if (viewMode === 'admin') setAdminOtpSettings({ ...adminOtpSettings, otp_length: val });
                        else setOtpSettings({ ...otpSettings, otp_length: val });
                      }}
                      className="mt-2"
                    />
                    <p className="text-sm text-slate-500 mt-1">Số ký tự của mã OTP (4-8)</p>
                  </div>

                  <div>
                    <Label>Thời gian chờ gửi lại (giây)</Label>
                    <Input
                      type="number"
                      min={10}
                      max={300}
                      value={viewMode === 'admin' ? adminOtpSettings.otp_resend_cooldown_seconds : otpSettings.otp_resend_cooldown_seconds}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 30;
                        if (viewMode === 'admin') setAdminOtpSettings({ ...adminOtpSettings, otp_resend_cooldown_seconds: val });
                        else setOtpSettings({ ...otpSettings, otp_resend_cooldown_seconds: val });
                      }}
                      className="mt-2"
                    />
                    <p className="text-sm text-slate-500 mt-1">Thời gian chờ giữa các lần gửi lại</p>
                  </div>

                  <div>
                    <Label>Số lần thử tối đa</Label>
                    <Input
                      type="number"
                      min={3}
                      max={10}
                      value={viewMode === 'admin' ? adminOtpSettings.max_otp_attempts : otpSettings.max_otp_attempts}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 5;
                        if (viewMode === 'admin') setAdminOtpSettings({ ...adminOtpSettings, max_otp_attempts: val });
                        else setOtpSettings({ ...otpSettings, max_otp_attempts: val });
                      }}
                      className="mt-2"
                    />
                    <p className="text-sm text-slate-500 mt-1">Số lần nhập sai tối đa trước khi khóa</p>
                  </div>
                </div>

                <button
                  onClick={handleSaveOtpSettings}
                  disabled={isSyncing || !canManageSettings}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSyncing ? 'Đang lưu...' : 'Lưu cài đặt OTP'}
                </button>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Tips & Info */}
          <div className="space-y-6">
            <Card className="border-none shadow-2xl shadow-slate-200/50 rounded-[2rem] bg-indigo-600 text-white p-8 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
              <h3 className="text-xl font-black mb-4 flex items-center gap-2">
                <LayoutDashboard size={20} /> Bảo mật 2FA
              </h3>
              <p className="text-sm font-medium text-indigo-100 leading-[1.6]">
                Bật xác thực hai lớp (2FA) giúp tăng cường bảo mật cho toàn bộ tài khoản nhân viên và người dùng khi đăng nhập vào hệ thống Cinesphere.
              </p>
            </Card>

            <div className="p-8 bg-blue-50 border border-blue-100 rounded-[2rem] space-y-4">
              <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white">
                <SettingsIcon size={20} />
              </div>
              <h4 className="text-lg font-black text-slate-900">Lưu ý cấu hình</h4>
              <p className="text-xs text-slate-600 font-medium leading-relaxed">
                Mọi thay đổi cấu hình OTP sẽ áp dụng ngay lập tức cho các lần tạo và gửi mã OTP tiếp theo.
              </p>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
