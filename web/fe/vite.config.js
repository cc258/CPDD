import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5183,
    proxy: {
      '/api': {
        target: process.env.API_TARGET || 'http://localhost:8010',
        changeOrigin: true,
        ws: true,
      },
    },
  },
})
