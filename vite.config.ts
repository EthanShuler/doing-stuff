// vitest/config re-exports Vite's defineConfig with the `test` key typed.
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    // React Compiler auto-memoizes components/hooks, so new code doesn't need
    // hand-rolled useMemo/useCallback for render performance. Existing ones
    // stay — they also pin effect-dependency identities.
    react({ babel: { plugins: ['babel-plugin-react-compiler'] } }),
  ],
  build: {
    rollupOptions: {
      output: {
        // Split the big dependencies out of the app chunk. The load win comes
        // from the lazy routes and lazy maps (see App.tsx); this mostly buys
        // deploy-to-deploy cache stability — an app-code change no longer
        // invalidates React/Mantine/Leaflet — plus it keeps Leaflet and
        // dnd-kit out of the chunks that don't use them.
        manualChunks(id) {
          // Path separators differ by platform, hence the [\\/] classes.
          if (!/[\\/]node_modules[\\/]/.test(id)) return undefined
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler|react-router)[\\/]/.test(id)) return 'vendor-react'
          if (/[\\/]node_modules[\\/]@mantine[\\/]/.test(id)) return 'vendor-mantine'
          if (/[\\/]node_modules[\\/](leaflet|react-leaflet|@react-leaflet)[\\/]/.test(id)) return 'vendor-leaflet'
          if (/[\\/]node_modules[\\/]@dnd-kit[\\/]/.test(id)) return 'vendor-dnd'
          if (/[\\/]node_modules[\\/]@supabase[\\/]/.test(id)) return 'vendor-supabase'
          return undefined
        },
      },
    },
  },
  test: {
    // e2e/*.spec.ts are Playwright tests (npm run test:e2e), not vitest's.
    exclude: ['node_modules/**', 'e2e/**'],
  },
})
