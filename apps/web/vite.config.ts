import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import Pages from 'vite-plugin-pages'

const resolveHost = () => {
  const raw = process.env.WEB_DEV_HOST
  if (!raw) return '0.0.0.0'
  if (raw === 'true') return true
  return raw
}

export default defineConfig({
  plugins: [react(), Pages()],
  server: {
    host: resolveHost(),
    port: 15200,
    proxy: {
      '/api': {
        target: 'http://localhost:15201',
        changeOrigin: true,
      },
    },
  },
})
