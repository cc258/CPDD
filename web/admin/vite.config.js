import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  // 生产环境走 /admin 子路径，本地开发用根路径
  base: process.env.NODE_ENV === 'production' ? '/admin/' : '/',
  plugins: [react(), tailwindcss()],
  server: {
    port: 5184,
    proxy: {
      '/api': {
        target: process.env.API_TARGET || 'http://localhost:8010',
        changeOrigin: true,
      },
    },
  },
})
