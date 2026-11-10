// Builds the app the way the browser tests expect it: with a Clerk publishable key baked in,
// so that "protected page -> sign-in" can be tested. Usage: node scripts/e2e-build.mjs
import { spawnSync } from 'node:child_process';
import { publishableKey } from '../e2e/clerk-key.js';

const key = publishableKey();
const r = spawnSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build'], {
  stdio: 'inherit',
  env: { ...process.env, VITE_CLERK_PUBLISHABLE_KEY: key },
});
process.exit(r.status ?? 1);
