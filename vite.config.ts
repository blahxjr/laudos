import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist',
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/service-orders': 'http://localhost:3000',
      '/reports': 'http://localhost:3000',
      '/clients': 'http://localhost:3000',
      '/equipments': 'http://localhost:3000',
      '/ai': 'http://localhost:3000',
      '/health': 'http://localhost:3000',
    },
  },
})
