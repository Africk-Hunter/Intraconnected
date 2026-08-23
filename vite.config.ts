import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // vitest@3.2.6 bundles its own nested vite@7.x and types defineConfig
  // against it, while @vitejs/plugin-react resolves against this project's
  // own vite@8.x — two structurally-incompatible Plugin<any> types from two
  // different installed copies of vite (no shared exported type to cast to
  // instead), not an actual config error. Once vitest ships a version
  // compatible with vite 8 this cast can go away.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  plugins: [react()] as any,
  server: {
    host: true,
    allowedHosts: ['cobalt-salaried-aluminum.ngrok-free.dev'],
  },
  test: {
    environment: 'node',
  },
})
