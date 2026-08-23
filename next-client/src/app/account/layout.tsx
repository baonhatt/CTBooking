import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Tài Khoản',
<<<<<<< HEAD
  robots: { index: false, follow: false },
=======
  robots: { index: false, follow: false }
>>>>>>> preview
};

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
