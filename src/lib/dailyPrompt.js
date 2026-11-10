/**
 * Daily story idea shown on the home page.
 *
 * Why this exists: Home used to cache the idea only AFTER the AI call finished
 * (4-8s). The effect re-runs when the user object changes, so a second run started
 * before the first one had written the cache and the model was called twice per
 * visit. The cache was also one slot shared by every language.
 *
 * Now: one cache entry per language per day, and concurrent callers share a
 * single in-flight request.
 */

const inflight = new Map();

function cacheKey(lang) {
  return `dailyPrompt:${lang}`;
}

function readCache(lang, today) {
  try {
    const raw = localStorage.getItem(cacheKey(lang));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.date === today && parsed.value) return parsed.value;
  } catch {
    // storage blocked or corrupt entry: behave as a cache miss
  }
  return null;
}

function writeCache(lang, today, value) {
  try {
    localStorage.setItem(cacheKey(lang), JSON.stringify({ date: today, value }));
  } catch {
    // storage full or blocked: not fatal, we just ask again next time
  }
}

/**
 * @param {string} lang language key ("hebrew" | "english" | "yiddish")
 * @param {() => Promise<object|null>} generate called only on a cache miss
 * @param {string} [today] injectable for tests
 * @returns {Promise<object|null>}
 */
export function getDailyPrompt(lang, generate, today = new Date().toDateString()) {
  const cached = readCache(lang, today);
  if (cached) return Promise.resolve(cached);

  const key = `${lang}|${today}`;
  if (inflight.has(key)) return inflight.get(key);

  const request = (async () => {
    const result = await generate();
    if (result) writeCache(lang, today, result);
    return result;
  })().finally(() => inflight.delete(key));

  inflight.set(key, request);
  return request;
}
