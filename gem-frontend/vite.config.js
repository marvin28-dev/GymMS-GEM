import process from 'node:process'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// What the page may load and where it may send requests (D-45). It is written
// into the built page because the API's address is only known when the app
// is built (VITE_API_URL); photos come from the photo store (VITE_PHOTO_HOST,
// Cloudinary's unless set), and are fetched from it too (an ID scan's Download). What a meta tag cannot carry (frame-ancestors,
// HSTS and the other headers) is in vercel.json. Inline styles stay allowed:
// components and print windows carry their own <style> blocks.
export function contentPolicy(apiUrl, photoHost = 'https://res.cloudinary.com') {
  const originOf = (url) => { try { return new URL(url).origin; } catch { return ''; } };
  const api = originOf(apiUrl);
  const photos = originOf(photoHost);
  return [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    `img-src 'self' data: blob:${photos ? ` ${photos}` : ''}`,
    `connect-src 'self'${api ? ` ${api}` : ''}${photos ? ` ${photos}` : ''}`,
    "media-src 'self' blob:",
    // The walkthrough video's player (components/ui/DemoVideo.jsx)
    'frame-src https://www.youtube.com',
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ')
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const apiUrl = env.VITE_API_URL || 'http://localhost:5000/api'
  return {
    plugins: [
      react(),
      {
        name: 'gem-content-policy',
        apply: 'build',
        transformIndexHtml: () => [{
          tag: 'meta',
          attrs: { 'http-equiv': 'Content-Security-Policy', content: contentPolicy(apiUrl, env.VITE_PHOTO_HOST || undefined) },
          injectTo: 'head-prepend',
        }],
      },
    ],
  }
})
