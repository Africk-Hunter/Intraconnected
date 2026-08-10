import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    allowedHosts: ['cobalt-salaried-aluminum.ngrok-free.dev'],
  },
  test: {
    environment: 'node',
  },
})
