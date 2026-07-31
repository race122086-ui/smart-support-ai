import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],

  server: {
    host: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
    },
  },

  preview: {
    host: '0.0.0.0',
    allowedHosts: true,
  },

  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    include: ['./src/**/*.test.{js,jsx}'],
    css: false,
  },
})
