/**
 * Story → Video — scene timing (pure functions).
 *
 * Turns a story's pages[] + per-page narration durations into a frame-accurate
 * timeline the Remotion composition can consume. No I/O, no React — fully
 * unit-testable.
 */

import {
  FPS,
  DEFAULT_SCENE_MS,
  MIN_SCENE_MS,
  SCENE_TAIL_PADDING_MS,
  RTL_LANGUAGES,
} from './constants.js';

/** ms → whole frames (rounded up so audio never gets clipped). */
export function msToFrames(ms, fps = FPS) {
  if (!Number.isFinite(ms) || ms <= 0) return 0;
  return Math.ceil((ms / 1000) * fps);
}

/** frames → ms. */
export function framesToMs(frames, fps = FPS) {
  if (!Number.isFinite(frames) || frames <= 0) return 0;
  return Math.round((frames / fps) * 1000);
}

/** Is this book language right-to-left? */
export function isRtlLanguage(language) {
  return RTL_LANGUAGES.includes(String(language || '').toLowerCase());
}

/**
 * Normalize a single story page into a uniform scene shape.
 * Tolerates both the demo shape ({ pageNumber, text, textEn, imagePrompt })
 * and the canonical shape ({ text, image_url }).
 *
 * @param {object} page
 * @param {number} index
 * @param {{ language?: string }} [opts]
 * @returns {{ index:number, text:string, imageUrl:(string|null), narrationMs:(number|null) }}
 */
export function normalizePage(page, index, opts = {}) {
  const language = opts.language;
  const useEnglish = language && String(language).toLowerCase() === 'english';
  const text =
    (useEnglish ? page?.textEn : page?.text) ??
    page?.text ??
    page?.textEn ??
    '';

  const imageUrl =
    page?.image_url ??
    page?.imageUrl ??
    page?.image ??
    page?.illustration_url ??
    null;

  // Narration duration may be supplied per page (from cached TTS) under several keys.
  const narrationMs =
    firstNumber(page?.narrationMs, page?.duration_ms, page?.durationMs) ?? null;

  return { index, text: String(text), imageUrl, narrationMs };
}

function firstNumber(...vals) {
  for (const v of vals) {
    if (Number.isFinite(v) && v > 0) return v;
  }
  return null;
}

/**
 * Compute the duration (ms) for one scene given its narration length.
 * Falls back to DEFAULT_SCENE_MS, clamps to MIN_SCENE_MS, and always adds a
 * tail pad so the cut never clips the last narrated word.
 *
 * @param {number|null} narrationMs
 * @returns {number} duration in ms
 */
export function sceneDurationMs(narrationMs) {
  const base =
    Number.isFinite(narrationMs) && narrationMs > 0
      ? narrationMs + SCENE_TAIL_PADDING_MS
      : DEFAULT_SCENE_MS;
  return Math.max(MIN_SCENE_MS, Math.round(base));
}

/**
 * Build the full frame-accurate timeline from normalized scenes.
 * Each scene gets { index, text, imageUrl, durationMs, durationFrames,
 * startFrame, endFrame }. Scenes are laid back-to-back (hard cuts; the
 * composition applies a transform/opacity transition within each scene).
 *
 * @param {Array} pages - raw story pages
 * @param {{ language?: string, narrationDurations?: number[] }} [opts]
 * @returns {{ fps:number, totalFrames:number, totalMs:number, scenes:Array }}
 */
export function buildTimeline(pages, opts = {}) {
  const list = Array.isArray(pages) ? pages : [];
  const { language, narrationDurations } = opts;

  let cursorFrame = 0;
  const scenes = list.map((page, i) => {
    const norm = normalizePage(page, i, { language });
    // Per-page narration override (e.g. measured after synthesize()).
    const narrationMs =
      Array.isArray(narrationDurations) && Number.isFinite(narrationDurations[i])
        ? narrationDurations[i]
        : norm.narrationMs;

    const durationMs = sceneDurationMs(narrationMs);
    const durationFrames = Math.max(1, msToFrames(durationMs));
    const startFrame = cursorFrame;
    const endFrame = startFrame + durationFrames;
    cursorFrame = endFrame;

    return {
      index: i,
      text: norm.text,
      imageUrl: norm.imageUrl,
      narrationMs: narrationMs ?? null,
      durationMs,
      durationFrames,
      startFrame,
      endFrame,
    };
  });

  const totalFrames = cursorFrame;
  return {
    fps: FPS,
    totalFrames,
    totalMs: framesToMs(totalFrames),
    scenes,
  };
}
