import { normalizeOutline, generateBookIncremental, callOutline } from './bookGeneration';
import { buildRecipe } from './bookRecipe';
import { normalizePages, isPageReady } from './bookProgress';
import { editedPages } from './storyManuscript';
import { newBookKey, reserveBookSlot } from './bookQuota';
import { toAppImageUrl } from './imageUrl';

const fieldsForComparison = ['text_content', 'image_url', 'image_prompt', 'layout_type'];

function snapshot(row) {
  return Object.fromEntries(fieldsForComparison.map(field => [field, row[field] ?? null]));
}

function usableOutline(pages, total) {
  const byNumber = new Map(pages.map(page => [page.page_number, page]));
  return Array.from({ length: total }, (_, page_number) => {
    const existing = byNumber.get(page_number);
    return { page_number, description: existing?.text_content || existing?.image_prompt || '' };
  });
}

/**
 * Bind the incremental writer to one fenced database lease. The service owns
 * identity, ownership, CAS and the transaction that publishes the manuscript.
 */
export async function generateDurableBook({ storage, entities, ai, recipe, bookId, newBookId, allowLegacyReservation, onEvent = (_event) => {}, ...options }) {
  const fresh = !bookId;
  const id = bookId || newBookId;
  if (!id) throw new Error('A generation run needs its permanent book key.');
  const runId = newBookKey();
  let book;
  let seed;
  let createBook;
  if (fresh) {
    const outline = await callOutline(ai.InvokeLLM, recipe);
    recipe.applyCastSheet?.(outline.cast);
    const title = recipe.sanitize(recipe.approvedTitle || outline.title || recipe.bookFields.title);
    const plan = normalizeOutline(outline.outline, recipe.pageCount);
    seed = { recipe: recipe.checkpointInputs(), plan };
    createBook = { ...recipe.bookFields, title, total_pages: plan.length };
  } else {
    book = await entities.Book.get(id);
    if (!book) throw new Error('Book unavailable');
  }

  const claim = { bookId: id, runId };
  if (!fresh && allowLegacyReservation) {
    const saved = normalizePages(await entities.Page.filter({ book_id: id }, 'page_number'));
    seed = { recipe: recipe.checkpointInputs(), plan: usableOutline(saved, Number(book.total_pages) || recipe.pageCount) };
  }
  if (allowLegacyReservation) {
    // Historical books have no trusted association with their original slot.
    // The reader offers this explicitly after a provenance_missing response.
    const reservation = await reserveBookSlot(id);
    if (reservation?.skipped) throw new Error('Reservation unavailable');
  }
  const lease = await storage.acquire({
    ...claim, ...((fresh || allowLegacyReservation) && { newQuotaKey: id }),
    ...(seed && { seed }), ...(fresh && { createBook }),
  });
  // This row and the private recipe are committed in the same transaction.
  // Raw stored values also allow safe comparisons for historical bucket URLs.
  book = lease.book;

  const fence = { ...claim, fence: lease.fence };
  let lost = false;
  const heartbeat = setInterval(async () => {
    try { await storage.renew(fence); } catch { lost = true; }
  }, 20000);
  function checkLease() {
    if (lost) throw Object.assign(new Error('Generation moved to another session'), { code: 'lease_lost' });
  }
  try {
    if (!book?.id) throw new Error('Storage did not confirm the book');
    if (fresh) onEvent({ type: 'book-created', bookId: id, title: book.title, total: book.total_pages });
    const checkpoint = lease.checkpoint || lease.seed || seed || {};
    if (!fresh && !allowLegacyReservation) {
      // acquire proves the key before a reservation request can consume a slot.
      const reservation = await reserveBookSlot(lease.quotaKey);
      if (reservation?.skipped) throw new Error('Reservation unavailable');
    }
    const existing = normalizePages(await entities.Page.filter({ book_id: id }, 'page_number'));
    const lockedRecipe = checkpoint.recipe ? buildRecipe({ ...checkpoint.recipe, bookData: { ...checkpoint.recipe.bookData, title: book.title } }) : recipe;
    const total = Number(book.total_pages) || lockedRecipe.pageCount;
    const plan = checkpoint.plan || usableOutline(existing, total);
    let persisted = checkpoint;
    if (!checkpoint.manuscriptSaved) {
      let manuscript = null;
      if (lockedRecipe.manuscriptRequest) {
        onEvent({ type: 'phase', phase: 'editing' });
        // A failed shared service pauses this book. The original private plan
        // remains on the server for the next attempt with the same reservation.
        manuscript = editedPages(await ai.InvokeLLM(lockedRecipe.manuscriptRequest(plan, book.title)), total);
        if (!manuscript) throw Object.assign(new Error('Incomplete edited manuscript'), { code: 'manuscript_incomplete' });
      }
      const existingByNumber = new Map(existing.map(page => [page.page_number, page]));
      const drawingPrompts = [];
      const skeletons = plan.map((beat, i) => {
        const old = existingByNumber.get(i);
        const content = manuscript?.[i] || lockedRecipe.pageTextOverride?.(i);
        const text = isPageReady(old) ? old.text_content : lockedRecipe.sanitize(lockedRecipe.readPageText(content) || '');
        const hint = old?.image_prompt || content?.image_prompt || beat.description;
        const page = { page_number: i, text_content: text, image_prompt: hint, layout_type: old?.layout_type || lockedRecipe.layoutFor(i) };
        drawingPrompts[i] = lockedRecipe.imagePrompt(page, i, { reference: true });
        return page;
      });
      const inputs = checkpoint.recipe || lockedRecipe.checkpointInputs();
      persisted = { recipe: inputs, plan, scenes: inputs.scenes || [], cast: inputs.characters || [],
        manuscript: skeletons, drawingPrompts, manuscriptSaved: true };
      checkLease();
      await storage.savePlan({ ...fence, checkpoint: persisted, skeletons });
      onEvent({ type: 'plan-saved', bookId: id, total });
      if (skeletons.some(isPageReady)) onEvent({ type: 'page-text', index: 0, bookId: id, ready: skeletons.filter(isPageReady).length, total, illustrated: 0 });
    }
    // Raw URLs are retained for conditional updates; the UI-facing entity
    // normally translates historical bucket links to their current proxy.
    const rows = await storage.listRows(fence);
    const seen = new Map(rows.map(row => [row.id, row]));
    // Sequence cover and progress updates from the same worker. An editor in
    // another tab remains protected by the database's conditional update.
    let bookWrites = Promise.resolve();
    const writeBook = async patch => {
      checkLease();
      const expected = { status: book.status ?? null, cover_image: book.cover_image ?? null };
      if ('total_pages' in patch) Object.assign(expected, { total_pages: book.total_pages });
      await storage.bookWrite({ ...fence, expected, patch });
      book = { ...book, ...patch };
      return book;
    };
    function queueBookWrite(patch) {
      bookWrites = bookWrites.then(() => writeBook(patch));
      return bookWrites;
    }
    // A repair is a transaction on an unfinished book. Invalidate the old
    // completion claim before replacing any artwork, then validate it anew.
    const startRepair = () => {
      bookWrites = bookWrites.then(() => book.status === 'complete' ? writeBook({ status: 'partial' }) : book);
      return bookWrites;
    };
    const storedEntities = {
      Book: {
        get: async () => book,
        update: (_id, patch) => {
          if ('cover_image' in patch) startRepair();
          return queueBookWrite(patch);
        },
      },
      Page: {
        filter: async () => [...seen.values()],
        update: async (pageId, patch) => {
          checkLease();
          const previous = seen.get(pageId);
          if (!previous) throw new Error('Missing generation page');
          await startRepair();
          await storage.commitPages({ ...fence, items: [{ id: pageId, expected: snapshot(previous), patch }] });
          const next = { ...previous, ...patch };
          seen.set(pageId, next);
          return next;
        },
      },
    };
    const resolvedRecipe = { ...lockedRecipe, requireReference: true,
      imagePrompt: (page, index, context) => persisted.drawingPrompts?.[index] || lockedRecipe.imagePrompt(page, index, context),
    };
    return await generateBookIncremental({ entities: storedEntities, ai, recipe: resolvedRecipe, bookId: id, onEvent, ...options,
      fetchReference: async url => {
        const { fetchImageAsBase64 } = await import('./bookGeneration');
        return (options.fetchReference || fetchImageAsBase64)(toAppImageUrl(url));
      },
    });
  } catch (error) {
    error.bookId = id;
    throw error;
  } finally {
    clearInterval(heartbeat);
    await storage.release(fence).catch(() => {});
  }
}
