import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const { VITE_API_URL = 'http://localhost:5000/api' } = loadEnv(mode, process.cwd())
  const apiOrigin = /^https?:\/\//i.test(VITE_API_URL) ? new URL(VITE_API_URL).origin : ''
  const policy = [
    "default-src 'self'",
    "base-uri 'none'",
    "object-src 'none'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${apiOrigin} https://res.cloudinary.com`,
    `connect-src 'self' ${apiOrigin} https://api.emailjs.com`,
    'frame-src https://www.google.com',
    "form-action 'self'",
  ].join('; ')

  return {
    plugins: [
      react(),
      {
        name: 'gears-content-security-policy',
        apply: 'build',
        transformIndexHtml() {
          return [{
            tag: 'meta',
            attrs: { 'http-equiv': 'Content-Security-Policy', content: policy },
            injectTo: 'head-prepend',
          }]
        },
      },
    ],
  }
})
