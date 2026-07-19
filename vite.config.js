import { defineConfig } from 'vite'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// __dirname equivalent for ES modules. Used to resolve absolute paths
// for Vite's root / publicDir / outDir so the build is stable regardless
// of where npm is invoked from.
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// v1.10.6 — audit L20: read `data/port.txt` when it exists so the dev
// proxy tracks whatever port Express landed on (Express drifts off the
// default when EADDRINUSE bumps it to 47372, 47373, …). Falls back to
// the historical 47371 default if the file's missing.
const readActivePort = () => {
  try {
    const p = path.join(__dirname, 'data', 'port.txt');
    if (!fs.existsSync(p)) return 47371;
    const n = parseInt(fs.readFileSync(p, 'utf-8').trim(), 10);
    return (isFinite(n) && n >= 1024 && n <= 65535) ? n : 47371;
  } catch { return 47371; }
};
const activeExpressPort = readActivePort();

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
      // v1.10.33 — Kept 'prompt' but bumped skipWaiting → true below.
      // Reported: "it work in incognito only" — user's tab had a stale
      // SW serving a broken hash-mismatched bundle after a redeploy,
      // so main.jsx never loaded and the tab stayed blank. skipWaiting
      // makes new SWs activate immediately on install (no more 24-hour
      // wait for the old SW to release), and the runtime cache below
      // gets `cleanupOutdatedCaches: true` so orphaned assets from a
      // previous version don't shadow the new ones.
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
            // v1.10.6 — audit L16: SVG at fixed `sizes:96x96` confused
            // Windows jumplist. `any` lets the OS render at whatever
            // size it wants (SVG is scalable).
            icons: [{ src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml' }],
          },
          {
            name: 'Dashboard',
            short_name: 'Dashboard',
            description: 'See invoices and stats',
            url: '/?view=dashboard',
            // v1.10.6 — audit L16: SVG at fixed `sizes:96x96` confused
            // Windows jumplist. `any` lets the OS render at whatever
            // size it wants (SVG is scalable).
            icons: [{ src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml' }],
          },
          {
            name: 'GST Returns',
            short_name: 'GST Returns',
            description: 'GSTR-1 / 3B / 2B reconciliation',
            url: '/?view=filing',
            // v1.10.6 — audit L16: SVG at fixed `sizes:96x96` confused
            // Windows jumplist. `any` lets the OS render at whatever
            // size it wants (SVG is scalable).
            icons: [{ src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml' }],
          },
          {
            name: 'Settings',
            short_name: 'Settings',
            description: 'Business profile, accounts, modules',
            url: '/?view=settings',
            // v1.10.6 — audit L16: SVG at fixed `sizes:96x96` confused
            // Windows jumplist. `any` lets the OS render at whatever
            // size it wants (SVG is scalable).
            icons: [{ src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml' }],
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
          // v1.10.33 — Tesseract worker + core + traineddata (~22MB total).
          // Excluded from precache — cached on demand by the runtime rule
          // below so the initial SW install stays ~1MB, and the OCR
          // dependency is downloaded once when the user actually opens
          // the OCR modal.
          '**/tesseract/**',
        ],
        // v1.10.33 — allow the 3.9MB traineddata and 3.3MB wasm cores to
        // enter the runtime cache. Workbox's default 2MB cap would
        // silently skip them and offline-second-use OCR would break.
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        // v1.10.33 — Was `false` on both. Kept the prompt-mode reload
        // deferral in main.jsx but flipped these to true because:
        //   1. skipWaiting=true lets the new SW take over on install
        //      without waiting for every open tab to close first. Prior
        //      value stalled the SW in `waiting` until the user closed
        //      every browser tab and reopened the app — meanwhile the
        //      OLD SW served the OLD bundle whose file hashes no longer
        //      matched what index.html referenced → white screen.
        //   2. clientsClaim=true means any currently-open tab starts
        //      talking to the new SW immediately after activation.
        //      Combined with cleanupOutdatedCaches below, orphaned
        //      chunks from the previous deploy get evicted.
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
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
          // v1.10.33 — OCR assets. CacheFirst so second-time OCR is
          // instant and works offline once the user has opened the
          // modal once online. maxAgeSeconds is a year — these files
          // are versioned in-place by scripts/bundle-tesseract-assets.mjs
          // and don't change without a redeploy.
          {
            urlPattern: /\/tesseract\/.*\.(?:js|wasm|traineddata)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'tesseract-cache',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
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
      // v1.10.6 — audit L20: was hardcoded 47371. Now reads
      // `data/port.txt` at Vite start (see `activeExpressPort` at top
      // of file). Restart Vite if the server rebooted onto a new port.
      '/api': {
        target: `http://localhost:${activeExpressPort}`,
        changeOrigin: true,
      }
    }
  }
})
