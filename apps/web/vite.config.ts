import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import Pages from 'vite-plugin-pages'

export default defineConfig({
  plugins: [react(), Pages()],
  server: {
    host: '0.0.0.0',
    port: 15200,
    proxy: {
      '/api': {
        target: 'http://localhost:15201',
        changeOrigin: true,
      },
    },
  },
})
