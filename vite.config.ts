/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: true,
    // Em dev, /api vai para o backend real quando VITE_API_PROXY estiver setado
    // (ex.: http://localhost:8000). Sem isso, o MSW intercepta e serve o mock.
    proxy: process.env.VITE_API_PROXY
      ? { '/api': { target: process.env.VITE_API_PROXY, changeOrigin: true } }
      : undefined,
  },
  test: {
    // Padrao: node (reducer/dominio/api sao puros). Testes de UI declaram
    // `// @vitest-environment jsdom` no topo do arquivo.
    environment: 'node',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    setupFiles: ['./src/setupTestes.ts'],
  },
})
