import {
  normalizeOutline,
  generateBookIncremental,
  callOutline,
  resolveBookTitle,
} from "./bookGeneration";
import { buildRecipe } from "./bookRecipe";
import { normalizePages, isPageReady, isPageIllustrated } from "./bookProgress";
import { editedPages } from "./storyManuscript";
import { newBookKey, reserveBookSlot } from "./bookQuota";
import { toAppImageUrl } from "./imageUrl";

const fieldsForComparison = [
  "text_content",
  "image_url",
  "image_prompt",
  "layout_type",
];

function snapshot(row) {
  return Object.fromEntries(
    fieldsForComparison.map((field) => [field, row[field] ?? null]),
  );
}

function usableOutline(pages, total) {
  const byNumber = new Map(pages.map((page) => [page.page_number, page]));
  return Array.from({ length: total }, (_, page_number) => {
    const existing = byNumber.get(page_number);
    return {
      page_number,
      description: existing?.text_content || existing?.image_prompt || "",
    };
  });
}

// The first editor persisted numbered pages but could finish without storing their count.
function historicalPageCount(book, pages, suggestedCount) {
  if (book.total_pages > 0) return book.total_pages;
  const contiguous = pages.length > 0 && pages.every((page, i) => page.page_number === i);
  const lastNumber = pages.at(-1)?.page_number ?? -1;
  const count = book.status === "complete" ? pages.length : Math.max(suggestedCount, lastNumber + 1);
  if ((book.status === "complete" && !contiguous) || !Number.isInteger(count) || count < 1 || count > 100)
    throw Object.assign(new Error("Cannot determine the original page count"), { code: "legacy_count_unknown" });
  return count;
}

/**
 * Bind the incremental writer to one fenced database lease. The service owns
 * identity, ownership, CAS and the transaction that publishes the manuscript.
 */
