import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Bảo Trì Hệ Thống',
  robots: { index: false, follow: false },
};

export default function MaintenanceLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
