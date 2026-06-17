import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { resolve } from 'path'

export default defineConfig({
  // GitHub Pages — adapter selon le nom du repo
  base: '/family-os/',

  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'icons/*.png'],
      manifest: {
        name: 'Family OS',
        short_name: 'FamilyOS',
        description: 'Système de gestion familiale — Local First',
        theme_color: '#6B5B95',
        background_color: '#FFFFFF',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/family-os/',
        start_url: '/family-os/',
        icons: [
          {
            src: 'icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024, // 4 MiB — cercle.png fait 2.3MB
        // Cache-first pour tout (offline-first)
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // B-03 : navigateFallback obligatoire pour iOS standalone et GitHub Pages
        navigateFallback: '/family-os/index.html',
        navigateFallbackDenylist: [/\/api\//],
        runtimeCaching: [
          {
            // Météo — network-first avec fallback
            urlPattern: /^https:\/\/api\.openweathermap\.org\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'weather-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 30, // 30 min
              },
            },
          },
        ],
      },
    }),
  ],

  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@core': resolve(__dirname, './src/core'),
      '@modules': resolve(__dirname, './src/modules'),
      '@shared': resolve(__dirname, './src/shared'),
      '@router': resolve(__dirname, './src/router'),
      '@styles': resolve(__dirname, './src/styles'),
    },
  },

  build: {
    rollupOptions: {
      output: {
        // F-02 : chunks stables pour améliorer le cache navigateur
        manualChunks: {
          'vendor-db':     ['dexie', 'dexie-react-hooks'],
          'vendor-search': ['fuse.js'],
          'vendor-dnd':    ['react-dnd', 'react-dnd-html5-backend', 'react-dnd-touch-backend'],
          'vendor-react':  ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
})
