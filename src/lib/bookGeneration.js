import { imageAspectForBook } from "./printSpec";
/**
 * Incremental, resumable book generation.
 *
 * ## What was wrong before
 *
 * `createBook` wrote the book row, then generated a cover, ten page texts and
 * ten illustrations in one synchronous browser-side burst, then wrote the pages
 * and flipped `status` to `complete`. `proxyCall` aborts any AI call at 60s
 * (text) / 90s (image), so a single slow illustration threw — and because the
 * book row already existed and `status` had no path other than
 * `generating → complete`, every timeout stranded a book forever: listed in the
 * library, unopenable in the reader, with nothing admitting it went wrong.
 *
 * ## What this does instead
 *
 * Work is broken into units that are each **persisted the moment they exist**:
 *
 *   outline → book row + skeleton page rows → page 1 text → page 1 image
 *           → remaining page texts and images, each saved as it lands
 *
 * Page one is written first and on its own, so the reader has something real
 * within seconds; the rest fill in behind it. Nothing is held in memory waiting
 * for a batch to complete, which means there is no batch left to lose.
 *
 * Two properties follow, and they are the point of the whole design:
 *
 *  1. **Nothing strands.** Every exit — success, thrown error, abort, closed
 *     tab — leaves a row whose state matches what actually exists. Success and
 *     failure both go through {@link settle}; there is no path that leaves
 *     `generating` behind, and the closed-tab case is covered because the status
 *     is only ever a summary of pages that are already durable.
 *  2. **Resume is cheap and never regresses.** A resume reads what exists and
 *     does only what is missing. It never rewrites a page that already has
 *     text, so a parent who retries does not pay for the same page twice and
 *     does not get a different story than the one they were already reading.
 *
 * The module knows nothing about Hebrew, rhyme, scenes or art styles. All of
 * that stays in the wizard and arrives through `recipe`, whose functions build
 * prompts. That split is what lets the durability logic be tested without
 * mocking an AI, and it means a change to prompt wording cannot break the state
 * machine.
 */

import { BOOK_STATUS, isPageReady, isPageIllustrated, normalizePages, summarizeBook } from '@/lib/bookProgress';
import { editedPages } from "@/lib/storyManuscript";
import { acquireRun } from '@/lib/generationLock';
import { getApiAuthHeaders } from '@/lib/apiAuth';

/** How many pages past the first to work on at once. */
export const DEFAULT_CONCURRENCY = 3;

/** Marker kept on `image_prompt` when an illustration failed, so a retry surface can find it. */
export const IMAGE_FAILED_PREFIX = '[Image generation failed] ';

/**
 * @typedef {Object} GenerationRecipe
 * @property {number} pageCount              Planned pages, including the cover/title page.
 * @property {Object} bookFields             Columns to insert into `books` (no status/total_pages).
 * @property {string} outlinePrompt
 * @property {Object} outlineSchema
 * @property {(sheet: Array) => void} [applyCastSheet]
 * @property {(outline: Array, title: string) => Object} [manuscriptRequest]
 * @property {() => Object} [checkpointInputs]
 * @property {boolean} [requireReference]
 * @property {string} [approvedTitle]
 * @property {string} coverPrompt
 * @property {(entry: Object, index: number) => string} pageTextPrompt
 * @property {(index: number) => Object} pageTextSchema
 * @property {(page: Object, index: number, ctx: Object) => string} imagePrompt
 * @property {(index: number) => string} layoutFor
 * @property {(raw: string) => string} sanitize
 * @property {(result: Object) => string} readPageText  Pull display text out of an LLM result.
 */

