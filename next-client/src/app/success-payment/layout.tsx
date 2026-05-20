import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Thanh Toán Thành Công',
  robots: { index: false, follow: false },
};

export default function SuccessPaymentLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
