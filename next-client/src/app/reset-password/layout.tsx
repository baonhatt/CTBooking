import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Đặt Lại Mật Khẩu',
  robots: { index: false, follow: false }
};

export default function ResetPasswordLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
