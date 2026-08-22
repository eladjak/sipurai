# Incremental book generation

Written 2026-08-07, replacing the one-shot generator that had stranded every
timed-out book permanently at `status: "generating"` with zero pages. Read
`TESTING-LESSONS.md` §9 and §10 first — this document is the answer to them.

## The failure it replaces

`createBook` wrote the `books` row, then generated a cover image, ten page texts
and ten illustrations in a single synchronous browser-side burst, then wrote all
the pages, then flipped `status` to `complete`.

`proxyCall` in `src/lib/aiProvider.js` puts a hard `AbortController` on every AI
call — 60s for text, 90s for an image. **One image crossing 90s rejected the
whole run.** The book row already existed by then, and `status` had no path
other than `generating → complete`, so the row kept claiming work was in
progress forever: listed in the library, unopenable in the reader, with nothing
anywhere admitting anything had gone wrong.

Two separate defects, and the second is the one that did lasting damage:

1. All the work was in one all-or-nothing transaction that had no transaction.
2. The state machine had no failure transition, so the data could not report it.

## The design

Work is broken into units that are each **persisted the moment they exist**:

```
outline ─► books row + total_pages ─► skeleton page rows (the plan)
        ─► page 0 text ─► page 0 image        ← the parent can read now
        ─► remaining texts and images, each written as it lands
```

Page one is generated first and alone. Everything after it runs in a
bounded-concurrency pool. Nothing is held in memory waiting for a batch, so
there is no batch to lose.

### Why the skeleton rows exist

The page rows are created up front with `text_content: ''` and the outline
description in `image_prompt`. They are the **work queue, and they are what
makes a resume possible from a different device with no client state** — the
plan lives in the database rather than in one tab's memory.

The cost is that `pages` now contains rows a reader must not show. That is
handled in exactly one place, `src/lib/bookProgress.js`:

> **A page is readable if and only if it has text.** `readablePages()` is the
> only way any surface gets pages to render.

Every consumer of `Page.filter` goes through it: `BookView`, `BookCreation`,
`Feedback`, and `Library`'s duplicate. Adding a new one without it would render
blank pages — that is the one trap this design introduces, so it is named here.

### The status model

`books.status` is a plain `text` column with **no CHECK constraint** (verified
against the live database, not assumed), so these values needed no migration:

| value | meaning | resumable |
|---|---|---|
| `generating` | a run is planned or in flight, not every page written | yes |
| `partial` | a run stopped with at least one readable page | yes |
| `complete` | every planned page has text | no |
| `failed` | a run stopped with nothing readable at all | yes |

**The pages are the truth; the column is a cached summary of them.** Anything
derivable from the rows is derived (`deriveStatus`, `summarizeBook`), because
the column is written by a process that can die between two statements and the
rows cannot disagree with themselves.

`total_pages` is set from the outline *before the first page is written*, which
is what lets a book that died at page two say "2 of 10" instead of pretending
two was the plan.

### The closed-tab problem, and the honest answer to it

A row sitting at `generating` looks identical whether a tab is building it right
now or whether that tab was closed an hour ago. No column can tell them apart
without a heartbeat.

`src/lib/generationLock.js` writes a timestamp to `localStorage` every 15s while
a run is alive, and a lock older than 60s means nothing is working on the book.
A closed tab stops refreshing within one interval, so the truth arrives on its
own with no cleanup job and no schema.

Its two limits both fail in the safe direction:

- **It is per-browser.** A run on another device is invisible, so this browser
  offers to continue a book already being built elsewhere. The cost is duplicated
  AI calls and possibly a duplicate page row (deduped on read) — never lost work.
- **If storage is unavailable it reports "not live"**, which shows a Continue
  button. Offering to resume a nearly-finished book is harmless; a spinner that
  never ends is the failure this whole exercise exists to remove.

### What the reader shows

`viewState(book, pages, isRunLive)` returns one of five, and the UI has a real
answer for each:

| state | condition | shown |
|---|---|---|
| `complete` | every planned page has text | the book |
| `building` | ≥1 readable page, a run is heartbeating | the book + "3 of 10 ready, the rest are being written" |
| `interrupted` | ≥1 readable page, nothing running | the book + "3 of 10 ready, building has stopped" + **Continue** |
| `starting` | no readable page, a run is heartbeating | "the first page will appear in a moment" |
| `empty` | no readable page, nothing running | "stopped before a page was written" + **Continue** |
| `missing` | no book row | genuinely not found |

While a run is live the reader re-reads every 4 seconds, so pages appear as they
land. The poll stops when the heartbeat stops — a closed tab therefore leaves a
still reader offering to continue, not one spinning against nothing.

## Schema decisions — read before changing anything here

**No migration was applied.** Everything above uses columns that already exist:
`books.status`, `books.total_pages`, `pages.text_content`, `pages.image_url`,
`pages.image_prompt`, `pages.page_number`.

Three things were deliberately **not** done, because each needs a column and
that is a production schema change and therefore a decision for a human:

1. **`UNIQUE (book_id, page_number)` on `pages`.** There is no unique index
   today, so two concurrent runs of the same book could each insert a row for
   the same page. Handled in application code — `normalizePages` collapses
   duplicates on read, preferring the more complete row — so a race degrades to
   a wasted row rather than a wrong book. The index is the proper fix and would
   make the whole scheme idempotent at the database level:
   ```sql
   CREATE UNIQUE INDEX pages_book_page_uniq ON pages (book_id, page_number);
   ```
   Note it would need existing duplicates cleared first.
