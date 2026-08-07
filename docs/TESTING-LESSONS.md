# Testing lessons — read this before trusting a green test

Written 2026-08-07, after production had been unable to generate a single story
for **33 days** while the project's own end-to-end suite reported **10/10 PASS**.

## 1. A green E2E suite and a completely dead product coexisted for a month

On 2026-07-05, commit `7a74930` shipped a duplicate `const parts` declaration into
`api/ai/generate.js`. That is a *parse-time* SyntaxError, so the Vercel function
never loaded. Every request to `/api/ai/generate` — including `OPTIONS`, which
returns on line 5 of the handler — answered `500 FUNCTION_INVOCATION_FAILED`.
No user could create a book.

The same day, `scripts/e2e-newuser-prod-harness.mjs` passed **10/10** against live
production RLS, and that pass was recorded in `PROGRESS.md` as evidence the
release path was clear.

Both facts were true. The harness tests the **Supabase write path**: profile
upsert, `books` INSERT, `pages` INSERT, library read, anon negative checks,
cleanup. It contains **zero** references to `/api/ai/generate`. It was not
broken. It was **aimed somewhere else** — and its greenness actively bought
confidence that nothing was wrong.

> **A test that only ever passes proves nothing. Ask what it would have to
> observe in order to fail, and whether that thing is the thing you care about.**

Before trusting any suite, list what it does *not* touch. If the product's core
action is on that list, the suite cannot tell you the product works.

## 2. Nothing in CI ever parsed `api/`

The Vite build only compiles `src/`. `vitest.config.js` sets
`include: ['src/**/*.test.{js,jsx}']`. So an entire directory of deployed code
had **no gate of any kind** — not a build, not a lint, not a test. A syntax
error survived a month because no tool ever opened the file.

Closed by `scripts/check-api-modules.mjs`, wired into `build` so a deploy fails
closed on an unparseable function. It uses `node --check` (a pure parse) rather
than `import()` deliberately: `import()` fails when env vars or dependencies are
missing, which are *environment* problems, not code problems. **A gate that
cries wolf gets removed, and a removed gate is worse than a narrow one.**

Verify the guard both ways when you change it:

```bash
node scripts/check-api-modules.mjs            # must exit 0 on a clean tree
# reintroduce a duplicate declaration, then:
node scripts/check-api-modules.mjs            # must exit 1 and name the file
```

## 3. "It is in the repo" and "it is what runs" are different claims

Production was serving `/accessibility`, a route that **did not exist on `main`**.
It had been deployed from the unmerged branch `feat/accessibility-is5568`. Anyone
reasoning about live behaviour by reading `main` would have been wrong.

Check what is deployed, not what is committed. Neither implies the other.

## 4. An unauthenticated probe cannot tell you auth works

Every early probe of `/api/ai/generate` was anonymous, so `401` was the *correct*
answer and told us nothing. It took a real session token to discover that the
verifier was rejecting **valid** tokens too — the `azp` allowlist was built from
the publishable key and compared against the token's `azp` claim, which holds an
**origin**. Two different kinds of value; they can never match.

A real user and an anonymous stranger were getting the same 401. Fixed by setting
`CLERK_AUTHORIZED_PARTIES` so the verifier takes its strict, explicit path.

> **To test a permission check you need a subject that should pass. Confirming
> that the blocked are blocked is half a test.**

## 5. Check the instrument before you report the finding

Repeatedly, during this work, a surprising result was the *tool*, not the product:

- A Hebrew prompt sent through a Windows shell arrived mangled, and the model
  answered something unrelated. The product was fine; the shell was not. Writing
  the JSON to a UTF-8 file fixed it.
- A Gmail search returned nothing because the connected account was the wrong
  one — an empty result that looked exactly like "no such email".
- Preview-scoped Vercel env vars silently did not apply, because they bind to a
  **git branch** and a CLI deploy carries no branch association.

Run a control arm whose expected outcome you already know. If the control does
not behave, your measurement is meaningless no matter how plausible it looks.

## 6. What is still not covered

The four-step user journey — arrive, prompt, **see the story rendered**, save and
confirm the artefact exists — **cannot be automated**. Sign-up sits behind a
Cloudflare Turnstile challenge that does not pass for an automated browser, and
Clerk's production instance rejects `*.vercel.app` and `localhost` origins, so
previews cannot authenticate at all.

Until that changes, the last mile needs a human in a real browser. Anything that
claims to have verified the journey without one has verified something else.
