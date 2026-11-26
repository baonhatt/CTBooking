import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Which API and site address the build talks to. Cloudflare Pages sets CF_PAGES_BRANCH when it builds from git:
// the "preview" branch builds preview.cinesphere.com.vn, which must use the preview API and database, never the live
// ones. Every other production build is the live site. (wrangler.toml [env.preview] vars do not reach the build.)
const isPreviewBuild = process.env.CF_PAGES_BRANCH === 'preview';
const LIVE_URLS = { api: 'https://api.cinesphere.com.vn', site: 'https://cinesphere.com.vn' };
const PREVIEW_URLS = { api: 'https://api-preview.cinesphere.com.vn', site: 'https://preview.cinesphere.com.vn' };
const deployedUrls = isPreviewBuild ? PREVIEW_URLS : LIVE_URLS;

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Cloudflare Pages không hỗ trợ Next.js Image Optimization
    // Dùng <img> thuần hoặc set unoptimized
    unoptimized: true,
    remotePatterns: [
      { protocol: 'https', hostname: 'res.cloudinary.com' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'cinesphere.com.vn' }
    ]
  },
  webpack: (config) => {
    config.resolve.alias['@shared'] = path.resolve(__dirname, '../shared');
    return config;
  },
  env: {
    NEXT_PUBLIC_API_URL:
      process.env.NODE_ENV === 'production'
        ? deployedUrls.api
        : process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787',
    NEXT_PUBLIC_SERVER_BASE_URL:
      process.env.NODE_ENV === 'production'
        ? deployedUrls.api
        : process.env.NEXT_PUBLIC_SERVER_BASE_URL || 'http://localhost:8787',
    NEXT_PUBLIC_CLIENT_BASE_URL:
      process.env.NODE_ENV === 'production'
        ? deployedUrls.site
        : process.env.NEXT_PUBLIC_CLIENT_BASE_URL || 'http://localhost:3000'
  },
  async rewrites() {
    if (process.env.NODE_ENV === 'production') {
      return [];
    }
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:8787/api/:path*'
      }
    ];
  }
};

export default nextConfig;
