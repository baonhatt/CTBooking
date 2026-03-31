import { defineConfig, Plugin } from 'vite';
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
  plugins: [react(), expressPlugin()],
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

function expressPlugin(): Plugin {
  return {
    name: 'express-plugin',
    apply: 'serve',
    async configureServer(server) {
      const { createServer } = await import('./server');
      const app = createServer();

      server.middlewares.use(app);
    }
  };
}
