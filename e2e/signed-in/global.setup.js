import { test as setup } from '@playwright/test';
import { clerkSetup } from '@clerk/testing/playwright';
import { hasCredentials, SKIP_REASON } from './credentials.js';

// Documented Clerk approach: https://clerk.com/docs/guides/development/testing/playwright/overview
// clerkSetup() reads CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY and fetches a Testing Token
// so the sign-in form is not blocked by Clerk's bot protection.
setup.describe.configure({ mode: 'serial' });

setup('clerk testing token', async () => {
  setup.skip(!hasCredentials, SKIP_REASON);
  await clerkSetup();
});
