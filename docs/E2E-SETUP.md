# Browser tests (E2E): what runs, and how to switch on the signed-in tests

Every pull request runs a real browser against a fresh build of the site. The tests come in two groups.

| Group | Needs an account? | What it checks | If something is missing |
|---|---|---|---|
| **public** | No | Landing page in Hebrew right-to-left, privacy / terms / accessibility pages, blog, pricing; no page errors; no sideways scrolling at phone width (375px); protected pages send a visitor to sign-in; the login-only server routes answer 401 | Nothing is missing, these always run. If one fails the check is red. |
| **signed-in** | Yes, a test account | A parent signs in, sees the privacy consent screen, accepts, the app opens, and a second visit does not ask again | The tests are shown as **SKIPPED**, with the reason, in the job log, in the job summary and as a yellow warning. They are never silently green. |

Until you add the two secrets below, only the public group runs. That is expected, and the summary says so.

## What you need to add (about 10 minutes, once)

You need two values from Clerk and a place to put them in GitHub.

### 1. Use the Clerk DEV instance, never the live one

The tests use the Clerk **development** instance (`many-liger-29`, the one whose keys start with `pk_test_` / `sk_test_`). Do not use the live instance (`pk_live_`): Clerk only allows the testing tools on development instances, and test accounts do not belong next to real parents.

### 2. Create a dedicated test account

1. Open the Clerk dashboard, pick the **development** instance, go to **Users**, then **Create user**.
2. Use an email that only the tests use, for example `e2e-tests+sipurai@your-domain.com`. Give it any password you like and keep it in your password manager. The tests do not need the password, but Clerk requires one.
3. Do **not** turn on two-step verification for this account. The test login skips the first step, and Clerk's helper cannot get past a second step.
4. Do not use this account for anything else. The first time it signs in the privacy screen will appear; the tests accept it themselves.

### 3. Copy the instance's secret key

In the same development instance open **API keys** and copy the **Secret key** (starts with `sk_test_`). It is secret: do not paste it into the repository, a chat or an issue.

### 4. Add two secrets in GitHub

Repository `eladjak/sipurai` -> **Settings** -> **Secrets and variables** -> **Actions** -> **New repository secret**. Add exactly these names:

| Name | Value |
|---|---|
| `CLERK_SECRET_KEY` | the `sk_test_...` key from step 3 |
| `E2E_CLERK_USER_EMAIL` | the email of the test account from step 2 |

That is all. Open any pull request: the job summary now says the signed-in tests ran, and the yellow "SKIPPED" warning is gone.

### Only if your test account is in a different dev instance

The site is built with the publishable key of the dev instance `many-liger-29` (it is public by design and stored in `e2e/clerk-key.js`). If you ever use another dev instance, add a repository **variable** (same page, "Variables" tab) named `CLERK_PUBLISHABLE_KEY` with that instance's `pk_test_...` key. The secret key and the publishable key must come from the same instance.

## Run the tests on your own computer

```
bun install
bun run e2e:build          # builds with the Clerk dev publishable key
npx playwright install chromium
npx playwright test --project=public          # no account needed
```

For the signed-in group, set the two values in your terminal first (do not write them into a file in the repo):

```
set CLERK_SECRET_KEY=sk_test_...
set E2E_CLERK_USER_EMAIL=e2e-tests+sipurai@your-domain.com
npx playwright test
```

## How the signed-in test works, and what it does not cover

- Sign-in uses Clerk's documented Playwright helper (`@clerk/testing`, `clerk.signIn` with the `emailAddress` option). See Clerk's docs, "Testing with Playwright".
- The real app and real Clerk login are used. Only the consent server route is replaced inside the test by a small stand-in, because the test run has no database. The stand-in refuses requests that have no login token, so the test still proves the app sends its token. It does **not** prove that the real consent route writes to the database; that is covered by the unit tests in `tests/consent.test.mjs`.
- Forks of this repository do not receive repository secrets, so on a pull request from a fork the signed-in group is skipped and says so.

## When the public group goes red

Open the "Playwright report" download on the failed run (screenshots, video and a step-by-step trace are inside). The most common honest causes: a heading was reworded (update the test), a page now scrolls sideways on a phone (fix the page), or a protected page stopped redirecting to sign-in (fix the app).