/**
 * Build or continue a book.
 *
 * @param {Object} opts
 * @param {{Book: Object, Page: Object}} opts.entities
 * @param {{InvokeLLM: Function, GenerateImage: Function}} opts.ai
 * @param {GenerationRecipe} opts.recipe
 * @param {string|null} [opts.bookId]        Present ⇒ resume an existing book.
 * @param {string|null} [opts.newBookId]
 * @param {boolean} [opts.allowLegacyReservation]
 * @param {number[]} [opts.repairPages]
 * @param {boolean} [opts.repairCover]
 * @param {string} [opts.automaticRecoveryOwnerId]
 * @param {boolean} [opts.keepStoredArt] Internal durable recovery setting.
 * @param {(event: Object) => void} [opts.onEvent]
 * @param {number} [opts.concurrency]
 * @param {AbortSignal} [opts.signal]        Cancels *scheduling*; in-flight calls finish and are saved.
 * @param {Function} [opts.lock]             Injectable for tests. Defaults to the localStorage heartbeat.
 * @param {(url: string) => Promise<string|null>} [opts.fetchReference]
 * @returns {Promise<{bookId: string, status: string, ready: number, total: number, imageFailures: Array}>}
 */
export async function generateBookIncremental({
  entities,
  ai,
  recipe,
  bookId = null,
  onEvent = () => {},
  concurrency = DEFAULT_CONCURRENCY,
  signal,
  lock = acquireRun,
  fetchReference = fetchImageAsBase64,
  newBookId = null,
  allowLegacyReservation = false,
  repairPages = [],
  repairCover = false,
  automaticRecoveryOwnerId,
  keepStoredArt = false,
}) {
  if (automaticRecoveryOwnerId && (!bookId || allowLegacyReservation || !entities.Book.generationStore)) {
    throw Object.assign(new Error("Automatic recovery requires an existing durable book"), { code: "automatic_recovery_unavailable" });
  }
  if (entities.Book.generationStore) {
    const { generateDurableBook } = await import('./durableBookRun');
    return generateDurableBook({ storage: entities.Book.generationStore, entities, ai, recipe, bookId, newBookId,
      allowLegacyReservation, onEvent, concurrency, signal, lock, repairPages, repairCover, fetchReference, automaticRecoveryOwnerId });
  }
  const { Book, Page } = entities;
  const { InvokeLLM, GenerateImage } = ai;

  const emit = (type, payload = {}) => {
    try {
      onEvent({ type, ...payload });
    } catch {
      // A listener that throws must never take the generation down with it.
    }
  };

  let book = null;
  let pages = [];
  let manuscript = null;
  let servicePaused = false;
  let fatalError = null;
  let coverUsable = false;

  function stopOnConflict(error) {
    if (['lease_lost', 'book_conflict', 'page_conflict', 'storage_unavailable', 'book_not_owned'].includes(error?.code)) {
      fatalError = error;
      servicePaused = true;
      return true;
    }
    return false;
  }

  let storyPlan = [];
  let releaseLock = () => {};
  const imageFailures = [];

  try {
    // ── 1. Establish the book and its plan ───────────────────────────────────
    if (bookId) {
      book = await Book.get(bookId);
      if (!book) throw new Error(`Book ${bookId} not found`);
      pages = normalizePages(await Page.filter({ book_id: bookId }, 'page_number'));
      releaseLock = lock(bookId);
      recipe.setTitle?.(book.title);
      emit('resumed', { bookId, title: book.title, ...summarizeBook(book, pages) });

      // Rows can be missing, not merely empty: the first run may have died
      // between the book insert and the page inserts, or partway through them.
      // A book with fewer rows than `total_pages` can never reach `complete`,
      // so a resume that only filled in existing rows would leave the parent
      // pressing Continue forever on a book that cannot finish.
      //
      // Rebuilding the plan costs one outline call, and it is only spent when
      // rows are genuinely absent. Pages that already exist are never touched.
      const planned = Number(book.total_pages) || recipe.pageCount;
      const present = new Set(pages.map((p) => p.page_number));
      const missing = [];
      for (let i = 0; i < planned; i++) if (!present.has(i)) missing.push(i);

      if (missing.length > 0) {
        const outline = await callOutline(InvokeLLM, recipe);
        const entries = normalizeOutline(outline?.outline, planned);

        if (Number(book.total_pages) !== planned) {
          await Book.update(book.id, { total_pages: planned }).catch(() => {});
          book = { ...book, total_pages: planned };
        }

        for (const i of missing) {
          pages.push(
            await Page.create({
              book_id: book.id,
              page_number: i,
              text_content: '',
              image_url: '',
              image_prompt: entries[i]?.description || '',
              layout_type: recipe.layoutFor(i),
            })
          );
        }
        pages = normalizePages(pages);
        emit('plan-saved', { bookId: book.id, total: planned });
      }
    } else {
      emit('phase', { phase: 'outline' });
      const outline = await callOutline(InvokeLLM, recipe);

      const entries = normalizeOutline(outline?.outline, recipe.pageCount);
      recipe.applyCastSheet?.(outline?.cast);
      storyPlan = entries;
      const title = recipe.sanitize(recipe.approvedTitle || outline?.title || recipe.bookFields.title);

      // The row is written before any page exists — unavoidable, since pages
      // need a book_id. `total_pages` is set in the same statement so that a
      // book which dies at page two still knows it was meant to have ten, and
      // the reader can say "2 of 10" instead of pretending two was the plan.
      book = await Book.create({
        ...recipe.bookFields,
        // Sharing is an explicit later action; never inherit a draft's flag.
        is_public: false,
        title,
        status: BOOK_STATUS.GENERATING,
        total_pages: entries.length,
      });
      if (!book?.id) throw new Error('Book row was created without an id');
      releaseLock = lock(book.id);
      recipe.setTitle?.(title);
      emit('book-created', { bookId: book.id, title, total: entries.length });

      // Skeleton rows persist the outline. This is what makes a resume possible
      // from a different device with no client state: the plan lives in the
      // database, not in this tab's memory. They carry no text, so
      // `isPageReady` keeps them out of the reader until they are real.
      pages = [];
      for (let i = 0; i < entries.length; i++) {
        pages.push(
          await Page.create({
            book_id: book.id,
            page_number: i,
            text_content: '',
            image_url: '',
            image_prompt: entries[i]?.description || '',
            layout_type: recipe.layoutFor(i),
          })
        );
      }
      emit('plan-saved', { bookId: book.id, total: entries.length });
    }

    // ── 2. Cover art — started early, never blocking ─────────────────────────
    // The cover doubles as the character reference passed to every page image,
    // so pages look better when it lands first. It is still not allowed to hold
    // page one hostage: if it is slow or fails, pages proceed without it.
    let coverWork = Promise.resolve(null);

    const makeCover = () => GenerateImage({ prompt: recipe.coverPrompt, aspectRatio: imageAspectForBook(book) })
        .then(async (result) => {
          if (!result?.url) return null;
          const pixels = recipe.requireReference
            ? await fetchReference(result.url)
            : result.base64 || await fetchReference(result.url).catch(() => null);
          if (recipe.requireReference && !pixels) throw new Error('Cover image could not be read');
          await Book.update(book.id, { cover_image: result.url });
          book = { ...book, cover_image: result.url };
          // The base64 rides along so a caller that later retries a single
          // illustration can pass the same character reference and keep the
          // child on page 7 looking like the child on page 1.
          emit('cover', { url: result.url, base64: result.base64 || null });
          return pixels;
        })
        .catch((err) => {
          stopOnConflict(err);
          if (shouldPauseGeneration(err)) servicePaused = true;
          emit('cover-failed', { message: messageOf(err) });
          return null;
        });
    if (book.cover_image && !repairCover) {
      // A failed fetch cannot replace a family's existing cover on its own.
      coverWork = fetchReference(book.cover_image).catch(() => null);
    } else {
      coverWork = makeCover();
    }

    // The character reference, resolved at most once and only ever awaited by
    // the step that needs it — drawing. Page one's *words* must not wait for a
    // picture: waiting on the cover before writing any text cost 8 seconds of
    // the parent's first impression, measured against the live API.
    //
    // Start writing as soon as the plan exists. Only illustration awaits the
    // cover, so a slow cover cannot silently discard every character reference.
    const referenceReady = coverWork.catch(() => null).then(ref => {
      coverUsable = !!ref;
      return ref;
    });
    if (!bookId && recipe.manuscriptRequest && !signal?.aborted) {
      emit('phase', { phase: 'editing' });
      try {
        const result = await InvokeLLM(recipe.manuscriptRequest(storyPlan, book.title));
        manuscript = editedPages(result, storyPlan.length);
      } catch (err) {
        if (shouldPauseGeneration(err)) servicePaused = true;
        // The saved outline remains usable by the per-page path after timeout.
      }
    }
    const outlineForContinuity = pages.map((page) =>
      (page.text_content || page.image_prompt || '').slice(0, 400)
    );

    // ── 3. Page one, alone and first ─────────────────────────────────────────
    // This is the whole user-visible point of the redesign: a parent sees a
    // real page in seconds. Everything after this is allowed to take a minute.
    const order = pages.map((_, i) => i);
    const first = order[0];

    // Persist the edited manuscript before waiting on artwork. Resuming a book
    // after the tab closes can now use the same words for all completed rows.
    if (manuscript) {
      await pool(order, concurrency, (index) => buildPage(index, referenceReady, true), signal);
    }
    if (first !== undefined && !signal?.aborted) await buildPage(first, referenceReady);

    // ── 4. The rest, in a bounded pool ───────────────────────────────────────
    await pool(order.slice(1), concurrency, (index) => buildPage(index, referenceReady), signal);

    if (recipe.requireReference) await referenceReady;
    if (fatalError) throw fatalError;
    return await settle();

    // ── unit of work ─────────────────────────────────────────────────────────
    /**
     * Bring one page up to date. Text and illustration are separate awaits with
     * separate error handling on purpose: an illustration that times out at 90s
     * must cost one picture, not the book. Each result is written the instant it
     * exists, so an abort between them loses at most the unit in flight.
     */
    async function buildPage(index, refPromise, textOnly = false) {
      const page = pages[index];
      if (!page || servicePaused) return;

      // Prompts are addressed by the page's own number, not its position in the
      // array. They coincide for a whole book, but a resume that had to rebuild
      // missing rows must still ask for "page 4" when it means page 4.
      const number = Number.isFinite(page.page_number) ? page.page_number : index;

      if (!isPageReady(page)) {
        try {
          // `pageTextOverride` lets a caller supply text it already has (the
          // Story Bible fast path writes every page in one upfront call), so
          // the incremental loop still owns persistence and ordering without
          // paying for a second LLM round-trip per page.
          const precomputed = manuscript?.[number] || recipe.pageTextOverride?.(number) || null;
          const result = precomputed || await writePageText(number, page);
          const text = recipe.sanitize(recipe.readPageText(result) || '');
          const imagePrompt = recipe.sanitize(result?.image_prompt || page.image_prompt || '');
          if (!text) throw new Error('The model returned an empty page');

          const saved = await Page.update(page.id, {
            text_content: text,
            image_prompt: imagePrompt,
          });
          pages[index] = { ...page, ...(saved || {}), text_content: text, image_prompt: imagePrompt };

          // The first readable page is the moment the book stops being a
          // promise and starts being a book. Say so immediately — both in the
          // data and to whoever is watching.
          if (book.status !== BOOK_STATUS.PARTIAL && book.status !== BOOK_STATUS.COMPLETE) {
            await Book.update(book.id, { status: BOOK_STATUS.PARTIAL });
            book = { ...book, status: BOOK_STATUS.PARTIAL };
          }
          emit('page-text', { index, bookId: book.id, ...summarizeBook(book, pages) });
        } catch (err) {
          stopOnConflict(err);
          if (shouldPauseGeneration(err)) servicePaused = true;
          emit('page-text-failed', { index, message: messageOf(err) });
          return; // No text ⇒ no illustration to draw. Leave it for a resume.
        }
      }

      if (textOnly) return;
      if (isPageIllustrated(pages[index]) && !repairPages.includes(number)) {
        if (keepStoredArt || !recipe.requireReference || await fetchReference(pages[index].image_url)) return;
        // Keep the stored artwork until a verified replacement is available.
      }

      // Only now is the cover worth waiting for: it is the character reference,
      // and it matters to the drawing, not to the words.
      const ref = await refPromise;
      if (servicePaused || (recipe.requireReference && !ref)) return;

      const previousPrompt = pages[index].image_prompt || '';
      const prompt = previousPrompt.startsWith(IMAGE_FAILED_PREFIX)
        ? previousPrompt.slice(IMAGE_FAILED_PREFIX.length)
        : recipe.imagePrompt(pages[index], number, { reference: ref });
      try {
        const result = await GenerateImage({ prompt, aspectRatio: imageAspectForBook(book), referenceImageBase64: ref || null });
        const url = result?.url || '';
        if (!url || (recipe.requireReference && !(await fetchReference(url)))) {
          throw new Error('Page illustration could not be read');
        }
        const saved = await Page.update(pages[index].id, { image_url: url, image_prompt: prompt });
        pages[index] = { ...pages[index], ...(saved || {}), image_url: url, image_prompt: prompt };
        emit('page-image', { index, bookId: book.id, ...summarizeBook(book, pages) });
      } catch (err) {
        // A failed illustration is recorded on the row so a retry surface can
        // find it later, and reported — but it is emphatically not fatal. A
        // page with words and no picture is still a page.
        if (stopOnConflict(err)) return;
        if (shouldPauseGeneration(err)) servicePaused = true;
        imageFailures.push({ pageId: pages[index].id, index, imagePrompt: prompt });
        await Page.update(pages[index].id, {
          image_prompt: `${IMAGE_FAILED_PREFIX}${prompt}`,
        }).catch(stopOnConflict);
        emit('page-image-failed', { index, message: messageOf(err) });
      }
    }

    /**
     * Ask the model for one page, once more if the first answer was unusable.
     *
     * A failed page is far less costly than a failed outline — it is resumable,
     * and the rest of the book still lands. The retry is here because the
     * failure seen in practice is a runaway that stops mid-string, and a second
     * attempt under the same token ceiling usually succeeds. One retry, so a
     * genuinely broken page surfaces instead of stalling the pool.
     */
    async function writePageText(number, page) {
      const ask = () =>
        InvokeLLM({
          prompt: recipe.pageTextPrompt({ description: page.image_prompt || '', outline: outlineForContinuity }, number),
          response_json_schema: recipe.pageTextSchema(number),
          max_tokens: recipe.pageMaxTokens,
          thinking_budget: recipe.pageThinkingBudget,
        });
      try {
        return await ask();
      } catch (first) {
        if (shouldPauseGeneration(first)) throw first;
        try {
          return await ask();
        } catch {
          throw first;
        }
      }
    }

    /**
     * Write the status that matches the rows, and return it.
     *
     * Called on every exit, success or failure. That is the invariant the old
     * code lacked: there is no way out of this function that leaves the column
     * saying `generating` while nothing is generating.
     */
    async function settle() {
      const s = summarizeBook(book, pages);
      const status = s.isComplete && s.missingImage.length === 0 && (!recipe.requireReference || coverUsable) && !imageFailures.length
        ? BOOK_STATUS.COMPLETE
        : s.isReadable
          ? BOOK_STATUS.PARTIAL
          : BOOK_STATUS.FAILED;

      if (book.status !== status) {
        await Book.update(book.id, { status }).catch((err) => {
          // Best effort. If even this fails the row keeps its previous value,
          // which is either `generating` (the reader treats a stale run as
          // interrupted and offers Continue) or an earlier truthful value.
          emit('status-write-failed', { message: messageOf(err) });
          if (recipe.requireReference || stopOnConflict(err)) throw err;
        });
        book = { ...book, status };
      }
      emit('settled', { bookId: book.id, status, ...s });
      return { bookId: book.id, status, ready: s.ready, total: s.total, imageFailures };
    }
  } catch (err) {
    // The book exists but the run broke. Record what is genuinely there rather
    // than leaving a row that claims work is still happening.
    if (book?.id && !fatalError) {
      try {
        const s = summarizeBook(book, pages);
        await entities.Book.update(book.id, {
          status: s.isReadable ? BOOK_STATUS.PARTIAL : BOOK_STATUS.FAILED,
        });
      } catch {
        // Nothing further to do, and it must never mask the original error.
      }
    }
    err.bookId = book?.id || null;
    throw err;
  } finally {
    releaseLock();
  }
}

