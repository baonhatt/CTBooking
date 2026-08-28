import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Providers from '@/app/providers';
import NextTopLoader from 'nextjs-toploader';

const inter = Inter({
  subsets: ['latin', 'vietnamese'],
  display: 'swap'
});

import { siteConfig } from '@/config/site';

const SITE_URL = siteConfig.domain;

export const metadata: Metadata = {
  title: {
    default: 'Cinesphere | Trải Nghiệm Điện Ảnh Đỉnh Cao',
    template: '%s | Cinesphere'
  },
  description:
    'Đặt vé xem phim trực tuyến tại Cinesphere. Khám phá các siêu phẩm bom tấn với công nghệ chiếu rạp hiện đại nhất.',
  metadataBase: new URL(SITE_URL),
  icons: {
    icon: '/icon.svg',
    apple: '/logo.svg'
  },
  keywords: [
    'đặt vé xem phim',
    'rạp chiếu phim',
    'cinesphere',
    'vé xem phim trực tuyến',
    'phim mới 2025',
    'phim bom tấn',
    'đặt vé nhanh'
  ],
  alternates: { canonical: '/' },
  openGraph: {
    siteName: 'Cinesphere',
    type: 'website',
    locale: 'vi_VN',
    url: SITE_URL,
    images: [
      {
        url: '/og-default.jpg',
        width: 1200,
        height: 630,
        alt: 'Cinesphere - Trải Nghiệm Điện Ảnh Đỉnh Cao'
      }
    ]
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Cinesphere | Trải Nghiệm Điện Ảnh Đỉnh Cao',
    description:
      'Đặt vé xem phim trực tuyến tại Cinesphere. Khám phá các siêu phẩm bom tấn với công nghệ chiếu rạp hiện đại nhất.',
    images: ['/og-default.jpg']
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1
    }
  }
};

const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Cinesphere',
  url: SITE_URL,
  logo: `${SITE_URL}/logo.svg`,
  contactPoint: {
    '@type': 'ContactPoint',
    telephone: '+84-036-643-1179',
    contactType: 'customer service',
    availableLanguage: 'Vietnamese'
  }
};

const websiteSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'Cinesphere',
  url: SITE_URL,
  potentialAction: {
    '@type': 'SearchAction',
    target: {
      '@type': 'EntryPoint',
      urlTemplate: `${SITE_URL}/bai-viet?q={search_term_string}`
    },
    'query-input': 'required name=search_term_string'
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body className={`${inter.className} bg-[#050915] text-white`}>
        <NextTopLoader color="#22d3ee" height={3} showSpinner={false} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }} />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
