import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Bảo Trì Hệ Thống',
<<<<<<< HEAD
  robots: { index: false, follow: false },
=======
  robots: { index: false, follow: false }
>>>>>>> preview
};

export default function MaintenanceLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
