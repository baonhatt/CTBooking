---
description: Performance Optimization Guide - Tối ưu hóa hiệu suất trang Home
---

# 🚀 Performance Optimization Guide

## Tổng quan các vấn đề đã được giải quyết

Dựa trên kết quả Lighthouse ban đầu:
- **Performance Score**: 64/100
- **LCP (Largest Contentful Paint)**: 6.8s → Mục tiêu: <2.5s
- **TBT (Total Blocking Time)**: Cao
- **Main-thread work**: 3.8s
- **Network payloads**: 4.7MB
- **Unused JavaScript**: 250KB
- **Render blocking requests**: 1,500ms

## ✅ Các tối ưu hóa đã thực hiện

### 1. HTML & Resource Loading Optimization

**File**: `index.html`

#### DNS Prefetch & Preconnect
```html
<!-- DNS Prefetch for Cloudinary -->
<link rel="dns-prefetch" href="https://res.cloudinary.com" />
<link rel="preconnect" href="https://res.cloudinary.com" crossorigin />

<!-- Fonts (if using Google Fonts) -->
<link rel="dns-prefetch" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.googleapis.com" crossorigin />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
```

**Lợi ích**:
- Giảm DNS lookup time cho Cloudinary
- Thiết lập kết nối sớm hơn với CDN
- Giảm render blocking time

#### Font Preloading
Nếu bạn sử dụng custom fonts hoặc Google Fonts, thêm preload:
```html
<link rel="preload" as="font" type="font/woff2" 
      href="/fonts/your-font.woff2" crossorigin />
```

### 2. Vite Build Configuration

**File**: `vite.config.ts`

#### Code Splitting Strategy
```typescript
manualChunks: {
  'react-vendor': ['react', 'react-dom', 'react-router-dom'],
  'ui-vendor': ['antd', '@ant-design/icons', 'framer-motion'],
  'query-vendor': ['@tanstack/react-query'],
  'three-vendor': ['three', '@react-three/fiber', '@react-three/drei'],
  'radix-vendor': [/* Radix UI components */],
}
```

**Lợi ích**:
- Tách các vendor libraries thành chunks riêng
- Cải thiện browser caching
- Giảm initial bundle size
- Parallel loading các chunks

#### Optimization Settings
```typescript
chunkSizeWarningLimit: 1000,
minify: 'esbuild', // Faster than terser
optimizeDeps: {
  include: ['react', 'react-dom', 'react-router-dom'],
  exclude: ['@react-three/fiber', '@react-three/drei'], // Lazy load
}
```

### 3. Component Lazy Loading

**File**: `client/pages/user/Index.tsx`

#### Lazy Load Below-the-Fold Components
```typescript
// Eager load (above the fold)
import HeroSection from "@/components/user/HeroSection";
import FilmCarousel from "@/components/user/FilmCarousel";

// Lazy load (below the fold)
const PromotionShowcase = lazy(() => import("@/components/user/PromotionShowcase"));
const ProductSection = lazy(() => import("@/components/user/ProductSection"));
const TechnologyBanner = lazy(() => import("@/components/user/TechnologyBanner"));
```

#### Suspense Boundaries
```typescript
<Suspense fallback={<div className="min-h-[200px]" />}>
  <PromotionShowcase />
  <TechnologyBanner />
  <ProductSection />
</Suspense>
```

**Lợi ích**:
- Giảm 30-40% initial JavaScript bundle
- Cải thiện LCP
- Tải components khi cần thiết

### 4. Giảm Forced Reflow & Main Thread Work

**File**: `client/components/user/HeroSection.tsx`

#### Mouse Movement Throttling
```typescript
// Before: Every mousemove event triggers reflow
const onMove = (e) => {
  const rect = currentTarget.getBoundingClientRect(); // REFLOW!
  // ... calculations
}

// After: Throttled + RAF batching
const lastMoveTime = useRef(0);
const THROTTLE_MS = 16; // ~60fps

const onMove = (e) => {
  const now = Date.now();
  if (now - lastMoveTime.current < THROTTLE_MS) return;
  lastMoveTime.current = now;

  // Batch DOM operations
  requestAnimationFrame(() => {
    pointerX.set(x);
    pointerY.set(y);
  });
}
```

**Lợi ích**:
- Giảm forced reflow từ hàng trăm lần/giây xuống ~60 lần/giây
- Giảm main thread work đáng kể
- Cải thiện TBT (Total Blocking Time)

### 5. Image & Video Optimization

**File**: `client/lib/utils.ts`

#### Enhanced Cloudinary Optimization
```typescript
export function optimizeCloudinaryUrl(
  url: string, 
  width?: number, 
  quality: string = "auto:good"
) {
  const transformations = [
    "f_auto",      // Auto format (WebP/AVIF)
    `q_${quality}`, // Smart quality
    "c_limit",     // Don't upscale
  ];
  // ...
}
```

