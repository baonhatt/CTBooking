import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: '::',
    port: 8080,
    fs: {
      allow: ['.', './client', './shared'],
      deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', 'server/**']
    },
    // Proxy API requests to wrangler dev (npm run dev:worker)
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true
      },
      '/uploads': {
        target: 'http://localhost:8787',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'dist/spa',
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'motion-vendor': ['framer-motion'],
          'lucide-vendor': ['lucide-react'],
          'antd-vendor': ['antd', '@ant-design/icons'],
          'query-vendor': ['@tanstack/react-query'],
          'three-vendor': ['three', '@react-three/fiber', '@react-three/drei'],
          'form-vendor': ['react-hook-form', 'zod'],
          'embla-vendor': ['embla-carousel-react'],
          'radix-vendor': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-select',
            '@radix-ui/react-toast',
            '@radix-ui/react-tooltip',
            '@radix-ui/react-slot'
          ],
          'ui-utils': ['clsx', 'tailwind-merge']
        },
        // Optimize chunk file names
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: 'assets/[ext]/[name]-[hash].[ext]'
      }
    },
    // Increase chunk size warning limit (but aim to stay under)
    chunkSizeWarningLimit: 1000,
    // Use esbuild for faster minification (default)
    minify: 'esbuild'
  },
  plugins: [
    react(),
    {
      name: 'local-media-downloader',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          const url = new URL(req.url || '', `http://${req.headers.host}`);
          
          if (url.pathname.startsWith('/uploads/ctbooking/')) {
            const fs = await import('node:fs');
            const path = await import('node:path');
            
            const relativePath = url.pathname.replace(/^\//, '');
            const targetPath = path.resolve(process.cwd(), relativePath);
            
            // 1. Download if missing
            if (!fs.existsSync(targetPath)) {
              console.log(`[Vite Downloader] Missing file: ${url.pathname}`);
              
              const cloudName = 'dzp3rbeix';
              const ext = path.extname(url.pathname).toLowerCase();
              const isVideo = ['.mp4', '.webm', '.mov', '.m4v'].includes(ext);
              const resourceType = isVideo ? 'video' : 'image';
              
              const publicPath = url.pathname.replace('/uploads/', '');
              const cloudinaryUrl = `https://res.cloudinary.com/${cloudName}/${resourceType}/upload/${publicPath}`;
              
              try {
                const targetDir = path.dirname(targetPath);
                if (!fs.existsSync(targetDir)) {
                  fs.mkdirSync(targetDir, { recursive: true });
                }

                const response = await fetch(cloudinaryUrl);
                if (response.ok) {
                  const arrayBuffer = await response.arrayBuffer();
                  const buffer = Buffer.from(arrayBuffer);
                  fs.writeFileSync(targetPath, buffer);
                  console.log(`[Vite Downloader] Saved to: ${targetPath}`);
                }
              } catch (err) {
                console.error(`[Vite Downloader] Error:`, err);
              }
            }

            // 2. Serve the file directly if it exists (either previously or just downloaded)
            if (fs.existsSync(targetPath)) {
              const ext = path.extname(targetPath).toLowerCase();
              const mimeMap: Record<string, string> = {
                '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
                '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
                '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime'
              };
              res.setHeader('Content-Type', mimeMap[ext] || 'application/octet-stream');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.end(fs.readFileSync(targetPath));
              return; // End the request here, don't pass to proxy
            }
          }
          next();
        });
      }
    }
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './client'),
      '@shared': path.resolve(__dirname, './shared')
    }
  },
  // Optimize dependencies
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom', '@tanstack/react-query'],
    exclude: ['@react-three/fiber', '@react-three/drei'] // Lazy load these
  }
}));
