/**
 * Central model registry — the ONE place that names an AI model id.
 *
 * Why this exists (4.11.2026): model ids were hardcoded in 8 files; Google is retiring
 * several of them (see `retireAfter`) and nothing tied the FAQ bot to the generation model.
 * Handlers must call `getModel(capability)`; a unit test fails the build if a model id
 * appears anywhere else under api/ or in src/lib/aiProvider.js / ttsProvider.js.
 *
 * Pure ESM, no top-level access to process.env, so the browser bundle (dev-direct mode in
 * aiProvider.js) can import it too. Env is read at call time (testable, no cold-start capture).
 *
 * Lifecycle source: https://aistudio.google.com/docs/deprecations, read 2026-11-04.
 * Google says listed dates are the EARLIEST possible retirement.
 */

export const REGISTRY_VERSION = '2026-11-04.1';

export const MODELS = Object.freeze({
  // Story text AND the FAQ bot share this entry (the FAQ used to hardcode its own copy).
  // gemini-2.5-flash: Google auto-routes it to gemini-3.5-flash-lite on 2026-12-01.
  // Pinned on purpose in this release: switching the text model needs a Hebrew-quality
  // evaluation first. TODO(2026-11 .. before 2026-12-01): evaluate gemini-3.5-flash-lite vs a
  // pinned newer Flash, then change `default` here (or set GEMINI_TEXT_MODEL in Vercel).
  text: {
    provider: 'gemini',
    default: 'gemini-2.5-flash',
    envVar: 'GEMINI_TEXT_MODEL',
    status: 'ga',
    retireAfter: '2026-12-01',
    fallbacks: [],
  },
  // Cost-tier image model (default for all users).
  // Google lists shutdown 2027-03-15, replacement gemini-3.1-flash-lite-image (not adopted: unevaluated).
  imageDefault: {
    provider: 'gemini',
    default: 'gemini-2.5-flash-image',
    envVar: 'GEMINI_IMAGE_MODEL',
    status: 'ga',
    retireAfter: '2027-03-15',
    fallbacks: [],
  },
  // "Gemini 3 Pro" image tier. The old id gemini-3-pro-image-preview is listed by Google with
  // shutdown 2026-06-25 (already past) and replacement gemini-3-pro-image. If the pro model
  // errors, the handler falls back to the cost-tier image model.
  imagePro: {
    provider: 'gemini',
    default: 'gemini-3-pro-image',
    envVar: 'GEMINI_PRO_IMAGE_MODEL',
    status: 'ga',
    retireAfter: null,
    fallbacks: ['gemini-2.5-flash-image'],
  },
  // OpenAI image generation + edit (UI label used to say "DALL-E 3"; this is what is called).
  imageOpenai: {
    provider: 'openai',
    default: 'gpt-image-1',
    envVar: 'OPENAI_IMAGE_MODEL',
    status: 'ga',
    retireAfter: null,
    fallbacks: [],
  },
  ttsOpenai: {
    provider: 'openai',
    default: 'gpt-4o-mini-tts',
    envVar: 'OPENAI_TTS_MODEL',
    status: 'ga',
    retireAfter: null,
    fallbacks: [],
  },
  // gemini-2.5-flash-preview-tts shuts down 2026-11-17 (earliest). Listed replacements:
  // gemini-3.8-flash-tts or gemini-3.8-flash-lite-tts (verified on Google's speech page 2026-11-04).
  // Not verified by a live call (no paid probe was authorised); the handler falls back to OpenAI TTS.
  ttsGemini: {
    provider: 'gemini',
    default: 'gemini-3.8-flash-tts',
    envVar: 'GEMINI_TTS_MODEL',
    status: 'ga',
    retireAfter: null,
    fallbacks: [],
  },
});

function defaultEnv() {
  return typeof process !== 'undefined' && process.env ? process.env : {};
}

/** Resolve the model id for a capability. A non-empty env override wins. */
export function getModel(capability, env = defaultEnv()) {
  const entry = MODELS[capability];
  if (!entry) throw new Error(`Unknown model capability: ${capability}`);
  const override = env?.[entry.envVar];
  return typeof override === 'string' && override.trim() ? override.trim() : entry.default;
}

/** Ordered list [primary, ...fallbacks], without duplicates. */
export function getModelChain(capability, env = defaultEnv()) {
  const entry = MODELS[capability];
  if (!entry) throw new Error(`Unknown model capability: ${capability}`);
  return [...new Set([getModel(capability, env), ...entry.fallbacks])];
}
