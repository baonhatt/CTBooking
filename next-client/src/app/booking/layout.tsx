import type { Metadata } from 'next';

import { siteConfig } from '@/config/site';

const SITE_URL = siteConfig.domain;

export const metadata: Metadata = {
<<<<<<< HEAD
        title: 'Đặt Vé Xem Phim Trực Tuyến',
        description:
                'Đặt vé xem phim nhanh chóng tại Cinesphere. Chọn phim, chọn loại vé, thanh toán online an toàn. Nhận vé ngay trong vài giây.',
        alternates: { canonical: `${SITE_URL}/booking` },
        openGraph: {
                title: 'Đặt Vé Xem Phim | Cinesphere',
                description:
                        'Đặt vé xem phim nhanh chóng tại Cinesphere. Chọn phim, chọn loại vé, thanh toán online an toàn.',
                type: 'website',
                url: `${SITE_URL}/booking`,
                locale: 'vi_VN',
                siteName: 'Cinesphere',
                images: [{ url: '/og-default.jpg', width: 1200, height: 630, alt: 'Cinesphere - Đặt vé xem phim' }],
        },
        twitter: {
                card: 'summary_large_image',
                title: 'Đặt Vé Xem Phim | Cinesphere',
                description: 'Đặt vé xem phim nhanh chóng tại Cinesphere. Thanh toán online an toàn.',
                images: ['/og-default.jpg'],
        },
};

export default function BookingLayout({ children }: { children: React.ReactNode }) {
        return <>{children}</>;
=======
  title: 'Đặt Vé Xem Phim Trực Tuyến',
  description:
    'Đặt vé xem phim nhanh chóng tại Cinesphere. Chọn phim, chọn loại vé, thanh toán online an toàn. Nhận vé ngay trong vài giây.',
  alternates: { canonical: `${SITE_URL}/booking` },
  openGraph: {
    title: 'Đặt Vé Xem Phim | Cinesphere',
    description: 'Đặt vé xem phim nhanh chóng tại Cinesphere. Chọn phim, chọn loại vé, thanh toán online an toàn.',
    type: 'website',
    url: `${SITE_URL}/booking`,
    locale: 'vi_VN',
    siteName: 'Cinesphere',
    images: [{ url: '/og-default.jpg', width: 1200, height: 630, alt: 'Cinesphere - Đặt vé xem phim' }]
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Đặt Vé Xem Phim | Cinesphere',
    description: 'Đặt vé xem phim nhanh chóng tại Cinesphere. Thanh toán online an toàn.',
    images: ['/og-default.jpg']
  }
};

export default function BookingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
>>>>>>> preview
}
