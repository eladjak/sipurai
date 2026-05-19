/**
 * Smart auto-selection — picks the best supported image model for a given prompt.
 *
 * Decision factors (priority order):
 *   1. Hebrew text in prompt   → Gemini wins (Hebrew typography fidelity ≥95% per
 *                                ~/.claude/rules/multi-engine-design-synthesis.md)
 *   2. Photo-realistic style   → DALL-E (gpt-image-1) — best photographic quality
 *   3. Cartoon / illustration  → Gemini — best for kids' book illustration style
 *   4. Sketch / draft / fast   → Gemini — cheapest + fastest for drafts
 *   5. Budget tier             → free → Gemini · creator+ → DALL-E unlocked
 *   6. Default                 → Gemini (cost-tier safe choice for kids' books)
 *
 * Returns one of the SUPPORTED model ids defined below. NEVER returns a
 * "coming soon" id — those are gated by ModelSelector.
 *
 * Created 2026-05-14 for AI Studio smart-model routing.
 */

// ── Supported model registry ─────────────────────────────────────────────────
// IDs match those in ModelSelector.jsx. Anything not in this map is gated as
// "Coming soon" in the UI and can't be picked by the auto selector either.

export const SUPPORTED_MODEL_IDS = Object.freeze({
  GEMINI_FAST: 'gemini-2-5-flash-image',
  GEMINI_PRO: 'gemini-3-pro-image',
  DALLE_3: 'dall-e-3',
});

// Map model id → backend provider + endpoint metadata.
// Consumed by aiProvider.js / Core.js to route the request correctly.
export const MODEL_REGISTRY = Object.freeze({
  [SUPPORTED_MODEL_IDS.GEMINI_FAST]: {
    id: SUPPORTED_MODEL_IDS.GEMINI_FAST,
    provider: 'gemini',
    backendModel: 'gemini-2.5-flash-image',
    tier: 'free',
    label: 'Gemini Fast',
    hebrewQuality: 'medium',
    photoRealism: 'medium',
    illustrationQuality: 'high',
    costTier: 1,
  },
  [SUPPORTED_MODEL_IDS.GEMINI_PRO]: {
    id: SUPPORTED_MODEL_IDS.GEMINI_PRO,
    provider: 'gemini',
    backendModel: 'gemini-3-pro-image-preview',
    tier: 'creator',
    label: 'Gemini 3 Pro',
    hebrewQuality: 'high',
    photoRealism: 'high',
    illustrationQuality: 'excellent',
    costTier: 3,
  },
  [SUPPORTED_MODEL_IDS.DALLE_3]: {
    id: SUPPORTED_MODEL_IDS.DALLE_3,
    provider: 'openai',
    backendModel: 'gpt-image-1',
    tier: 'free',
    label: 'DALL-E 3',
    hebrewQuality: 'low',
    photoRealism: 'excellent',
    illustrationQuality: 'high',
    costTier: 2,
  },
});

// ── Helpers ──────────────────────────────────────────────────────────────────

const HEBREW_RE = /[֐-׿]/;

function hasHebrew(text) {
  return typeof text === 'string' && HEBREW_RE.test(text);
}

const CARTOON_KEYWORDS = /cartoon|illustration|kids|children|whimsical|storybook|מצויר|ילדים|איור|אגדה/i;
const REALISTIC_KEYWORDS = /photo|photograph|realistic|portrait|cinematic|תמונה אמיתית|מציאותי|פוטוריאליסטי/i;
const SKETCH_KEYWORDS = /sketch|draft|rough|quick|wireframe|רישום|טיוטה|מהיר/i;

// ── Tier access ──────────────────────────────────────────────────────────────

const TIER_HIERARCHY = { free: 0, creator: 1, pro: 2, premium: 3 };

function canAccess(model, userTier) {
  return (TIER_HIERARCHY[userTier] ?? 0) >= (TIER_HIERARCHY[model.tier] ?? 0);
}

// ── Main picker ──────────────────────────────────────────────────────────────

