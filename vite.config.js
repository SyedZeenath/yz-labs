import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        // 127.0.0.1, not "localhost" — on Windows/Node "localhost" can
        // resolve to IPv6 ::1 first while the Express server is on IPv4,
        // which surfaces as intermittent ECONNREFUSED proxy errors.
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
      },
    },
  },
})
