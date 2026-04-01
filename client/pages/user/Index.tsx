import { useEffect, lazy, Suspense } from 'react';
import HeroSection from '@/components/user/HeroSection';
const FilmCarousel = lazy(() => import('@/components/user/FilmCarousel'));
const PromotionShowcase = lazy(() => import('@/components/user/PromotionShowcase'));
const ProductSection = lazy(() => import('@/components/user/ProductSection'));
const TechnologyBanner = lazy(() => import('@/components/user/TechnologyBanner'));
import UserLayout from '@/user/layouts/UserLayout';
import { ConfigProvider } from 'antd';
import { useNavigate } from 'react-router-dom';

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
