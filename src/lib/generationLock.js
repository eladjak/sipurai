/**
 * Generation run lock — a heartbeat, not a mutex.
 *
 * The problem it solves: a book sitting at `status: "generating"` looks exactly
 * the same whether a tab is generating it right now or whether that tab was
 * closed an hour ago. The reader has to choose between two very different
 * messages ("almost there" vs "this stopped, want to continue?") and the
 * database column cannot tell it which.
 *
 * So a run writes a timestamp to localStorage every {@link HEARTBEAT_MS} while
 * it is alive. A lock older than {@link STALE_AFTER_MS} means nothing is
 * working on the book — a closed tab stops refreshing within one interval, so
 * the truth arrives on its own without any cleanup job.
 *
 * Two deliberate limits, both fail in the safe direction:
 *
 *  - It is per-browser. A run on another device is invisible here, so this
 *    browser will offer to continue a book that is already being built
 *    elsewhere. The cost is duplicated AI calls and possibly a duplicate page
 *    row (deduped on read in bookProgress.js) — never lost or corrupted work.
 *  - If storage is unavailable we report "not live", which offers the user a
 *    Continue button. Offering to resume a finished-ish book is harmless;
 *    hiding the button behind a spinner that never ends is the failure this
 *    whole exercise exists to remove.
 */

export const HEARTBEAT_MS = 15_000;
export const STALE_AFTER_MS = 60_000;

const PREFIX = 'sipurai_gen_run_';

function storage() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    return null; // Safari private mode, blocked cookies, embedded webviews
  }
}

function keyFor(bookId) {
  return `${PREFIX}${bookId}`;
}

/** Is some tab in this browser actively generating this book right now? */
export function isRunLive(bookId, now = Date.now()) {
  if (!bookId) return false;
  const store = storage();
  if (!store) return false;
  try {
    const raw = store.getItem(keyFor(bookId));
    if (!raw) return false;
    const beat = Number(JSON.parse(raw)?.ts);
    if (!Number.isFinite(beat)) return false;
    return now - beat < STALE_AFTER_MS;
  } catch {
    return false;
  }
}

/**
 * Start heartbeating for `bookId`. Returns a release function that is safe to
 * call more than once. The caller MUST call it in a `finally` — but note that
 * failing to (a crashed tab) is precisely the case the staleness window covers,
 * so a missed release costs one minute of wrong wording, not a stuck book.
 */
export function acquireRun(bookId) {
  const store = storage();
  if (!bookId || !store) return () => {};

  let timer = null;
  const beat = () => {
    try {
      store.setItem(keyFor(bookId), JSON.stringify({ ts: Date.now() }));
    } catch {
      // Quota or privacy mode. The run continues; the reader just falls back to
      // "interrupted" wording, which is the honest default anyway.
    }
  };

  beat();
  timer = setInterval(beat, HEARTBEAT_MS);

  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (timer) clearInterval(timer);
    try {
      store.removeItem(keyFor(bookId));
    } catch {
      /* nothing further to do */
    }
  };
}
