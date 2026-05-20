import { Suspense } from 'react';
import type { Metadata } from 'next';
import HeroSection from '@/components/user/home/HeroSection';
import FilmCarousel from '@/components/user/home/FilmCarousel';
import PromotionShowcase from '@/components/user/home/PromotionShowcase';
import TechnologyBanner from '@/components/user/home/TechnologyBanner';
import ProductSection from '@/components/user/home/ProductSection';
import ClearStorageOnMount from '@/components/user/home/ClearStorageOnMount';

import { getActiveMoviesToday } from '@/lib/api/movies';
import { getSiteMediaApi } from '@/lib/api/uploads';
import { getActiveTickets, getActiveToys } from '@/lib/api/products';

const SITE_URL = 'https://cinephere.com.vn';

export const metadata: Metadata = {
        title: 'Cinesphere | Trải Nghiệm Điện Ảnh Đỉnh Cao',
        description:
                'Đặt vé xem phim trực tuyến tại Cinesphere. Khám phá các siêu phẩm bom tấn với công nghệ chiếu rạp hiện đại nhất.',
        alternates: { canonical: SITE_URL },
        openGraph: {
                title: 'Cinesphere | Trải Nghiệm Điện Ảnh Đỉnh Cao',
                description:
                        'Đặt vé xem phim trực tuyến nhanh chóng, tiện lợi. Hệ thống rạp chiếu phim hiện đại với âm thanh hình ảnh sống động.',
                type: 'website',
                url: SITE_URL,
                locale: 'vi_VN',
                siteName: 'Cinesphere',
                images: [
                        {
                                url: '/og-default.jpg',
                                width: 1200,
                                height: 630,
                                alt: 'Cinesphere - Trải Nghiệm Điện Ảnh Đỉnh Cao',
                        },
                ],
        },
        twitter: {
                card: 'summary_large_image',
                title: 'Cinesphere | Trải Nghiệm Điện Ảnh Đỉnh Cao',
                description:
                        'Đặt vé xem phim trực tuyến nhanh chóng, tiện lợi. Hệ thống rạp chiếu phim hiện đại với âm thanh hình ảnh sống động.',
                images: ['/og-default.jpg'],
        },
};

export const revalidate = 600; // 10 minutes default revalidation

export default async function Home() {
        // Fetch all initial data in parallel
        const [activeMovies, siteMediaRes, ticketsRes, toysRes] = await Promise.all([
                getActiveMoviesToday().catch(() => []),
                getSiteMediaApi({ active: true }).catch(() => ({ items: [] })),
                getActiveTickets().catch(() => ({ items: [] })),
                getActiveToys().catch(() => ({ items: [] }))
        ]);

        const items = siteMediaRes.items || [];

        // Hero section media
        const heroMedia = items.find((i: any) => i.section === 'hero_section' && i.type === 'video');

        // Tech section media
        const techMainItem = items.find((i: any) => i.section === 'technology_section1' && i.type === 'video');
        const techListItems = items.filter((i: any) => i.section === 'technology_section2' && i.type === 'video');

        return (
                <main>
                        <ClearStorageOnMount />
                        <HeroSection initialMovies={activeMovies} heroMedia={heroMedia} />

                        <Suspense fallback={<div className="min-h-[200px]" />}>
                                {/* Pass initial data to the interactive Client Components */}
                                <FilmCarousel initialFilms={activeMovies} />
                                <PromotionShowcase initialCombos={ticketsRes.items || []} />
                                <TechnologyBanner initialMainItem={techMainItem} initialListItems={techListItems} />
                                <ProductSection initialProducts={toysRes.items || []} />
                        </Suspense>
                </main>
        );
}
