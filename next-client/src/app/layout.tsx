import type { Metadata } from 'next';
import './globals.css';
import Providers from '@/app/providers';
import Header from '@/components/user/Header';
import Footer from '@/components/user/Footer';

export const runtime = 'edge';

export const metadata: Metadata = {
        title: {
                default: 'Cinesphere | Trải Nghiệm Điện Ảnh Đỉnh Cao',
                template: '%s | Cinesphere',
        },
        description:
                'Đặt vé xem phim trực tuyến tại Cinesphere. Khám phá các siêu phẩm bom tấn với công nghệ chiếu rạp hiện đại nhất.',
        metadataBase: new URL('https://cinesphere.com.vn'),
        openGraph: {
                siteName: 'Cinesphere',
                type: 'website',
        },
};

export default function RootLayout({
        children,
}: {
        children: React.ReactNode;
}) {
        return (
                <html lang="vi">
                        <body className="bg-[#050915] text-white">
                                <Providers>
                                        <Header />
                                        {children}
                                        <Footer />
                                </Providers>
                        </body>
                </html>
        );
}
