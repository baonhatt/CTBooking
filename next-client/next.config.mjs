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
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:8787/api/:path*'
      }
    ];
  }
};

export default nextConfig;
