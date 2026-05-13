import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2022',
    cssMinify: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('react-router')) return 'vendor-router'
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/')) return 'vendor-react'
          if (id.includes('swiper')) return 'vendor-swiper'
          if (id.includes('remark') || id.includes('micromark') || id.includes('markdown')) return 'vendor-md'
        },
      },
    },
  },
  server: {
    allowedHosts: true,
    proxy: {
      '/public': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/auth': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/me': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/admin/': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/models': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/kie-photo-prices': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})