/**
 * Story → Video — render guards: per-user budget cap + hash-based cache key.
 *
 * Council (3/3): hard cap on renders per user/month + cache by content hash so
 * an unchanged story is never re-rendered (cost + latency). Pure functions —
 * the actual counters/cache live in Supabase; these just compute the keys and
 * the allow/deny verdict from values the caller supplies.
 */

/**
 * Default per-user render budget (renders / calendar month).
 * Tier-aware: free tier is intentionally tight (Ken-Burns is ~free to render,
 * but renders still consume queue + storage, and this guards abuse).
 */
export const RENDER_BUDGET_BY_TIER = Object.freeze({
  free: 5,
  creator: 30,
  pro: 100,
  premium: 300,
});

/**
 * Deterministic 32-bit FNV-1a hash → hex string. Works in browser + Node
 * without any crypto dependency. Stable across runs for the same input, which
 * is exactly what a cache key needs (NOT a security hash).
 * @param {string} str
 * @returns {string} 8-char hex
 */
export function fnv1a(str) {
  let h = 0x811c9dc5;
  const s = String(str);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    // 32-bit FNV prime multiply via shifts (keeps it in 32-bit range).
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/**
 * Build the canonical, render-affecting fingerprint of a story. Only fields
 * that change the OUTPUT belong here — so editing a title that isn't shown
 * does not bust the cache, but changing page text/image/voice/music does.
 *
 * @param {Object} params
 * @param {Array<{ text:string, imageUrl:(string|null) }>} params.scenes
 * @param {string} [params.voice]
 * @param {string} [params.provider]
 * @param {string} [params.musicBedId]
 * @param {string} [params.language]
 * @param {string} [params.pipelineVersion]
 * @returns {string} cache key (e.g. "sv1:ab12cd34")
 */
export function storyVideoCacheKey({
  scenes = [],
  voice = '',
  provider = '',
  musicBedId = '',
  language = '',
  pipelineVersion = 'v1',
} = {}) {
  const sceneSig = scenes
    .map((s) => `${s.text || ''}|${s.imageUrl || ''}`)
    .join('::');
  const payload = [
    pipelineVersion,
    language,
    provider,
    voice,
    musicBedId,
    sceneSig,
  ].join('§');
  return `sv1:${fnv1a(payload)}`;
}

/**
 * Decide whether a render may proceed.
 *
 * @param {Object} params
 * @param {string} params.tier            - user tier (free/creator/pro/premium)
 * @param {number} params.usedThisMonth   - renders already used this month
 * @param {string} [params.cacheKey]      - computed via storyVideoCacheKey()
 * @param {string|null} [params.cachedVideoUrl] - existing render for this key, if any
 * @returns {{ allowed:boolean, reason:string, cached:boolean, videoUrl:(string|null), remaining:number }}
 */
export function checkRenderBudget({
  tier = 'free',
  usedThisMonth = 0,
  cacheKey = null,
  cachedVideoUrl = null,
}) {
  const limit = RENDER_BUDGET_BY_TIER[tier] ?? RENDER_BUDGET_BY_TIER.free;

  // Cache hit short-circuits the budget entirely — reusing a render is free.
  if (cacheKey && cachedVideoUrl) {
    return {
      allowed: true,
      reason: 'cache-hit',
      cached: true,
      videoUrl: cachedVideoUrl,
      remaining: Math.max(0, limit - usedThisMonth),
    };
  }

  const remaining = Math.max(0, limit - usedThisMonth);
  if (usedThisMonth >= limit) {
    return {
      allowed: false,
      reason: 'budget-exceeded',
      cached: false,
      videoUrl: null,
      remaining: 0,
    };
  }

  return {
    allowed: true,
    reason: 'within-budget',
    cached: false,
    videoUrl: null,
    remaining,
  };
}
