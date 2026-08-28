import { Suspense } from 'react';
export const runtime = 'edge';
import type { Metadata } from 'next';
import UserLayout from '@/layouts/UserLayout';
import HeroSection from '@/components/user/home/HeroSection';
import FilmCarousel from '@/components/user/home/FilmCarousel';
import VRShowcase from '@/components/user/home/VRShowcase';
import PromotionShowcase from '@/components/user/home/PromotionShowcase';
import TechnologyBanner from '@/components/user/home/TechnologyBanner';
import ProductSection from '@/components/user/home/ProductSection';
import ClearStorageOnMount from '@/components/user/home/ClearStorageOnMount';

import { getActiveMoviesToday } from '@/lib/api/movies';
import { getSiteMediaApi } from '@/lib/api/uploads';
import { getActiveTickets, getActiveToys } from '@/lib/api/products';
import { getVRPackages } from '@/lib/api/vr-packages';
import { getDefaultBranch, getPublicBranches } from '@/lib/api/branches';

import { siteConfig } from '@/config/site';

const SITE_URL = siteConfig.domain;

export const metadata: Metadata = {
  title: 'Cinesphere | Trải Nghiệm Điện Ảnh & VR Đỉnh Cao',
  description:
    'Đặt vé xem phim & trải nghiệm thực tế ảo VR 8K/9D trực tuyến tại Cinesphere. Khám phá các siêu phẩm bom tấn với công nghệ chiếu rạp hiện đại nhất.',
  alternates: { canonical: SITE_URL },
  openGraph: {
    title: 'Cinesphere | Trải Nghiệm Điện Ảnh & VR Đỉnh Cao',
    description:
      'Đặt vé xem phim trực tuyến nhanh chóng, tiện lợi. Hệ thống rạp chiếu phim hiện đại với âm thanh hình ảnh sống động và phòng chơi VR 8K/9D siêu thực.',
    type: 'website',
    url: SITE_URL,
    locale: 'vi_VN',
    siteName: 'Cinesphere',
    images: [
      {
        url: '/og-default.jpg',
        width: 1200,
        height: 630,
        alt: 'Cinesphere - Trải Nghiệm Điện Ảnh & VR Đỉnh Cao'
      }
    ]
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Cinesphere | Trải Nghiệm Điện Ảnh & VR Đỉnh Cao',
    description:
      'Đặt vé xem phim trực tuyến nhanh chóng, tiện lợi. Hệ thống rạp chiếu phim hiện đại với âm thanh hình ảnh sống động và phòng chơi VR 8K/9D siêu thực.',
    images: ['/og-default.jpg']
  }
};

// ISR: trang chủ cache 5 phút, sau đó revalidate từ server
export const revalidate = 300;

export default async function Home({ searchParams }: { searchParams: { branch_id?: string } }) {
  // Fetch default branch for server-side rendering
  let effectiveBranchId: number | undefined = undefined;
  try {
    const [{ branch: defaultBranch }, { items: publicBranches }] = await Promise.all([
      getDefaultBranch(),
      getPublicBranches()
    ]);

    if (searchParams.branch_id) {
      effectiveBranchId = Number(searchParams.branch_id);
    } else if (defaultBranch) {
      effectiveBranchId = defaultBranch.id;
    } else if (publicBranches && publicBranches.length > 0) {
      // Fallback to the first available open branch if no default or URL param
      effectiveBranchId = publicBranches[0].id;
    }
  } catch (error) {
    console.error('Error fetching branches for home page:', error);
  }

  // Fetch all initial data in parallel with branch filter
  const [activeMovies, siteMediaRes, ticketsRes, toysRes, vrRes] = await Promise.all([
    getActiveMoviesToday(effectiveBranchId).catch(() => []),
    getSiteMediaApi({ active: true }).catch(() => ({ items: [] })),
    getActiveTickets(effectiveBranchId).catch(() => ({ items: [] })),
    getActiveToys().catch(() => ({ items: [] })),
    getVRPackages(effectiveBranchId).catch(() => ({ items: [] }))
  ]);

  const items = siteMediaRes.items || [];

  // Hero section media
  const heroMedia = items.find((i: any) => i.section === 'hero_section' && i.type === 'video');

  // Tech section media
  const techMainItem = items.find((i: any) => i.section === 'technology_section1' && i.type === 'video');
  const techListItems = items.filter((i: any) => i.section === 'technology_section2' && i.type === 'video');

  return (
    <UserLayout>
      <main>
        <ClearStorageOnMount />
        <HeroSection initialMovies={activeMovies} heroMedia={heroMedia} />

        <Suspense fallback={<div className="min-h-[200px]" />}>
          {/* Pass initial data to the interactive Client Components */}
          <FilmCarousel initialFilms={activeMovies} />
          <VRShowcase initialPackages={vrRes.items || []} />
          <PromotionShowcase initialCombos={ticketsRes.items || []} />
          <TechnologyBanner initialMainItem={techMainItem} initialListItems={techListItems} />
          <ProductSection initialProducts={toysRes.items || []} />
        </Suspense>
      </main>
    </UserLayout>
  );
}
