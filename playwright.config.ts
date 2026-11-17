import { defineConfig, devices } from '@playwright/test'

// E2E suite runs against the Vite dev server in KEYLESS SEED MODE: the
// Supabase env vars are blanked below (process env beats .env.local in Vite),
// so the app skips auth and serves the deterministic in-memory seed. No login,
// no network writes, same data every run.
//
// Port 5199 is dedicated to e2e (strictPort) so the suite can never attach to
// a normally-launched dev server that has real keys loaded. E2E_PORT overrides
// it, so two suites (e.g. parallel agents) can run side by side.
const PORT = process.env.E2E_PORT ?? '5199'

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    // System Chrome — avoids Playwright's browser download.
    channel: 'chrome',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
      testIgnore: /mobile/,
    },
    {
      name: 'mobile',
      // iPhone-ish viewport; keep the Chrome channel (webkit isn't installed).
      use: { ...devices['Desktop Chrome'], channel: 'chrome', viewport: { width: 390, height: 844 } },
      testMatch: /mobile/,
    },
  ],
  webServer: {
    command: `npm run dev -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    env: { VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '' },
  },
})