// ─── helpers ────────────────────────────────────────────────────────────────

/**
 * Outlines come back from a model, so their length is a suggestion. Pad or trim
 * to the planned count — a book with three pages because the model felt terse
 * is a bug the parent pays for.
 */
export function normalizeOutline(outline, pageCount) {
  const list = Array.isArray(outline) ? outline.filter(Boolean) : [];
  const out = [];
  for (let i = 0; i < pageCount; i++) {
    const entry = list[i];
    out.push({
      page_number: i,
      description: (entry?.description || entry?.text || '').toString().trim(),
    });
  }
  return out;
}

/**
 * The outline is the one call whose failure costs an entire book: it happens
 * before any row exists, so there is nothing to resume and the parent simply
 * gets nothing. Everything after it is per-page and independently retryable.
 *
 * It is also the call most likely to fail transiently — it asks for the largest
 * structured response, and a model that rambles past its token ceiling returns
 * JSON that stops mid-string. Observed live on 2026-08-07 at ~131KB.
 *
 * So it, and only it, gets one retry. One, not a loop: a persistent failure
 * should surface quickly rather than be hidden behind minutes of retrying.
 */
export async function callOutline(InvokeLLM, recipe) {
  try {
    return await InvokeLLM({
      prompt: recipe.outlinePrompt,
      response_json_schema: recipe.outlineSchema,
      max_tokens: recipe.outlineMaxTokens,
      thinking_budget: recipe.outlineThinkingBudget,
    });
  } catch (first) {
    if (shouldPauseGeneration(first)) throw first;
    try {
      return await InvokeLLM({
        prompt: recipe.outlinePrompt,
        response_json_schema: recipe.outlineSchema,
        max_tokens: recipe.outlineMaxTokens,
        thinking_budget: recipe.outlineThinkingBudget,
      });
    } catch {
      throw first; // report the original failure, not the echo
    }
  }
}

