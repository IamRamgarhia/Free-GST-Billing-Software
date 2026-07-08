import { defineConfig } from 'vite'
import path from 'path'
import { fileURLToPath } from 'url'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// __dirname equivalent for ES modules. Used to resolve absolute paths
// for Vite's root / publicDir / outDir so the build is stable regardless
// of where npm is invoked from.
const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  // Vite source root lives in src/ rather than the project root. Reason:
  // the project root holds the user-facing Launcher (renamed to index.html
  // so users see ONE html file). Keeping Vite's own index.html inside
  // src/ keeps the install folder uncluttered. publicDir + outDir are
  // resolved relative to the project root so existing public/ assets
  // and dist/ output paths keep working.
  root: path.resolve(__dirname, 'src'),
  publicDir: path.resolve(__dirname, 'public'),
  plugins: [
    react(),
    VitePWA({
      // v1.10.2 — Prior 'autoUpdate' triggered an immediate location.reload()
      // via main.jsx's onNeedRefresh handler → cashier mid-invoice would
      // lose form state on deploy. Switched to 'prompt' so the app can
      // defer the reload until the user is idle. The main.jsx handler
      // now stores an "update ready" flag and reloads on next window
      // blur / navigation, never mid-form.
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'og-preview.png'],
      manifest: {
        name: 'Free GST Billing Software',
        short_name: 'GST Billing',
        description: 'Open-source, offline GST invoicing for India and 21 other countries. Tax invoices, GSTR-1 / GSTR-3B / GSTR-2B, TDS / TCS, multi-currency, multi-account payments, recurring billing. Your data stays on your computer. Free forever.',
        theme_color: '#1e40af',
        background_color: '#f8fafc',
        display: 'standalone',
        // display_override gives Edge / Chrome the option to render in a
        // tighter "Window Controls Overlay" mode (the title bar disappears,
        // we draw the chrome ourselves) — falls back to standalone if not
        // supported. Removes the "this is just a browser" feel.
        display_override: ['window-controls-overlay', 'standalone'],
        start_url: '/',
        scope: '/',
        // v1.10.2 — Was 'portrait-primary'. Locked landscape tablets to
        // portrait even though shop counters and Android POS terminals
        // often run horizontally. 'any' lets the device decide.
        orientation: 'any',
        lang: 'en-IN',
        categories: ['business', 'productivity', 'finance'],
        // Manifest shortcuts — right-click the pinned PWA icon (Windows
        // taskbar / Start Menu / Edge app launcher) to jump directly to
        // the most-used flows without a full Dashboard hop.
        shortcuts: [
          {
            name: 'New Invoice',
            short_name: 'New Invoice',
            description: 'Create a new tax invoice',
            url: '/?view=new',
            icons: [{ src: '/favicon.svg', sizes: '96x96' }],
          },
          {
            name: 'Dashboard',
            short_name: 'Dashboard',
            description: 'See invoices and stats',
            url: '/?view=dashboard',
            icons: [{ src: '/favicon.svg', sizes: '96x96' }],
          },
          {
            name: 'GST Returns',
            short_name: 'GST Returns',
            description: 'GSTR-1 / 3B / 2B reconciliation',
            url: '/?view=filing',
            icons: [{ src: '/favicon.svg', sizes: '96x96' }],
          },
          {
            name: 'Settings',
            short_name: 'Settings',
            description: 'Business profile, accounts, modules',
            url: '/?view=settings',
            icons: [{ src: '/favicon.svg', sizes: '96x96' }],
          },
        ],
        // v1.10.2 — Icon set matches Android + iOS "Add to Home Screen"
        // requirements. Prior manifest had ONE entry — favicon.svg with
        // `purpose: 'any maskable'`. Chrome/Android needs distinct 192
        // and 512 PNGs for the app drawer + splash; iOS silently ignores
        // SVG apple-touch-icons and falls back to a generated screenshot.
        //
        // The SVG entry stays as a scalable fallback for browsers that
        // handle it (all modern desktop). The PNG entries point at files
        // that MUST be dropped into public/icons/ — see README.
        icons: [
          { src: '/favicon.svg', sizes: 'any',       type: 'image/svg+xml' },
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // v1.10.2 — Precache excludes the heaviest chunks (pdf 588 KB,
        // qr 25 KB, html2canvas' ESM chunk) since most sessions never
        // print. They still get cached on demand by the runtime rule
        // below (StaleWhileRevalidate for /assets/), so the FIRST print
        // works offline as long as the user has visited that route at
        // least once. Trims initial precache from 1.63 MiB → ~0.85 MiB.
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        globIgnores: [
          '**/assets/pdf-*.js',
          '**/assets/qr-*.js',
          '**/assets/index.es-*.js',
        ],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        // v1.10.2 — Prompt-mode SW: don't auto-take-control until the
        // main.jsx handler decides it's safe. Prior autoUpdate mode had
        // skipWaiting+clientsClaim implicit, and combined with a
        // location.reload() in main.jsx it would blow away mid-invoice
        // form state on every deploy. See main.jsx onNeedRefresh.
        skipWaiting: false,
        clientsClaim: false,
        runtimeCaching: [
          // v1.10.2 — /api/* runtime cache. Missing this rule meant the
          // "offline billing counter" promise was broken: fetch() throws
          // TypeError as soon as the network drops. NetworkFirst means
          // fresh data online, cached-fallback offline. GETs only —
          // POST/DELETE would need a background-sync queue (future).
          {
            urlPattern: ({ url, request }) =>
              request.method === 'GET' && url.pathname.startsWith('/api/'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 3,
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24 * 7, // a week — fresh enough for offline read
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // v1.10.2 — Lazy-loaded JS chunks (pdf, qr, html2canvas ESM)
          // are NOT precached but are cached on first use so the second
          // print offline works.
          {
            urlPattern: /\/assets\/(pdf|qr|index\.es)-[A-Za-z0-9]+\.js$/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'lazy-chunks-cache',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'images-cache',
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
    }),
  ],
  build: {
    // outDir + publicDir point at project-root paths because Vite's
    // `root` is src/ — without absolute resolution the output would
    // land inside src/dist/ instead of the repo's dist/.
    outDir: path.resolve(__dirname, 'dist'),
    emptyOutDir: true,
    // v1.10.2 — main+pdf chunks tripped the default 500 KB warning line
    // on every build (main 812 KB, pdf 588 KB). Bumped to 900 KB — high
    // enough to silence noise, low enough to catch a genuine regression.
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks: {
          // v1.10.2 — React was in the main bundle; every app-code
          // change invalidated the React runtime for cached clients.
          // Now: cache hit on React across releases as long as versions
          // don't move.
          'react-vendor': ['react', 'react-dom'],
          'pdf': ['jspdf', 'html2canvas'],
          'icons': ['lucide-react'],
          'qr': ['qrcode'],
        },
      },
    },
  },
  server: {
    proxy: {
      // Express default port is 47371 (v1.5.2+); was 3001 in earlier versions.
      // Reading data/port.txt would be more robust but requires a file read
      // at Vite config time — this default catches 99% of dev sessions.
      '/api': {
        target: 'http://localhost:47371',
        changeOrigin: true,
      }
    }
  }
})
