import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Thanh Toán QR',
<<<<<<< HEAD
  robots: { index: false, follow: false },
=======
  robots: { index: false, follow: false }
>>>>>>> preview
};

export default function QrPaymentLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
