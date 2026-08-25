import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { setupSuperAdmin } from '@/lib/api/admin';
import iconCine from '@/assets/images/iconCine.svg';
import { Lock, Mail, User, AlertCircle, Loader2, ArrowRight, Sparkles, CheckCircle2 } from 'lucide-react';

export default function SetupSuperAdminPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullname, setFullname] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const DEFAULT_CREDENTIALS = {
    email: 'superadmin@cinesphere.com',
    password: 'superadmin123',
    fullname: 'Super Admin'
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
      <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl">
          <div className="h-14 w-14 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center justify-center mx-auto mb-4 text-emerald-400">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Thiết lập thành công!</h2>
          <p className="text-xs text-slate-400">Đang chuẩn bị phiên làm việc và chuyển hướng...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 relative overflow-hidden px-4 py-8 select-none">
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px] opacity-40 pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        <div className="flex flex-col items-center text-center mb-8">
          <div className="relative mb-3 group">
            <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl blur-md opacity-70 group-hover:opacity-100 transition duration-500" />
            <div className="relative h-16 w-16 bg-slate-900 rounded-2xl border border-slate-700/80 flex items-center justify-center shadow-xl p-3">
              <img src={iconCine} alt="CineSphere" className="h-full w-full object-contain" />
            </div>
          </div>
          <h1 className="text-xl font-black tracking-widest text-white uppercase">CINESPHERE</h1>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 mt-1.5 rounded-full bg-slate-900/90 border border-slate-800 text-[10px] font-bold tracking-wider text-purple-400 uppercase">
            <Sparkles className="w-3 h-3" />
            Khởi tạo Super Admin
          </div>
        </div>

        <div className="bg-slate-900/80 backdrop-blur-2xl border border-slate-800/90 rounded-3xl p-6 sm:p-8 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.7)]">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white">Khởi tạo quản trị viên</h2>
              <p className="text-xs text-slate-400 mt-1">Cấu hình tài khoản Super Admin đầu tiên</p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={useDefaults}
              className="text-[11px] h-8 bg-slate-800/60 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800"
            >
              Mặc định
            </Button>
          </div>

          <form onSubmit={handleSetup} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-300">Email quản trị</Label>
              <div className="relative group">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-400 transition-colors">
                  <Mail className="h-4 w-4" />
                </div>
                <Input
                  type="email"
                  placeholder="superadmin@cinesphere.com"
                  className="bg-slate-950/70 border-slate-800/90 rounded-xl pl-10 pr-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-300">Họ và tên</Label>
              <div className="relative group">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-400 transition-colors">
                  <User className="h-4 w-4" />
                </div>
                <Input
                  type="text"
                  placeholder="Super Admin"
                  className="bg-slate-950/70 border-slate-800/90 rounded-xl pl-10 pr-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                  value={fullname}
                  onChange={(e) => setFullname(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-300">Mật khẩu</Label>
              <div className="relative group">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-400 transition-colors">
                  <Lock className="h-4 w-4" />
                </div>
                <Input
                  type="password"
                  placeholder="••••••••"
                  className="bg-slate-950/70 border-slate-800/90 rounded-xl pl-10 pr-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2.5 bg-rose-500/10 border border-rose-500/25 p-3 rounded-xl text-rose-400 text-xs animate-in fade-in-50 duration-200">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <Button
              disabled={loading}
              type="submit"
              className="w-full mt-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-2.5 h-11 rounded-xl shadow-lg shadow-blue-600/25 hover:shadow-blue-600/40 transition-all duration-300 flex items-center justify-center gap-2 group cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Đang thiết lập...</span>
                </>
              ) : (
                <>
                  <span>Khởi tạo & Kích hoạt</span>
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
