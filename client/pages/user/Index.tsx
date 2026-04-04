import { useEffect, lazy, Suspense } from 'react';
import HeroSection from '@/components/user/HeroSection';
const FilmCarousel = lazy(() => import('@/components/user/FilmCarousel'));
const PromotionShowcase = lazy(() => import('@/components/user/PromotionShowcase'));
const ProductSection = lazy(() => import('@/components/user/ProductSection'));
const TechnologyBanner = lazy(() => import('@/components/user/TechnologyBanner'));
import UserLayout from '@/user/layouts/UserLayout';
import { ConfigProvider } from 'antd';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';

export default function Index() {
  const navigate = useNavigate();

  const handleBookClick = () => {
    navigate('/booking');
  };

  useEffect(() => {
    try {
      localStorage.removeItem('pendingOrder');
      localStorage.removeItem('lastCheckoutOrder');
      localStorage.removeItem('lastVnpayBookingId');
    } catch {}
  }, []);

  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#22d3ee',
          colorBgBase: '#0e1b3d',
          colorText: '#ffffff'
        },
        components: {
          DatePicker: {
            colorBgContainer: '#ffffff',
            colorBgElevated: '#ffffff',
            colorText: '#000000',
            colorBorder: '#e5e7eb',
            controlItemBgHover: '#f1f5f9',
            colorTextDisabled: '#94a3b8'
          },
          Steps: {
            colorText: '#ffffff',
            colorTextDescription: '#ffffff'
          }
        }
      }}
    >
      <UserLayout headerProps={{ onBookClick: handleBookClick }} className="bg-gradient-dark">
        <Helmet>
          <title>Cinesphere | Trải Nghiệm Điện Ảnh Đỉnh Cao</title>
          <meta name="description" content="Đặt vé xem phim trực tuyến tại Cinesphere. Khám phá các siêu phẩm bom tấn với công nghệ chiếu rạp hiện đại nhất." />
          <meta property="og:title" content="Cinesphere | Trải Nghiệm Điện Ảnh Đỉnh Cao" />
          <meta property="og:description" content="Đặt vé xem phim trực tuyến nhanh chóng, tiện lợi. Hệ thống rạp chiếu phim hiện đại với âm thanh hình ảnh sống động." />
          <meta property="og:type" content="website" />
        </Helmet>
        <main>
          <HeroSection />
          <Suspense fallback={<div className="min-h-[200px]" />}>
            <FilmCarousel />
            <PromotionShowcase />
            <TechnologyBanner />
            <ProductSection />
          </Suspense>
        </main>
      </UserLayout>
    </ConfigProvider>
  );
}
