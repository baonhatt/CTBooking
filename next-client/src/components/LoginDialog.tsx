'use client';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PASSWORD_PATTERN } from '@/components/constants';
import { useRouter } from 'next/navigation';
import { OTPDialog } from './OTPDialog';

interface LoginDialogProps {
        isOpen: boolean;
        onOpenChange: (open: boolean) => void;
        onRegister: () => void;
        onForgetPassword: () => void;
        auth: any;
        setUserName: (name: string) => void;
        setErrorModal: (modal: { open: boolean; title: string; message: string }) => void;
}

export function LoginDialog({
        isOpen,
        onOpenChange,
        onRegister,
        onForgetPassword,
        auth,
        setUserName,
        setErrorModal
}: LoginDialogProps) {
        const [isLoading, setIsLoading] = useState(false);
        const [email, setEmail] = useState('');
        const [password, setPassword] = useState('');
        const [emailError, setEmailError] = useState('');
        const [passwordError, setPasswordError] = useState('');
        const [submitError, setSubmitError] = useState('');
        const [showPassword, setShowPassword] = useState(false);
        const [isEmailFocused, setIsEmailFocused] = useState(false);
        const [isPasswordFocused, setIsPasswordFocused] = useState(false);

        // OTP states
        const [showOTPDialog, setShowOTPDialog] = useState(false);
        const [tempAccountId, setTempAccountId] = useState<number | null>(null);
        const [otpEmail, setOtpEmail] = useState('');

        const router = useRouter();

        // Ensure all states are clean when the dialog opens or closes
        useEffect(() => {
                if (isOpen) {
                        setIsEmailFocused(false);
                        setIsPasswordFocused(false);
                        setEmail('');
                        setPassword('');
                        setEmailError('');
                        setPasswordError('');
                        setSubmitError('');
                        setShowPassword(false);
                        setShowOTPDialog(false);
                        setTempAccountId(null);
                        setOtpEmail('');
                }
        }, [isOpen]);

        const handleOpenChange = (open: boolean) => {
                if (!open) {
                        setIsEmailFocused(false);
                        setIsPasswordFocused(false);
                }
                onOpenChange(open);
        };

        const handleSubmit = async (e: React.FormEvent) => {
                e.preventDefault();
                setEmailError('');
                setPasswordError('');
                setSubmitError('');

                // Validate email
                const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
                if (!emailOk) {
                        setEmailError('Vui lòng nhập email hợp lệ');
                        return;
                }

                // Validate password
                const passOk = PASSWORD_PATTERN.test(password);
                if (!passOk) {
                        setPasswordError('Mật khẩu ít nhất 6 ký tự gồm chữ và số');
                        return;
                }

                try {
                        setIsLoading(true);
                        const data = await auth.login(email, password);

                        if (data?.requires_otp) {
                                // Show OTP dialog
                                setTempAccountId(data.temp_account_id);
                                setOtpEmail(data.email);
                                setShowOTPDialog(true);
                                setIsLoading(false);
                                return;
                        }

                        if (data?.status === 'success') {
                                // Token được lưu trong httpOnly cookie bởi backend
                                // Không cần lưu vào localStorage nữa

                                try {
                                        const derivedName = data.user.username || (data.user.email || '').split('@')[0];
                                        const profile = {
                                                email: data.user.email,
                                                name: derivedName,
                                                phone: (data.user as any)?.phone || ''
                                        };
                                        localStorage.setItem('userProfile', JSON.stringify(profile));
                                } catch {
                                } finally {
                                        router.push('/');
                                }
                                setUserName(data.user.username);
                                window.dispatchEvent(new Event('user-auth-changed'));
                                toast.success('Đăng nhập thành công', { description: data.user.email });

                                onOpenChange(false);
                                setEmail('');
                                setPassword('');
                        } else {
                                const msg = data?.message || 'Đăng nhập thất bại';
                                if (msg.toLowerCase().includes('email')) {
                                        setEmailError(msg);
                                } else if (msg.toLowerCase().includes('mật khẩu') || msg.toLowerCase().includes('password')) {
                                        setPasswordError(msg);
                                }
                                setSubmitError(msg);
                        }
                } catch (err: any) {
                        const msg = String(err?.message || 'Đăng nhập thất bại');
                        if (msg.toLowerCase().includes('email')) {
                                setEmailError(msg);
                        } else if (msg.toLowerCase().includes('mật khẩu') || msg.toLowerCase().includes('password')) setSubmitError(msg);
                        toast.error(msg);
                } finally {
                        setIsLoading(false);
                }
        };

        return (
                <>
                        <Dialog open={isOpen} onOpenChange={handleOpenChange}>
                                <DialogContent className="bg-gradient-to-br z-[9999] from-[#0b1226] via-[#0e1b3d] to-[#050915] border border-cyan-500/30 text-white shadow-[0_0_50px_rgba(59,130,246,0.3)]">
                                        <DialogHeader>
                                                <div className="flex justify-center mb-4">
                                                        <img src="/icon.svg" alt="CINESPHERE" className="h-20 w-20" />
                                                </div>
                                                <DialogTitle className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-blue-400 to-fuchsia-400 text-center">
                                                        Đăng Nhập Tài Khoản
                                                </DialogTitle>
                                                <DialogDescription className="sr-only">
                                                        Đăng nhập vào tài khoản CTBooking của bạn để tiếp tục đặt vé.
                                                </DialogDescription>
                                        </DialogHeader>

                                        <form
                                                key={isOpen ? 'login-dialog-active' : 'login-dialog-inactive'}
                                                className="space-y-4"
                                                onSubmit={handleSubmit}
                                        >
                                                {/* Decoy inputs to trap Chrome's initial autofill attempt */}
                                                <input type="text" name="email" style={{ display: 'none' }} tabIndex={-1} aria-hidden="true" />
                                                <input type="password" name="password" style={{ display: 'none' }} tabIndex={-1} aria-hidden="true" />
                                                {/* Email Input */}
                                                <div>
                                                        <label className="text-sm text-gray-300 mb-1 block">Email</label>
                                                        <Input
                                                                type="email"
                                                                className={cn(
                                                                        'bg-white/10 border-white/20 text-white placeholder:text-gray-400 focus-visible:ring-cyan-400 focus-visible:ring-offset-1 rounded-lg',
                                                                        emailError && 'border-yellow-500 focus-visible:ring-yellow-500'
                                                                )}
                                                                value={email}
                                                                onChange={(e) => {
                                                                        const val = e.target.value;
                                                                        setEmail(val);
                                                                        const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
                                                                        if (ok) setEmailError('');
                                                                        else if (val.length > 0) setEmailError('Vui lòng nhập email hợp lệ');
                                                                        if (submitError) setSubmitError('');
                                                                }}
                                                                maxLength={50}
                                                                autoComplete={isEmailFocused ? 'email' : 'new-password'}
                                                                onFocus={() => setIsEmailFocused(true)}
                                                                readOnly={!isEmailFocused}
                                                                disabled={isLoading}
                                                                required
                                                        />
                                                        {emailError && (
                                                                <div className="mt-1 rounded-md bg-yellow-500/10 px-3 py-2 text-xs text-yellow-300">{emailError}</div>
                                                        )}
                                                </div>

                                                {/* Password Input */}
                                                <div>
                                                        <label className="text-sm text-gray-300 mb-1 block">Mật khẩu</label>
                                                        <div className="relative">
                                                                <Input
                                                                        type={showPassword ? 'text' : 'password'}
                                                                        className={cn(
                                                                                'bg-white/10 border-white/20 text-white placeholder:text-gray-400 focus-visible:ring-cyan-400 focus-visible:ring-offset-1 rounded-lg pr-10',
                                                                                passwordError && 'border-yellow-500 focus-visible:ring-yellow-500'
                                                                        )}
                                                                        value={password}
                                                                        onChange={(e) => {
                                                                                const val = e.target.value;
                                                                                setPassword(val);
                                                                                const ok = PASSWORD_PATTERN.test(val);
                                                                                if (ok) setPasswordError('');
                                                                                else if (val.length > 0) setPasswordError('Mật khẩu ít nhất 6 ký tự gồm chữ và số');
                                                                                if (submitError) setSubmitError('');
                                                                        }}
                                                                        maxLength={50}
                                                                        autoComplete={isPasswordFocused ? 'current-password' : 'new-password'}
                                                                        onFocus={() => setIsPasswordFocused(true)}
                                                                        readOnly={!isPasswordFocused}
                                                                        disabled={isLoading}
                                                                        required
                                                                />
                                                                <button
                                                                        type="button"
                                                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                                                                        onClick={() => setShowPassword((v) => !v)}
                                                                        aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiển thị mật khẩu'}
                                                                >
                                                                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                                                </button>
                                                        </div>
                                                        {passwordError && (
                                                                <div className="mt-1 rounded-md bg-yellow-500/10 px-3 py-2 text-xs text-yellow-300">{passwordError}</div>
                                                        )}
                                                </div>

                                                {/* Submit Button */}
                                                <Button
                                                        type="submit"
                                                        disabled={isLoading}
                                                        className="w-full bg-gradient-to-r from-cyan-400 via-blue-600 to-fuchsia-500 hover:from-fuchsia-500 hover:via-cyan-400 hover:to-blue-600 text-white font-semibold shadow-[0_0_30px_rgba(59,130,246,0.4)] hover:shadow-[0_0_40px_rgba(236,72,153,0.6)]"
                                                >
                                                        {isLoading ? (
                                                                <span className="flex items-center justify-center gap-2">
                                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                                        Đang đăng nhập...
                                                                </span>
                                                        ) : (
                                                                'ĐĂNG NHẬP'
                                                        )}
                                                </Button>

                                                {/* Forget Password Link */}
                                                <div className="flex justify-between items-center">
                                                        <div></div>
                                                        <Button
                                                                variant="link"
                                                                className="text-sm text-cyan-300 hover:text-cyan-200"
                                                                type="button"
                                                                onClick={onForgetPassword}
                                                        >
                                                                Quên mật khẩu?
                                                        </Button>
                                                </div>

                                                {/* Register Link */}
                                                <div className="flex justify-center mt-4">
                                                        <Button
                                                                variant="link"
                                                                className="text-sm text-cyan-300 hover:text-cyan-200 pt-6"
                                                                type="button"
                                                                onClick={onRegister}
                                                        >
                                                                Bạn chưa có tài khoản? Đăng ký
                                                        </Button>
                                                </div>
                                        </form>
                                </DialogContent>
                        </Dialog>

                        {/* OTP Dialog */}
                        {tempAccountId && (
                                <OTPDialog
                                        isOpen={showOTPDialog}
                                        onOpenChange={(open) => {
                                                setShowOTPDialog(open);
                                                if (!open) {
                                                        setTempAccountId(null);
                                                        setOtpEmail('');
                                                }
                                        }}
                                        tempAccountId={tempAccountId}
                                        email={otpEmail}
                                        onSuccess={(userData, token) => {
                                                try {
                                                        const derivedName = userData.username || (userData.email || '').split('@')[0];
                                                        const profile = {
                                                                email: userData.email,
                                                                name: derivedName,
                                                                phone: userData.phone || ''
                                                        };
                                                        localStorage.setItem('userProfile', JSON.stringify(profile));
                                                } catch {
                                                } finally {
                                                        router.push('/');
                                                }
                                                setUserName(userData.username);
                                                window.dispatchEvent(new Event('user-auth-changed'));
                                                toast.success('Đăng nhập thành công', { description: userData.email });
                                                onOpenChange(false);
                                                setEmail('');
                                                setPassword('');
                                        }}
                                        auth={auth}
                                />
                        )}
                </>
        );
}
