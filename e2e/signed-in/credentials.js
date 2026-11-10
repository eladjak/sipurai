// Signed-in tests need a Clerk TEST account. Nothing here is hardcoded: all values come from the
// environment (GitHub repository secrets in CI). See docs/E2E-SETUP.md.
export const REQUIRED_ENV = ['CLERK_SECRET_KEY', 'E2E_CLERK_USER_EMAIL'];

export const missingCredentials = REQUIRED_ENV.filter((name) => !process.env[name]);
export const hasCredentials = missingCredentials.length === 0;

export const SKIP_REASON =
  `SKIPPED: signed-in tests need the secrets ${REQUIRED_ENV.join(' and ')} ` +
  `(missing: ${missingCredentials.join(', ') || 'none'}). See docs/E2E-SETUP.md.`;
