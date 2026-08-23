import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Thanh Toán Thành Công',
<<<<<<< HEAD
  robots: { index: false, follow: false },
=======
  robots: { index: false, follow: false }
>>>>>>> preview
};

export default function SuccessPaymentLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
