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

## 7. A mock that hard-codes the happy path guarantees the gate is never tested

`src/pages/__tests__/pages-setup.js` mocks `checkAgeAppropriateLanguage` to always
return `{ isAppropriate: true, flags: [], suggestions: [] }`.

While that mock was in place, the real function was blocking nearly every book —
and no test in the suite could ever have noticed, because no test ever ran the
real function. This is worse than having no test: the suite's greenness is
evidence *about the mock*, not about the code.

Mock a dependency to isolate the unit under test. Do not mock the thing whose
behaviour is the question. If a gate matters, at least one test must exercise
the real implementation — `src/utils/content-moderation.gates.test.js` now does.

## 8. Three defects in one day whose comments asserted the opposite of the code

- `verifyClerk.js`: *"azp holds the publishable key of the frontend"* — it holds an
  **origin**. The soft allowlist compared the two, so no token could ever pass.
- `content-moderation.js`: *"Does NOT block content, but returns flags and
  suggestions"* — true of the function, false of how `BookWizard` used it, which
  was as a hard gate.
- `BookWizard.jsx`: *"entity schemas that don't know about this field will ignore
  it"* — PostgREST rejects the entire insert.

Each comment was accurate when written, or plausible when guessed. None was ever
re-checked. **A comment is a claim about behaviour that nothing verifies, and it
ages in silence** — worse, a confident comment actively stops the next reader
from checking, which is how all three survived review.

When a comment states a fact you are relying on, verify the fact, not the comment.

## 9. OPEN — book creation times out and strands the book (not fixed)

Status as of 2026-08-07: the wizard now runs end to end and fails at the final
stage. **This is the remaining release blocker.** It was deliberately not fixed
in the same session — it is a design replacement, not a contract error.

**Observed:** clicking "צור את הספר שלי!" reaches *"הבקשה ארכה יותר מדי זמן"*.
Verified directly with a `supabase`-template Clerk token:

```
books  → [{"title":"Barnaby's Secret Garden Adventure","status":"generating"}]
pages  → []
```

**Mechanism:** `proxyCall` in `src/lib/aiProvider.js` puts a hard `AbortController`
on every AI call — 60s text, 90s image. `createBook` generates a cover image, then
10 page texts, then 10 page illustrations, from the browser tab. A single image
call crossing 90s aborts the whole creation.

**Why it does lasting damage — the more important half:** the book row is written
*before* any page is generated (`Book.create`, ~line 736) and `status` only ever
moves `generating → complete` (~line 1013). There is **no failure path at all** —
no `status: "failed"`, no delete, no rollback. Every timeout therefore strands a
book permanently at `generating` with zero pages, and the library lists a book
that `BookView` answers *"ספר לא נמצא"* for. **A parent gets a book they cannot
open, and nothing ever cleans it up.**

**Two directions worth considering (a decision for Elad, not a conclusion):**

1. Move generation server-side and have the client poll for progress.
2. Make it incremental — write page one as soon as it exists and fill the rest in
   behind it. Probably better for a children's product: a parent who sees the
   first page in five seconds forgives the rest taking a minute.

**Cheap and independent of that choice:** give creation a real failure path that
marks the book `failed` and says so. A stranded book currently masquerades as a
real one, which is the worst of both.
