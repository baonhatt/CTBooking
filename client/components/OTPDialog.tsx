import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Loader2, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import icon from '@/assets/images/icon.svg';

interface OTPDialogProps {
        isOpen: boolean;
        onOpenChange: (open: boolean) => void;
        tempAccountId: number;
        email: string;
        onSuccess: (userData: any, token: string) => void;
        auth: any;
}

export function OTPDialog({
        isOpen,
        onOpenChange,
        tempAccountId,
        email,
        onSuccess,
        auth
}: OTPDialogProps) {
        const [otp, setOtp] = useState(['', '', '', '', '', '']);
        const [isLoading, setIsLoading] = useState(false);
        const [isResending, setIsResending] = useState(false);
        const [error, setError] = useState('');
        const [timeLeft, setTimeLeft] = useState(300); // 5 minutes
        const [canResend, setCanResend] = useState(false);
        const [resendCooldown, setResendCooldown] = useState(30);

        const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

        // Reset state when dialog opens
        useEffect(() => {
                if (isOpen) {
                        setOtp(['', '', '', '', '', '']);
                        setError('');
                        setTimeLeft(300);
                        setCanResend(false);
                        setResendCooldown(30);
                        // Focus first input
                        setTimeout(() => {
                                inputRefs.current[0]?.focus();
                        }, 100);
                }
        }, [isOpen]);

        // Countdown timer for OTP expiry
        useEffect(() => {
                if (!isOpen || timeLeft <= 0) return;

                const timer = setInterval(() => {
                        setTimeLeft((prev) => {
                                if (prev <= 1) {
                                        clearInterval(timer);
                                        return 0;
                                }
                                return prev - 1;
                        });
                }, 1000);

                return () => clearInterval(timer);
        }, [isOpen, timeLeft]);

        // Resend cooldown timer
        useEffect(() => {
                if (!isOpen || resendCooldown <= 0) {
                        if (resendCooldown <= 0) setCanResend(true);
                        return;
                }

                const timer = setInterval(() => {
                        setResendCooldown((prev) => {
                                if (prev <= 1) {
                                        clearInterval(timer);
                                        setCanResend(true);
                                        return 0;
                                }
                                return prev - 1;
                        });
                }, 1000);

                return () => clearInterval(timer);
        }, [isOpen, resendCooldown]);

        const handleOtpChange = (index: number, value: string) => {
                if (value.length > 1) {
                        value = value[0];
                }

                if (!/^\d*$/.test(value)) {
                        return;
                }

                const newOtp = [...otp];
                newOtp[index] = value;
                setOtp(newOtp);
                setError('');

                // Auto-focus next input
                if (value && index < 5) {
                        inputRefs.current[index + 1]?.focus();
                }
        };

        const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
                if (e.key === 'Backspace' && !otp[index] && index > 0) {
                        inputRefs.current[index - 1]?.focus();
                }
        };

        const handlePaste = (e: React.ClipboardEvent) => {
                e.preventDefault();
                const pastedData = e.clipboardData.getData('text').slice(0, 6);
                if (!/^\d+$/.test(pastedData)) return;

                const newOtp = [...otp];
                for (let i = 0; i < pastedData.length; i++) {
                        newOtp[i] = pastedData[i];
                }
                setOtp(newOtp);

                // Focus the next empty input or the last filled one
                const nextEmptyIndex = newOtp.findIndex((val) => val === '');
                if (nextEmptyIndex !== -1) {
                        inputRefs.current[nextEmptyIndex]?.focus();
                } else {
                        inputRefs.current[5]?.focus();
                }
        };

        const handleSubmit = async (e: React.FormEvent) => {
                e.preventDefault();
                const otpValue = otp.join('');

                if (otpValue.length !== 6) {
                        setError('Vui lòng nhập đầy đủ 6 số OTP');
                        return;
                }

                try {
                        setIsLoading(true);
                        setError('');

                        const response = await fetch('/api/validate-otp', {
                                method: 'POST',
                                headers: {
                                        'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({
                                        temp_account_id: tempAccountId,
                                        otp: otpValue
                                })
                        });

                        const data = await response.json();

                        if (data.status === 'success' || data.status === 200) {
                                toast.success('Xác thực OTP thành công!');
                                onSuccess(data.user, data.token);
                                onOpenChange(false);
                        } else {
                                setError(data.message || 'OTP không hợp lệ');
                                setOtp(['', '', '', '', '', '']);
                                inputRefs.current[0]?.focus();
                        }
                } catch (err: any) {
                        setError('Có lỗi xảy ra. Vui lòng thử lại.');
                        console.error('OTP validation error:', err);
                } finally {
                        setIsLoading(false);
                }
        };

        const handleResend = async () => {
                if (!canResend) return;

                try {
                        setIsResending(true);
                        setError('');

                        const response = await fetch('/api/resend-otp', {
                                method: 'POST',
                                headers: {
                                        'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({
                                        temp_account_id: tempAccountId,
                                        email: email
                                })
                        });

                        const data = await response.json();

                        if (data.status === 'success' || data.status === 200) {
                                toast.success('OTP mới đã được gửi đến email của bạn');
                                setTimeLeft(300);
                                setCanResend(false);
                                setResendCooldown(30);
                                setOtp(['', '', '', '', '', '']);
                                inputRefs.current[0]?.focus();
                        } else {
                                setError(data.message || 'Không thể gửi lại OTP');
                        }
                } catch (err: any) {
                        setError('Có lỗi xảy ra. Vui lòng thử lại.');
                        console.error('Resend OTP error:', err);
                } finally {
                        setIsResending(false);
                }
        };

        const formatTime = (seconds: number) => {
                const mins = Math.floor(seconds / 60);
                const secs = seconds % 60;
                return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        };

        return (
                <Dialog open={isOpen} onOpenChange={onOpenChange}>
                        <DialogContent className="bg-gradient-to-br z-[10000] from-[#0b1226] via-[#0e1b3d] to-[#050915] border border-cyan-500/30 text-white shadow-[0_0_50px_rgba(59,130,246,0.3)]">
                                <DialogHeader>
                                        <div className="flex justify-center mb-4">
                                                <img src={icon} alt="CINESPHERE" className="h-16 w-16" />
                                        </div>
                                        <DialogTitle className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-blue-400 to-fuchsia-400 text-center text-xl">
                                                Xác Thực 2 Lớp
                                        </DialogTitle>
                                        <DialogDescription className="text-gray-300 text-center mt-2">
                                                Mã OTP đã được gửi đến <strong>{email}</strong>
                                        </DialogDescription>
                                </DialogHeader>

                                <form onSubmit={handleSubmit} className="space-y-6">
                                        {/* Timer */}
                                        <div className="text-center">
                                                <div className={cn(
                                                        'text-2xl font-mono font-bold',
                                                        timeLeft <= 60 ? 'text-red-400' : 'text-cyan-400'
                                                )}>
                                                        {formatTime(timeLeft)}
                                                </div>
                                                <div className="text-xs text-gray-400 mt-1">
                                                        {timeLeft <= 60 ? 'OTP sắp hết hạn' : 'OTP hết hạn sau'}
                                                </div>
                                        </div>

                                        {/* OTP Input */}
                                        <div className="flex justify-center gap-2">
                                                {otp.map((digit, index) => (
                                                        <Input
                                                                key={index}
                                                                ref={(el) => {
                                                                        inputRefs.current[index] = el;
                                                                }}
                                                                type="text"
                                                                inputMode="numeric"
                                                                maxLength={1}
                                                                value={digit}
                                                                onChange={(e) => handleOtpChange(index, e.target.value)}
                                                                onKeyDown={(e) => handleKeyDown(index, e)}
                                                                onPaste={handlePaste}
                                                                className={cn(
                                                                        'w-12 h-14 text-center text-2xl font-bold bg-white/10 border-white/20 text-white focus-visible:ring-cyan-400 focus-visible:ring-offset-1 rounded-lg',
                                                                        error && 'border-red-500 focus-visible:ring-red-500'
                                                                )}
                                                                disabled={isLoading || timeLeft === 0}
                                                                autoComplete="one-time-code"
                                                        />
                                                ))}
                                        </div>

                                        {error && (
                                                <div className="rounded-md bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-300 text-center">
                                                        {error}
                                                </div>
                                        )}

                                        {/* Submit Button */}
                                        <Button
                                                type="submit"
                                                disabled={isLoading || timeLeft === 0 || otp.join('').length !== 6}
                                                className="w-full bg-gradient-to-r from-cyan-400 via-blue-600 to-fuchsia-500 hover:from-fuchsia-500 hover:via-cyan-400 hover:to-blue-600 text-white font-semibold shadow-[0_0_30px_rgba(59,130,246,0.4)] hover:shadow-[0_0_40px_rgba(236,72,153,0.6)]"
                                        >
                                                {isLoading ? (
                                                        <span className="flex items-center justify-center gap-2">
                                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                                Đang xác thực...
                                                        </span>
                                                ) : (
                                                        'XÁC THỰC'
                                                )}
                                        </Button>

                                        {/* Resend Button */}
                                        <div className="text-center">
                                                <Button
                                                        type="button"
                                                        variant="link"
                                                        onClick={handleResend}
                                                        disabled={!canResend || isResending}
                                                        className={cn(
                                                                'text-sm text-cyan-300 hover:text-cyan-200',
                                                                !canResend && 'text-gray-500 cursor-not-allowed'
                                                        )}
                                                >
                                                        {isResending ? (
                                                                <span className="flex items-center gap-2">
                                                                        <Loader2 className="h-3 w-3 animate-spin" />
                                                                        Đang gửi...
                                                                </span>
                                                        ) : canResend ? (
                                                                'Gửi lại OTP'
                                                        ) : (
                                                                `Gửi lại sau ${resendCooldown}s`
                                                        )}
                                                        {!canResend && <RefreshCw className="h-3 w-3 ml-1" />}
                                                </Button>
                                        </div>

                                        {/* Cancel Button */}
                                        <div className="text-center">
                                                <Button
                                                        type="button"
                                                        variant="ghost"
                                                        onClick={() => onOpenChange(false)}
                                                        className="text-sm text-gray-400 hover:text-white"
                                                >
                                                        Hủy bỏ
                                                </Button>
                                        </div>
                                </form>
                        </DialogContent>
                </Dialog>
        );
}
