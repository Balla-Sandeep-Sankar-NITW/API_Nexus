import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // Dev-only convenience: proxy /api to a local backend so the app works
  // out of the box without CORS setup. Point it elsewhere with
  // VITE_DEV_PROXY_TARGET in .env. Unused once VITE_API_BASE_URL is set to
  // a full URL, since requests then go straight to that URL instead of /api.
  const proxyTarget = env.VITE_DEV_PROXY_TARGET || 'http://127.0.0.1:8000'

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
        },
      },
    },
  }
})