2. **`pages.scene_id`.** `BookWizard` used to send this field on every page
   insert whenever the user had built a scene structure. **There is no such
   column**, and PostgREST rejects an insert with an unknown column rather than
   ignoring it — the identical defect that `books.scenes` caused, in the row
   below. Removed. The scene spine still enriches illustration prompts; only its
   persistence is dropped.
3. **Somewhere to persist the rhyme scheme.** It is wizard-only state, so a book
   resumed from the reader gets prose for its remaining pages even if the pages
   already written rhyme. Accepted deliberately: a book a parent can finish beats
   a book that stays broken. Resuming from the wizard's own retry keeps the
   scheme, because the form state is still there.

## What the live journey found

`scripts/journey-incremental-generation.mjs` runs the real generator against the
real database and the real Gemini API, in three arms — happy, an aborted
illustration, and a resume. It found four things no unit test could, and every
one of them was a real defect rather than a test problem:

**1. The cover was holding page one hostage.** Waiting for the cover image before
writing page one's *words* cost the parent's entire first impression. The cover
is only needed as a character reference for *drawing*, so it is now awaited by
the drawing step alone. Measured, live: **page one readable at 26.0s → 11.9s**;
whole three-page book 49.2s → 35.4s.

**2. `parts[0]` silently truncated long answers.** `api/ai/generate.js` read only
the first part of Gemini's response. Gemini splits long answers across parts, so
a long JSON answer arrived cut in half and surfaced as *"AI returned invalid
JSON"* — sending every reader to look at the parser rather than at the half that
was thrown away. Now every part is joined.

**3. Gemini ran away, and the cap that was supposed to stop it made things
worse.** Uncapped, an outline call reached ~131KB and a page-text call ~81KB,
each stopping mid-string. Capping page text at 2048 tokens then made a page fail
*reproducibly* — because **`gemini-2.5-flash` is a thinking model and its
thinking tokens are spent out of `maxOutputTokens` before a single character of
the answer is written.** Measured on one page:

| | finishReason | thought tokens | total | result |
|---|---|---|---|---|
| thinking on | `MAX_TOKENS` | 1604 | 2205 | cut off mid-sentence |
| thinking off | `STOP` | 0 | 631 | complete |

Writing one page of a children's story is not a reasoning task. Page text now
opts out of thinking via a new `thinking_budget` option; the outline keeps its
reasoning (it decides the story's shape) and is given room for it. **The proxy's
default is deliberately unchanged** — whether a prompt benefits from thinking is
a judgement about that prompt, and other callers were not measured.

**4. A "complete" book with no pictures said nothing.** Completeness is about
text, because text is what makes a page readable — so a book whose every
illustration failed was `complete` and offered no way to fix itself. `isResumable`
now also returns true when illustrations are missing, and the reader offers to
draw them.

Findings 2 and 3 are not incremental-generation bugs. They were causing book
creation to fail intermittently for everyone, and they were invisible because the
only symptom reached the user as "invalid JSON, please try again".

## Verifying a change here

The unit tests are in `src/lib/__tests__/`. They use an in-memory stand-in for
the two tables — **the store really stores**, because "what does the database
look like when the run stops here" is the question being asked. The AI is what
gets faked, since it is not the question. (`TESTING-LESSONS.md` §7.)

The tests that matter most are the failing arms:

```bash
npx vitest run src/lib/__tests__/bookGeneration.test.js -t "failing arm"
npx vitest run src/lib/__tests__/bookGeneration.test.js -t "resume"
```

They assert the properties, not the implementation:

- an illustration that times out costs one picture, not the book;
- a run that dies leaves `partial` or `failed` — **never** `generating`;
- a resume finishes only what is missing and does not re-pay for, or rewrite,
  a page the parent is already reading;
- the run lock is released even when the run throws.

Before believing any of it, break something on purpose and watch a test go red.
Two of these tests failed the first time they ran, for real reasons, which is
the only evidence that they are capable of failing at all.

`npm run build` also genuinely parses these files — confirmed by inserting a
syntax error into `bookProgress.js` and watching rollup name the file and exit 1.

⚠️ **`vitest run` exits 0 even when a worker dies of OOM.** The known
out-of-memory file in this repo produces `Unhandled Errors … 1 error` in the
summary while the process still returns 0. Read the `Test Files` and `Tests`
counts; do not trust the exit code alone.

### The live journey

```bash
node --import ./scripts/alias-loader.mjs scripts/journey-incremental-generation.mjs
```

Needs `.env` (Supabase service key + Gemini key). It writes real rows and deletes
every one of them, including when it fails. Expect ~85s and roughly a dozen
Gemini calls.

It is not a substitute for the RLS harness: it authenticates as the **service
role**, which bypasses RLS entirely, so it proves the write *shapes* are real,
not that a signed-in parent is permitted to make them. Run
`e2e-newuser-prod-harness.mjs` with a fresh Clerk JWT for that.

Its own credibility: it failed three separate times on real defects before it
went green — an unfaithful column mapping in its adapter, a truncated outline,
and a reproducibly truncated page. An arm that has never been red has not been
shown to be capable of it.
