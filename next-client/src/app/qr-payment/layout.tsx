import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Thanh Toán QR',
  robots: { index: false, follow: false }
};

export default function QrPaymentLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
