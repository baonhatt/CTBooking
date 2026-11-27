import { Suspense } from 'react';
export const runtime = 'edge';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import UserLayout from '@/layouts/UserLayout';
import HeroSection from '@/components/user/home/HeroSection';
import FilmCarousel from '@/components/user/home/FilmCarousel';
import ClearStorageOnMount from '@/components/user/home/ClearStorageOnMount';
import MobileBookBar from '@/components/user/home/MobileBookBar';

// Static imports: these are client components, so Next already gives each its own chunk. Loading them through
// next/dynamic from this Server Component made the server HTML and the first browser render differ (hydration error).
import MovieScheduleSection from '@/components/user/home/MovieScheduleSection';
import VRShowcase from '@/components/user/home/VRShowcase';
import PromotionShowcase from '@/components/user/home/PromotionShowcase';
import TechnologyBanner from '@/components/user/home/TechnologyBanner';
// TẠM ẨN ĐỒ CHƠI (20261110): khách chưa dùng module đồ chơi nên ẩn khỏi giao diện. API, DB và các file Toys* vẫn giữ nguyên. Tìm "TẠM ẨN ĐỒ CHƠI" để mở lại.
// const ProductSection = dynamic(() => import('@/components/user/home/ProductSection'));

import { getActiveMoviesToday } from '@/lib/api/movies';
import { getSiteMediaApi } from '@/lib/api/uploads';
import { getActiveTickets } from '@/lib/api/products';
// getActiveToys: TẠM ẨN ĐỒ CHƠI (20261110): khách chưa dùng module đồ chơi nên ẩn khỏi giao diện. API, DB và các file Toys* vẫn giữ nguyên. Tìm "TẠM ẨN ĐỒ CHƠI" để mở lại.
// Khi mở lại (20261126): các route công khai /api/toys, /api/toys-active, /api/toys/:id và hàm getActiveToys đã được bỏ vì không ai dùng; cần thêm lại một route chỉ đọc đồ chơi đang bán (cột chọn sẵn) trong publicRouter.
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
    // A missing default branch (404) must not take the open-branch list down with it
    const [defaultBranch, { items: publicBranches }] = await Promise.all([
      getDefaultBranch()
        .then((res) => res.branch)
        .catch(() => null),
      getPublicBranches()
    ]);

    // Same order as the browser's useBranch: the URL, then the branch the visitor chose before (cookie), then the
    // default. Without the cookie step the server drew the default branch while the browser drew the saved one,
    // and the page failed to hydrate.
    const savedBranchId = Number(cookies().get('selected_branch_id')?.value || 0);
    const isOpenBranch = (branchId: number) => (publicBranches || []).some((branch: any) => Number(branch.id) === branchId);
    const savedBranchIsOpen = isOpenBranch(savedBranchId);
    // A branch in the URL counts only when it is an open branch (same check as useBranch in the browser)
    const urlBranchId = Number(searchParams.branch_id || 0);
    if (urlBranchId && isOpenBranch(urlBranchId)) {
      effectiveBranchId = urlBranchId;
    } else if (savedBranchId && savedBranchIsOpen) {
      effectiveBranchId = savedBranchId;
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
  // TẠM ẨN ĐỒ CHƠI (20261110): khách chưa dùng module đồ chơi nên ẩn khỏi giao diện. API, DB và các file Toys* vẫn giữ nguyên. Tìm "TẠM ẨN ĐỒ CHƠI" để mở lại. (bỏ lấy danh sách đồ chơi)
  const [activeMovies, siteMediaRes, ticketsRes, vrRes] = await Promise.all([
    getActiveMoviesToday(effectiveBranchId).catch(() => []),
    getSiteMediaApi({ active: true, branchId: effectiveBranchId }).catch(() => ({ items: [] })),
    getActiveTickets(effectiveBranchId).catch(() => ({ items: [] })),
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
      {/* UserLayout already has the page's <main>; a second <main> inside it is not valid HTML */}
      <div>
        <ClearStorageOnMount />
        <MobileBookBar />
        <HeroSection initialMovies={activeMovies} heroMedia={heroMedia} initialBranchId={effectiveBranchId} />

        <Suspense fallback={<div className="min-h-[200px]" />}>
          {/* Pass initial data to the interactive Client Components */}
          <FilmCarousel initialFilms={activeMovies} initialBranchId={effectiveBranchId} />
          {/* Prices come right after the films, then VR, then the day's schedule */}
          <PromotionShowcase initialCombos={ticketsRes.items || []} initialBranchId={effectiveBranchId} />
          <VRShowcase initialPackages={vrRes.items || []} initialBranchId={effectiveBranchId} />
          <MovieScheduleSection />
          <TechnologyBanner initialMainItem={techMainItem} initialListItems={techListItems} />
          {/* TẠM ẨN ĐỒ CHƠI (20261110): khách chưa dùng module đồ chơi nên ẩn khỏi giao diện. API, DB và các file Toys* vẫn giữ nguyên. Tìm "TẠM ẨN ĐỒ CHƠI" để mở lại. */}
          {/* <ProductSection initialProducts={toysRes.items || []} /> */}
        </Suspense>
      </div>
    </UserLayout>
  );
}