export async function generateDurableBook({
  storage,
  entities,
  ai,
  recipe,
  bookId,
  newBookId,
  allowLegacyReservation,
  automaticRecoveryOwnerId,
  onEvent = (_event) => {},
  ...options
}) {
  const automaticRecovery = Boolean(automaticRecoveryOwnerId);
  const recoveryUnavailable = () => Object.assign(
    new Error("Automatic recovery requires a private book with a complete durable manuscript and missing art"),
    { code: "automatic_recovery_unavailable" },
  );
  if (automaticRecovery && (!bookId || allowLegacyReservation)) throw recoveryUnavailable();
  const fresh = !bookId;
  const id = bookId || newBookId;
  if (!id) throw new Error("A generation run needs its permanent book key.");
  const runId = newBookKey();
  let book;
  let seed;
  let createBook;
  if (fresh) {
    const outline = await callOutline(ai.InvokeLLM, recipe);
    recipe.applyCastSheet?.(outline.cast);
    const title = resolveBookTitle(recipe, outline.title);
    const plan = normalizeOutline(outline.outline, recipe.pageCount);
    seed = { recipe: recipe.checkpointInputs(), plan };
    createBook = { ...recipe.bookFields, title, total_pages: plan.length };
  } else {
    book = await entities.Book.get(id);
    if (!book) throw new Error("Book unavailable");
    if (automaticRecovery && (book.is_public !== false || book.created_by !== automaticRecoveryOwnerId)) {
      throw recoveryUnavailable();
    }
  }

  const claim = { bookId: id, runId };
  if (!fresh && allowLegacyReservation) {
    const saved = normalizePages(
      await entities.Page.filter({ book_id: id }, "page_number"),
    );
    seed = {
      recipe: recipe.checkpointInputs(),
      plan: usableOutline(saved, historicalPageCount(book, saved, recipe.pageCount)),
    };
  }
  if (allowLegacyReservation) {
    // Historical books have no trusted association with their original slot.
    // The reader offers this explicitly after a provenance_missing response.
    const reservation = await reserveBookSlot(id);
    if (reservation?.skipped) throw new Error("Reservation unavailable");
  }
  const lease = await storage.acquire({
    ...claim,
    ...((fresh || allowLegacyReservation) && { newQuotaKey: id }),
    ...(seed && { seed }),
    ...(fresh && { createBook }),
  });
  // This row and the private recipe are committed in the same transaction.
  // Raw stored values also allow safe comparisons for historical bucket URLs.
  book = lease.book;

  const fence = { ...claim, fence: lease.fence };
  let lost = false;
  const heartbeat = setInterval(async () => {
    try {
      await storage.renew(fence);
    } catch {
      lost = true;
    }
  }, 20000);
  function checkLease() {
    if (lost)
      throw Object.assign(new Error("Generation moved to another session"), {
        code: "lease_lost",
      });
  }
  try {
    if (!book?.id) throw new Error("Storage did not confirm the book");
    if (fresh)
      onEvent({
        type: "book-created",
        bookId: id,
        title: book.title,
        total: book.total_pages,
      });
    const checkpoint = lease.checkpoint || lease.seed || seed || {};
    let recoveryRows;
    if (automaticRecovery) {
      if (book.id !== id || book.created_by !== automaticRecoveryOwnerId || book.is_public !== false ||
          lease.quotaKey !== id || !Number.isSafeInteger(lease.fence) || lease.fence < 1 ||
          !lease.checkpoint || !checkpoint.recipe || checkpoint.manuscriptSaved !== true || !Number.isInteger(book.total_pages) ||
          book.total_pages < 1 || checkpoint.plan?.length !== book.total_pages) {
        throw recoveryUnavailable();
      }
      recoveryRows = await storage.listRows(fence);
      const pages = normalizePages(recoveryRows);
      if (recoveryRows.length !== book.total_pages || pages.length !== book.total_pages ||
          pages.some((page, i) => page.page_number !== i || !isPageReady(page) ||
            (!isPageIllustrated(page) && !checkpoint.drawingPrompts?.[i]?.trim())) ||
          (book.cover_image?.trim() && pages.every(isPageIllustrated))) {
        throw recoveryUnavailable();
      }
    } else if (!fresh && !allowLegacyReservation) {
      // Manual recovery retains the existing quota confirmation behavior.
      const reservation = await reserveBookSlot(lease.quotaKey);
      if (reservation?.skipped) throw new Error("Reservation unavailable");
    }
    const existing = normalizePages(
      recoveryRows || await entities.Page.filter({ book_id: id }, "page_number"),
    );
    const lockedRecipe = checkpoint.recipe
      ? buildRecipe({
          ...checkpoint.recipe,
          bookData: { ...checkpoint.recipe.bookData, title: book.title },
        })
      : recipe;
    const writeBook = async (patch) => {
      checkLease();
      const expected = {
        status: book.status ?? null,
        cover_image: book.cover_image ?? null,
      };
      if ("total_pages" in patch)
        Object.assign(expected, { total_pages: book.total_pages ?? null });
      await storage.bookWrite({ ...fence, expected, patch });
      book = { ...book, ...patch };
      return book;
    };
    const total = Number(book.total_pages) || checkpoint.plan?.length || lockedRecipe.pageCount;
    const plan = checkpoint.plan || usableOutline(existing, total);
    let persisted = checkpoint;
    // SQL requires reopening a completed book as a status-only write. Then
    // recover a historical null count under the same lease and compare-and-swap.
    if (book.status === "complete" && (!checkpoint.manuscriptSaved || !book.total_pages))
      await writeBook({ status: "partial" });
    if (!book.total_pages)
      await writeBook({ total_pages: total });
    if (!checkpoint.manuscriptSaved) {
      const existingByNumber = new Map(
        existing.map((page) => [page.page_number, page]),
      );
      const needsText = plan.some((_, i) => !isPageReady(existingByNumber.get(i)));
      let manuscript = null;
      if (needsText && lockedRecipe.manuscriptRequest) {
        onEvent({ type: "phase", phase: "editing" });
        // A failed shared service pauses this book. The original private plan
        // remains on the server for the next attempt with the same reservation.
        manuscript = editedPages(
          await ai.InvokeLLM(lockedRecipe.manuscriptRequest(plan, book.title)),
          total,
        );
        if (!manuscript)
          throw Object.assign(new Error("Incomplete edited manuscript"), {
            code: "manuscript_incomplete",
          });
      }
      const drawingPrompts = [];
      const skeletons = plan.map((beat, i) => {
        const old = existingByNumber.get(i);
        const content = manuscript?.[i] || lockedRecipe.pageTextOverride?.(i);
        const text = isPageReady(old)
          ? old.text_content
          : lockedRecipe.sanitize(lockedRecipe.readPageText(content) || "");
        const hint =
          old?.image_prompt || content?.image_prompt || beat.description;
        const page = {
          page_number: i,
          text_content: text,
          image_prompt: hint,
          layout_type: old?.layout_type || lockedRecipe.layoutFor(i),
        };
        drawingPrompts[i] = lockedRecipe.imagePrompt(page, i, {
          reference: true,
        });
        return page;
      });
      const inputs = checkpoint.recipe || lockedRecipe.checkpointInputs();
      persisted = {
        recipe: inputs,
        plan,
        scenes: inputs.scenes || [],
        cast: inputs.characters || [],
        manuscript: skeletons,
        drawingPrompts,
        manuscriptSaved: true,
      };
      checkLease();
      await storage.savePlan({ ...fence, checkpoint: persisted, skeletons });
      onEvent({ type: "plan-saved", bookId: id, total });
      if (skeletons.some(isPageReady))
        onEvent({
          type: "page-text",
          index: 0,
          bookId: id,
          ready: skeletons.filter(isPageReady).length,
          total,
          illustrated: 0,
        });
    }
    // Raw URLs are retained for conditional updates; the UI-facing entity
    // normally translates historical bucket links to their current proxy.
    const rows = recoveryRows || await storage.listRows(fence);
    const seen = new Map(rows.map((row) => [row.id, row]));
    // Sequence cover and progress updates from the same worker. An editor in
    // another tab remains protected by the database's conditional update.
    let bookWrites = Promise.resolve();
    function queueBookWrite(patch) {
      bookWrites = bookWrites.then(() => writeBook(patch));
      return bookWrites;
    }
    // A repair is a transaction on an unfinished book. Invalidate the old
    // completion claim before replacing any artwork, then validate it anew.
    const startRepair = () => {
      bookWrites = bookWrites.then(() =>
        book.status === "complete" ? writeBook({ status: "partial" }) : book,
      );
      return bookWrites;
    };
    const storedEntities = {
      Book: {
        get: async () => book,
        update: (_id, patch) => {
          if ("cover_image" in patch) startRepair();
          return queueBookWrite(patch);
        },
      },
      Page: {
        filter: async () => [...seen.values()],
        update: async (pageId, patch) => {
          checkLease();
          const previous = seen.get(pageId);
          if (!previous) throw new Error("Missing generation page");
          await startRepair();
          await storage.commitPages({
            ...fence,
            items: [{ id: pageId, expected: snapshot(previous), patch }],
          });
          const next = { ...previous, ...patch };
          seen.set(pageId, next);
          return next;
        },
      },
    };
    const resolvedRecipe = {
      ...lockedRecipe,
      requireReference: true,
      imagePrompt: (page, index, context) =>
        persisted.drawingPrompts?.[index] ||
        lockedRecipe.imagePrompt(page, index, context),
    };
    const recoveryAI = automaticRecovery ? {
      InvokeLLM: async () => { throw recoveryUnavailable(); },
      GenerateImage: async (params) => {
        checkLease();
        // Validate the fence before every paid operation, including after the
        // cover fetch. Pass the proven reservation without reserving again.
        await storage.renew(fence);
        checkLease();
        return ai.GenerateImage({ ...params, bookKey: lease.quotaKey, modelId: "gemini-2-5-flash-image" });
      },
    } : ai;
    return await generateBookIncremental({
      entities: storedEntities,
      ai: recoveryAI,
      recipe: resolvedRecipe,
      bookId: id,
      onEvent,
      ...options,
      ...(automaticRecovery && {
        concurrency: 1,
        keepStoredArt: true,
        repairPages: [],
        repairCover: !book.cover_image?.trim(),
      }),
      fetchReference: async (url) => {
        const { fetchImageAsBase64 } = await import("./bookGeneration");
        return (options.fetchReference || fetchImageAsBase64)(
          toAppImageUrl(url),
        );
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
