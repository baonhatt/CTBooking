import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { setupSuperAdmin } from '@/lib/api/admin';

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
                fullname: 'Super Admin',
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
                } catch (err) {
                        setError('Lỗi kết nối server');
                } finally {
                        setLoading(false);
                }
        }

        if (success) {
                return (
                        <div className="min-h-screen flex items-center justify-center bg-background">
                                <Card className="w-full max-w-sm bg-white">
                                        <CardHeader>
                                                <CardTitle>Thiết lập thành công</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                                <p>Đang chuyển hướng...</p>
                                        </CardContent>
                                </Card>
                        </div>
                );
        }

        return (
                <div className="min-h-screen flex items-center justify-center bg-background">
                        <Card className="w-full max-w-sm bg-white">
                                <CardHeader>
                                        <CardTitle>Thiết lập Super Admin</CardTitle>
                                </CardHeader>
                                <CardContent>
                                        <div className="space-y-3">
                                                <form onSubmit={handleSetup}>
                                                        <div>
                                                                <Label>Email</Label>
                                                                <Input
                                                                        className="text-black"
                                                                        value={email}
                                                                        onChange={(e) => setEmail(e.target.value)}
                                                                        required
                                                                />
                                                        </div>
                                                        <div>
                                                                <Label>Họ tên</Label>
                                                                <Input
                                                                        className="text-black"
                                                                        value={fullname}
                                                                        onChange={(e) => setFullname(e.target.value)}
                                                                        required
                                                                />
                                                        </div>
                                                        <div>
                                                                <Label>Mật khẩu</Label>
                                                                <Input
                                                                        type="password"
                                                                        className="text-black"
                                                                        value={password}
                                                                        onChange={(e) => setPassword(e.target.value)}
                                                                        required
                                                                />
                                                        </div>
                                                        {error && <div className="text-red-500 text-sm">{error}</div>}
                                                        <div className="flex justify-end">
                                                                <Button type="button" variant="outline" onClick={useDefaults} className="mr-2">
                                                                        Sử dụng mặc định
                                                                </Button>
                                                                <Button disabled={loading} type="submit">
                                                                        {loading ? 'Đang thiết lập...' : 'Thiết lập'}
                                                                </Button>
                                                        </div>
                                                </form>
                                        </div>
                                </CardContent>
                        </Card>
                </div>
        );
}
