import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // ngrok 등 터널 호스트에서 dev 서버 접속 시 Host 검사 통과
    allowedHosts: ['.ngrok-free.dev', '.ngrok.io', '.ngrok.app'],
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
