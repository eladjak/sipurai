// Builds the app the way the browser tests expect it: with a Clerk publishable key baked in,
// so that "protected page -> sign-in" can be tested. Same steps as `bun run build`
// (API parse check, then vite build). Usage: node scripts/e2e-build.mjs
import { spawnSync } from 'node:child_process';
import { publishableKey } from '../e2e/clerk-key.js';

const env = { ...process.env, VITE_CLERK_PUBLISHABLE_KEY: publishableKey() };
for (const script of ['scripts/check-api-modules.mjs', 'node_modules/vite/bin/vite.js']) {
  const r = spawnSync(process.execPath, script.includes('vite') ? [script, 'build'] : [script], { stdio: 'inherit', env });
  if (r.status !== 0) process.exit(r.status ?? 1);
}
