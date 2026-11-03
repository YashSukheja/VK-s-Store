import { defineConfig } from '@playwright/test'

// End-to-end tests run against the local Supabase stack (npx supabase start)
// and the Vite dev server, on a phone-sized screen.
export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  workers: 1,
  use: {
    baseURL: 'http://localhost:5173',
    viewport: { width: 390, height: 844 },
    // The home page logo intro and scroll scenes are skipped with reduce motion; one test turns it back on.
    contextOptions: { reducedMotion: 'reduce' },
    launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
  },
  webServer: { command: 'npm run dev -- --port 5173 --strictPort', url: 'http://localhost:5173', reuseExistingServer: true },
})