/** Run `worker` over `items` with at most `limit` in flight. Never rejects on a worker error. */
export async function pool(items, limit, worker, signal) {
  const size = Math.max(1, Math.min(limit || 1, items.length || 1));
  let cursor = 0;

  const runner = async () => {
    while (cursor < items.length) {
      if (signal?.aborted) return;
      const index = cursor++;
      try {
        await worker(items[index]);
      } catch {
        // Workers own their errors; the pool only owns scheduling.
      }
    }
  };

  await Promise.all(Array.from({ length: size }, runner));
}

function shouldPauseGeneration(err) {
  return [401, 403, 408, 429, 503, 504].includes(err?.status);
}

function messageOf(err) {
  return err?.message || String(err || 'unknown error');
}

/**
 * Re-derive the character reference from a cover that already exists, so a
 * resumed run draws the same child as earlier pages. A durable run pauses
 * illustration when this reference cannot be decoded.
 */
export async function fetchImageAsBase64(url) {
  if (!url || typeof fetch !== 'function') return null;
  try {
    const target = new URL(url, window.location.href);
    const isOwnImage = target.origin === window.location.origin && target.pathname === '/api/img';
    const response = await fetch(url, {
      signal: AbortSignal.timeout(12000),
      ...(isOwnImage && { headers: await getApiAuthHeaders(), redirect: 'error' }),
    });
    if (!response.ok) return null;
    const mime = response.headers.get('content-type')?.split(';')[0].toLowerCase();
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif'].includes(mime)) return null;
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length === 0 || bytes.length > 16 * 1024 * 1024) return null;
    // The storage proxy can respond with a successful HTTP status even when
    // an upstream object is corrupt. Decode it before marking a book complete.
    const blob = new Blob([bytes], { type: mime });
    if (typeof createImageBitmap === 'function') {
      const bitmap = await createImageBitmap(blob);
      bitmap.close();
    } else if (typeof Image !== 'undefined') {
      const src = URL.createObjectURL(blob);
      try {
        const image = new Image();
        image.src = src;
        await image.decode();
      } finally {
        URL.revokeObjectURL(src);
      }
    } else {
      return null;
    }
    let binary = '';
    for (let start = 0; start < bytes.length; start += 32768) {
      binary += String.fromCharCode(...bytes.subarray(start, start + 32768));
    }
    return typeof btoa === 'function' ? btoa(binary) : null;
  } catch {
    return null;
  }
}
