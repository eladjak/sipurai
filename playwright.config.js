import { defineConfig } from '@playwright/test';
import { publishableKey } from './e2e/clerk-key.js';

// @clerk/testing reads the key from the environment.
process.env.CLERK_PUBLISHABLE_KEY = publishableKey();

// Two kinds of end-to-end test, kept apart on purpose:
//   public     - needs no account. Runs on every pull request and must pass.
//   signed-in  - needs a Clerk test account (see docs/E2E-SETUP.md). When the repository secrets are
//                missing these tests are reported as SKIPPED with the reason, never as green.
// The app is served from the production build by scripts/e2e-server.mjs (run `bun run build` first),
// which also mounts the real api/ handlers.
const PORT = 4173;

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [['list'], ['html', { open: 'never' }], ['./e2e/reporters/skip-reasons.js']]
    : [['list'], ['./e2e/reporters/skip-reasons.js']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'node scripts/e2e-server.mjs',
    port: PORT,
    env: { PORT: String(PORT) },
    reuseExistingServer: !process.env.CI,
    timeout: 60000,
  },
  projects: [
    {
      name: 'public',
      testMatch: /public\/.*\.spec\.js/,
      use: { browserName: 'chromium' },
    },
    {
      name: 'clerk-setup',
      testMatch: /signed-in\/global\.setup\.js/,
    },
    {
      name: 'signed-in',
      testMatch: /signed-in\/.*\.spec\.js/,
      dependencies: ['clerk-setup'],
      use: { browserName: 'chromium' },
    },
  ],
});
