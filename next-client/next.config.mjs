import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
        ? 'https://api.cinesphere.com.vn'
        : process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787',
    NEXT_PUBLIC_SERVER_BASE_URL:
      process.env.NODE_ENV === 'production'
        ? 'https://api.cinesphere.com.vn'
        : process.env.NEXT_PUBLIC_SERVER_BASE_URL || 'http://localhost:8787',
    NEXT_PUBLIC_CLIENT_BASE_URL:
      process.env.NODE_ENV === 'production'
        ? 'https://cinesphere.com.vn'
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
