import { useState } from 'react';
import { AuthShell, AuthField, AuthError, AuthSubmitButton, AUTH_INPUT } from '@/components/admin/auth/AuthShell';
import { ADMIN_BTN_GHOST } from '@/components/admin/common/adminTokens';
import { Input } from '@/components/ui/input';
import { setupSuperAdmin } from '@/lib/api/admin';
import { Lock, Mail, User, ArrowRight, CheckCircle2 } from 'lucide-react';

export default function SetupSuperAdminPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullname, setFullname] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const DEFAULT_CREDENTIALS = {
    email: 'admin@cinesphere.com',
    password: 'admin123',
    fullname: 'Siêu quản trị'
  };

  const useDefaults = () => {
    setEmail(DEFAULT_CREDENTIALS.email);
    setPassword(DEFAULT_CREDENTIALS.password);
    setFullname(DEFAULT_CREDENTIALS.fullname);
  };

  async function handleSetup(e?: React.FormEvent) {
    e?.preventDefault();
    try {
      setLoading(true);
      setError('');

      const data = await setupSuperAdmin({ email, password, fullname });

      if (data.status === 'success') {
        setSuccess(true);
        setTimeout(() => window.location.reload(), 2000);
      } else {
        setError(data.message || 'Thiết lập thất bại');
      }
    } catch (err: any) {
      setError(err?.message || 'Lỗi kết nối server');
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <AuthShell badge="Khởi tạo siêu quản trị" title="Thiết lập thành công!" description="Đang chuẩn bị phiên làm việc và chuyển hướng...">
        <div className="flex justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50 text-emerald-600">
            <CheckCircle2 className="h-8 w-8" />
          </div>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      badge="Khởi tạo siêu quản trị"
      title="Khởi tạo quản trị viên"
      description="Cấu hình tài khoản siêu quản trị đầu tiên"
    >
      <form onSubmit={handleSetup} className="space-y-4">
        <AuthField label="Email quản trị" icon={Mail}>
          <Input
            type="email"
            placeholder="admin@cinesphere.com"
            className={AUTH_INPUT}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </AuthField>

        <AuthField label="Họ và tên" icon={User}>
          <Input
            type="text"
            placeholder="Siêu quản trị"
            className={AUTH_INPUT}
            value={fullname}
            onChange={(e) => setFullname(e.target.value)}
            required
          />
        </AuthField>

        <AuthField label="Mật khẩu" icon={Lock}>
          <Input
            type="password"
            placeholder="••••••••"
            className={AUTH_INPUT}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </AuthField>

        <AuthError message={error} />

        <AuthSubmitButton loading={loading} busyText="Đang thiết lập...">
          <span>Khởi tạo & kích hoạt</span>
          <ArrowRight className="h-4 w-4" />
        </AuthSubmitButton>

        <button type="button" onClick={useDefaults} className={`${ADMIN_BTN_GHOST} w-full`}>
          Dùng thông tin mặc định
        </button>
      </form>
    </AuthShell>
  );
}

