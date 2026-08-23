import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Đặt Lại Mật Khẩu',
<<<<<<< HEAD
  robots: { index: false, follow: false },
=======
  robots: { index: false, follow: false }
>>>>>>> preview
};

export default function ResetPasswordLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
