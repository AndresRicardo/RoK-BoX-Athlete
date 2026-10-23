import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// Vite normaliza los ids de módulo con "/" también en Windows.
const EXPORT_LIBS = /node_modules\/(jspdf|jspdf-autotable|write-excel-file|html2canvas|dompurify|canvg|fflate)\//;

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'favicon.svg', 'apple-touch-icon.png', 'pwa-192x192.png', 'pwa-512x512.png'],
      manifest: {
        name: 'RöK BoX Athlete',
        short_name: 'RöK BoX',
        description: 'PWA de entrenamiento, récords, membresías y comunidad para atletas de RöK BoX',
        theme_color: '#0A0A0C',
        background_color: '#0A0A0C',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        // Las librerías de exportación (PDF/Excel) solo las usan los socios: se descargan al exportar.
        globIgnores: ['**/export-*.js'],
        // Avisos push (public/push-sw.js).
        importScripts: ['push-sw.js'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        // Los chunks de las librerías de exportación llevan el prefijo export- (ver globIgnores).
        chunkFileNames: (chunk) => (
          chunk.moduleIds.some((id) => EXPORT_LIBS.test(id))
            ? 'assets/export-[name]-[hash].js'
            : 'assets/[name]-[hash].js'
        ),
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-charts': ['recharts'],
          'vendor-icons': ['lucide-react'],
          'vendor-supabase': ['@supabase/supabase-js'],
        },
      },
    },
  },
  server: {
    host: true,
    port: 5173,
  },
});
