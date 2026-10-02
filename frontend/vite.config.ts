/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Em desenvolvimento, /api é encaminhado para a API Node (evita CORS no navegador).
    proxy: {
      '/api': process.env.VITE_API_PROXY ?? 'http://localhost:3333',
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
});
