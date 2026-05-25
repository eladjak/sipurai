/**
 * Story → Video — shared constants.
 *
 * Council MVP verdict (2026-05-25, unanimous): Remotion + Ken Burns + existing
 * Gemini TTS. AI image-to-video (Seedance/fal) is PREMIUM later, NOT MVP.
 *
 * These constants are the single source of truth for both the pure pipeline
 * (src/lib/storyVideo/*) and the Remotion composition (src/remotion/*).
 */

/** Video frame rate. 30fps is plenty for Ken-Burns (no fast motion). */
export const FPS = 30;

/** Output resolution — 16:9 1080p, the safe default for web + social. */
export const VIDEO_WIDTH = 1920;
export const VIDEO_HEIGHT = 1080;

/**
 * Fallback per-scene duration (ms) when narration audio/duration is unavailable
 * (e.g. UI stub, or a page with no narration yet). Gives the Ken-Burns pan room.
 */
export const DEFAULT_SCENE_MS = 6000;

/** Minimum scene duration (ms) — even a 2-word page should breathe. */
export const MIN_SCENE_MS = 3000;

/**
 * Padding added after each page's narration (ms) so the caption + image linger
 * briefly before the cut. Keeps the cut from clipping the last word.
 */
export const SCENE_TAIL_PADDING_MS = 900;

/**
 * Cross-fade / transition window between scenes (ms). transform/opacity only.
 * Kept short per the global animation rule (feedback ≤200ms, but scene
 * transitions read better a touch longer — 500ms is a gentle storybook cut).
 */
export const TRANSITION_MS = 500;

/** Music bed target loudness relative to narration (council: duck to ~-18 LUFS). */
export const MUSIC_VOLUME = 0.12;

/** Narration playback volume (full). */
export const NARRATION_VOLUME = 1.0;

/** Ken-Burns zoom envelope — start/end scale. transform only (GPU-friendly). */
export const KEN_BURNS_ZOOM_FROM = 1.0;
export const KEN_BURNS_ZOOM_TO = 1.12;

/** Max pan offset as a fraction of the frame (subtle drift, not a swoop). */
export const KEN_BURNS_PAN_FRACTION = 0.04;

/** RTL languages — caption alignment + direction follow the book language. */
export const RTL_LANGUAGES = ['hebrew', 'yiddish'];

/** Default royalty-free music bed placeholder (resolved by music.js). */
export const DEFAULT_MUSIC_BED = {
  id: 'calm-kids-bed',
  // Placeholder: a real royalty-free track (Epidemic "Kids & Family" / Artlist)
  // gets dropped into /public/audio/ and referenced via staticFile() at render.
  url: null,
  mood: 'calm',
  license: 'royalty-free-placeholder',
};

/** Render job status state machine (council: async/queue, never sync). */
export const VIDEO_STATUS = Object.freeze({
  NONE: 'none',
  QUEUED: 'queued',
  RENDERING: 'rendering',
  READY: 'ready',
  FAILED: 'failed',
});
