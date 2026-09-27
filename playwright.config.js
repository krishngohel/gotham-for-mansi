import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 120000,
  use: {
    baseURL: 'http://localhost:5200',
    viewport: { width: 1280, height: 720 },
    launchOptions: { args: ['--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] },
  },
  webServer: { command: 'npm run dev', port: 5200, reuseExistingServer: true, timeout: 60000 },
});
