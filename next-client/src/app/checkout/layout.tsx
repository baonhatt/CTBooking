import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Xác Nhận Thanh Toán',
<<<<<<< HEAD
  robots: { index: false, follow: false },
=======
  robots: { index: false, follow: false }
>>>>>>> preview
};

export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