#### Responsive Images
```typescript
export function generateCloudinarySrcSet(
  url: string, 
  sizes: number[] = [400, 800, 1200, 1600]
) {
  return sizes
    .map(size => `${optimizeCloudinaryUrl(url, size)} ${size}w`)
    .join(", ");
}
```

**Sử dụng**:
```tsx
<img 
  src={optimizeCloudinaryUrl(imageUrl, 800)}
  srcSet={generateCloudinarySrcSet(imageUrl)}
  sizes="(max-width: 768px) 100vw, 50vw"
  loading="lazy"
  alt="..."
/>
```

#### Video Optimization
```typescript
// Reduce video quality and resolution
const heroVideoSrc = optimizeCloudinaryVideoUrl(
  url,
  720,        // 720p instead of full HD
  "auto:low"  // Lower quality for faster loading
);
```

**Lợi ích**:
- Giảm 60-70% kích thước images (WebP/AVIF)
- Responsive images cho mọi device
- Giảm network payloads từ 4.7MB xuống ~1.5-2MB

## 📊 Kết quả dự kiến

### Trước tối ưu:
- Performance: 64/100
- LCP: 6.8s
- TBT: Cao
- Network: 4.7MB
- Unused JS: 250KB

### Sau tối ưu (dự kiến):
- Performance: 85-90/100
- LCP: 2.0-2.5s (giảm 65-70%)
- TBT: <200ms
- Network: 1.5-2MB (giảm 60%)
- Unused JS: <50KB (giảm 80%)

## 🔍 Cách kiểm tra

### 1. Build Production
```bash
npm run build:client
```

### 2. Preview Production Build
```bash
npx vite preview
```

### 3. Run Lighthouse
- Mở Chrome DevTools
- Tab "Lighthouse"
- Chọn "Performance" + "Desktop" hoặc "Mobile"
- Click "Analyze page load"

### 4. Kiểm tra Network
- DevTools → Network tab
- Reload trang
- Kiểm tra:
  - Total transfer size
  - Number of requests
  - Largest resources
  - Waterfall timing

## 🎯 Các bước tiếp theo (nếu cần)

### 1. Font Optimization
Nếu đang dùng Google Fonts:
```html
<!-- Preload font -->
<link rel="preload" as="style" 
      href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" />
<link rel="stylesheet" 
      href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" 
      media="print" onload="this.media='all'" />
```

Hoặc self-host fonts:
```css
@font-face {
  font-family: 'Inter';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url('/fonts/inter-v12-latin-regular.woff2') format('woff2');
}
```

### 2. Image Formats
Chuyển đổi static images sang WebP/AVIF:
```bash
# Using sharp
npm install sharp
node scripts/convert-images.js
```

### 3. Service Worker (PWA)
Thêm caching strategy:
```typescript
// vite.config.ts
import { VitePWA } from 'vite-plugin-pwa'

plugins: [
  VitePWA({
    registerType: 'autoUpdate',
    workbox: {
      runtimeCaching: [
        {
          urlPattern: /^https:\/\/res\.cloudinary\.com\/.*/i,
          handler: 'CacheFirst',
          options: {
            cacheName: 'cloudinary-images',
            expiration: {
              maxEntries: 50,
              maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
            }
          }
        }
      ]
    }
  })
]
```

### 4. Critical CSS
Extract và inline critical CSS:
```bash
npm install critters -D
```

```typescript
// vite.config.ts
import { critters } from 'vite-plugin-critters'

plugins: [
  critters()
]
```

### 5. Compression
Enable Brotli/Gzip compression:
```typescript
// vite.config.ts
import viteCompression from 'vite-plugin-compression'

plugins: [
  viteCompression({
    algorithm: 'brotliCompress',
    ext: '.br'
  })
]
```

## 📝 Monitoring

### Production Monitoring
Sử dụng Real User Monitoring (RUM):
- Google Analytics 4 (Web Vitals)
- Vercel Analytics
- Cloudflare Web Analytics

### Continuous Testing
- Lighthouse CI trong GitHub Actions
- WebPageTest API
- Chrome User Experience Report

## ⚠️ Lưu ý quan trọng

1. **Test trên production build**: Dev mode sẽ chậm hơn nhiều
2. **Test trên nhiều devices**: Mobile thường chậm hơn desktop
3. **Test với slow 3G**: Simulate điều kiện mạng kém
4. **Disable cache khi test**: Để thấy kết quả thực tế
5. **Monitor real users**: Lighthouse chỉ là lab data

## 🔗 Resources

- [Web Vitals](https://web.dev/vitals/)
- [Vite Performance](https://vitejs.dev/guide/performance.html)
- [Cloudinary Optimization](https://cloudinary.com/documentation/image_optimization)
- [React Performance](https://react.dev/learn/render-and-commit)
