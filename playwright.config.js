import { defineConfig } from '@playwright/test';

// One worker on the real GPU: the game is heavy, and parallel software-rendered pages crawl.
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 180000,
  workers: 1,
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:5200',
    viewport: { width: 1280, height: 720 },
    launchOptions: { args: ['--ignore-gpu-blocklist', '--use-angle=d3d11', '--mute-audio'] },
  },
  webServer: process.env.BASE_URL ? undefined : { command: 'npm run dev', port: 5200, reuseExistingServer: true, timeout: 60000 },
});
