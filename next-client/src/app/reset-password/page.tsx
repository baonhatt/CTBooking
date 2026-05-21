'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { resetPasswordApi } from '@/lib/api/auth';

export default function ConfirmToken() {
        const [newPassword, setNewPassword] = useState('');
        const [confirmPassword, setConfirmPassword] = useState('');
        const [errorMessage, setErrorMessage] = useState('');
        const searchParams = useSearchParams();
        const token = searchParams.get('token') || '';
        const router = useRouter();

        const validatePassword = (password: string) => {
                const regex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{6,}$/;
                return regex.test(password);
        };

        const handleResetPassSubmit = async (e: React.FormEvent) => {
                e.preventDefault();
                setErrorMessage('');

                if (!validatePassword(newPassword)) {
                        setErrorMessage('Mật khẩu phải có ít nhất 6 ký tự, bao gồm cả chữ cái và số');
                        toast.error('Mật khẩu không hợp lệ', {
                                description: 'Mật khẩu phải có ít nhất 6 ký tự, bao gồm cả chữ cái và số'
                        });
                        return;
                }

                if (newPassword !== confirmPassword) {
                        setErrorMessage('Mật khẩu không khớp');
                        toast.error('Mật khẩu không khớp', {
                                description: 'Vui lòng kiểm tra lại.'
                        });
                        return;
                }

                try {
                        const response = await resetPasswordApi({ token, newPassword });
                        if (response.status === 'success') {
                                toast.success('Thông báo hệ thống!', { description: response.message });
                                router.push('/');
                        }
                } catch (err: any) {
                        const errorMsg = err.message || 'Đã xảy ra lỗi, vui lòng thử lại.';
                        setErrorMessage(errorMsg);
                        toast.error('Lỗi đặt lại mật khẩu', {
                                description: errorMsg
                        });
                }
        };

        return (
                <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-dark">
                        <form className="bg-black/80 p-6 rounded-lg shadow-md space-y-4 w-full max-w-md" onSubmit={handleResetPassSubmit}>
                                <h1 className="text-xl text-blue-400 font-bold text-center">Đặt lại mật khẩu</h1>
                                {errorMessage && (
                                        <div className="bg-red-500/20 border border-red-500 text-red-300 px-4 py-2 rounded-lg text-sm">
                                                {errorMessage}
                                        </div>
                                )}
                                <div>
                                        <label className="text-sm text-gray-300 mb-1 block">Mật khẩu mới</label>
                                        <Input
                                                type="password"
                                                value={newPassword}
                                                onChange={(e) => setNewPassword(e.target.value)}
                                                className="bg-gray-900 !text-white border-gray-700"
                                                required
                                                style={{ color: 'white' }}
                                        />
                                </div>
                                <div>
                                        <label className="text-sm text-gray-300 mb-1 block">Xác nhận mật khẩu mới</label>
                                        <Input
                                                type="password"
                                                value={confirmPassword}
                                                onChange={(e) => setConfirmPassword(e.target.value)}
                                                className="bg-gray-900 !text-white border-gray-700"
                                                required
                                                style={{ color: 'white' }}
                                        />
                                </div>
                                <Button
                                        type="submit"
                                        className="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
                                >
                                        Xác nhận
                                </Button>
                        </form>
                </div>
        );
}
