// vitest/config re-exports Vite's defineConfig with the `test` key typed.
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    // e2e/*.spec.ts are Playwright tests (npm run test:e2e), not vitest's.
    exclude: ['node_modules/**', 'e2e/**'],
  },
})
