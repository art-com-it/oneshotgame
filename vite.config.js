import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  experimental: { enableNativePlugin: false },
  plugins: [tailwindcss()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  root: '.',
  publicDir: 'public',
  server: {
    host: '0.0.0.0',
    port: 5174,
    allowedHosts: ['oneshotgame.shop', 'localhost', '127.0.0.1'],
    proxy: {
      '/auth': { target: 'http://localhost:3001', changeOrigin: true, secure: false },
      '/products': { target: 'http://localhost:3001', changeOrigin: true, secure: false },
      '/bot': { target: 'http://localhost:3001', changeOrigin: true, secure: false },
    },
  },
})