/**
 * @param {Object} params
 * @param {string} params.prompt
 * @param {'free'|'creator'|'pro'|'premium'} [params.userTier='free']
 * @param {string} [params.lastManualPick] - id from localStorage smart-default
 * @returns {{ modelId: string, reason: string, model: Object }}
 */
export function pickBestModel({ prompt = '', userTier = 'free', lastManualPick } = {}) {
  const trimmed = String(prompt).trim();
  const promptHasHebrew = hasHebrew(trimmed);
  const isRealistic = REALISTIC_KEYWORDS.test(trimmed);
  const isCartoon = CARTOON_KEYWORDS.test(trimmed);
  const isSketch = SKETCH_KEYWORDS.test(trimmed);

  // Build candidate list filtered by tier access
  const accessible = Object.values(MODEL_REGISTRY).filter((m) => canAccess(m, userTier));

  // Honour last manual pick when prompt is uninformative (no strong signal)
  const noSignal = !promptHasHebrew && !isRealistic && !isCartoon && !isSketch;
  if (noSignal && lastManualPick && MODEL_REGISTRY[lastManualPick]) {
    const lp = MODEL_REGISTRY[lastManualPick];
    if (canAccess(lp, userTier)) {
      return {
        modelId: lp.id,
        reason: 'last-manual-pick',
        model: lp,
      };
    }
  }

  // Rule 1 — Hebrew text → prefer Gemini Pro if accessible, else Gemini Fast
  if (promptHasHebrew) {
    const pro = accessible.find((m) => m.id === SUPPORTED_MODEL_IDS.GEMINI_PRO);
    const fast = accessible.find((m) => m.id === SUPPORTED_MODEL_IDS.GEMINI_FAST);
    const pick = pro || fast;
    if (pick) return { modelId: pick.id, reason: 'hebrew-text', model: pick };
  }

  // Rule 2 — Photo-realistic → DALL-E 3
  if (isRealistic) {
    const dalle = accessible.find((m) => m.id === SUPPORTED_MODEL_IDS.DALLE_3);
    if (dalle) return { modelId: dalle.id, reason: 'realistic-style', model: dalle };
  }

  // Rule 3 — Cartoon / illustration → Gemini Pro if accessible, else Gemini Fast
  if (isCartoon) {
    const pro = accessible.find((m) => m.id === SUPPORTED_MODEL_IDS.GEMINI_PRO);
    const fast = accessible.find((m) => m.id === SUPPORTED_MODEL_IDS.GEMINI_FAST);
    const pick = pro || fast;
    if (pick) return { modelId: pick.id, reason: 'cartoon-style', model: pick };
  }

  // Rule 4 — Sketch / draft → Gemini Fast (cheapest)
  if (isSketch) {
    const fast = accessible.find((m) => m.id === SUPPORTED_MODEL_IDS.GEMINI_FAST);
    if (fast) return { modelId: fast.id, reason: 'sketch-draft', model: fast };
  }

  // Rule 5 — Budget tier defaults
  if (userTier === 'free') {
    const fast = accessible.find((m) => m.id === SUPPORTED_MODEL_IDS.GEMINI_FAST);
    if (fast) return { modelId: fast.id, reason: 'free-tier-default', model: fast };
  }

  // Rule 6 — Fallback to cheapest accessible
  const cheapest = accessible.sort((a, b) => a.costTier - b.costTier)[0];
  if (cheapest) {
    return { modelId: cheapest.id, reason: 'tier-fallback', model: cheapest };
  }

  // Absolute fallback (shouldn't hit — free tier always has Gemini Fast)
  const fast = MODEL_REGISTRY[SUPPORTED_MODEL_IDS.GEMINI_FAST];
  return { modelId: fast.id, reason: 'default-fallback', model: fast };
}

/**
 * Look up the provider routing metadata for a chosen model id.
 * Returns null for unsupported / "coming soon" ids.
 */
export function getModelRouting(modelId) {
  return MODEL_REGISTRY[modelId] || null;
}

export function isModelSupported(modelId) {
  return modelId in MODEL_REGISTRY;
}
