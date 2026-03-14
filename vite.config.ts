import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  build: {
    // Output directly into the server folder so Express can serve it statically
    outDir: 'server/public',
    emptyOutDir: true,
  },
  server: {
    // Proxy /api calls to the Express server during development
    proxy: {
      '/api': 'http://localhost:4000',
    },
  },
})
