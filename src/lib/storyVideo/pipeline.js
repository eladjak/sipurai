/**
 * Story → Video — pipeline orchestrator.
 *
 * Builds the complete Remotion render input from a story:
 *   1. normalize pages → scenes (timing.js)
 *   2. synthesize narration per page (injected synth fn → audio url + duration)
 *   3. compute frame-accurate timeline
 *   4. resolve a royalty-free music bed (music.js)
 *   5. run multi-layer moderation hook (moderation.js, allow-by-default MVP)
 *   6. compute the cache key + budget verdict (budget.js)
 *
 * Network only happens through the INJECTED `synthesize` fn, so the orchestrator
 * itself is unit-testable with a fake synth. Returns a Result (resultHelper.js).
 */

import { Result } from '../resultHelper.js';
import { getDefaultVoice } from '../ttsProvider.js';
import { buildTimeline, normalizePage, isRtlLanguage } from './timing.js';
import { resolveMusicBed } from './music.js';
import { moderateStory, noopModerator } from './moderation.js';
import { storyVideoCacheKey, checkRenderBudget } from './budget.js';
import { VIDEO_WIDTH, VIDEO_HEIGHT, FPS } from './constants.js';

/**
 * Synthesize narration for every page, returning audio urls + measured durations.
 * The synth fn must match ttsProvider.synthesize's resolved shape, but we also
 * accept a `durationMs` it may attach (the real provider doesn't measure length,
 * so callers can measure via an <audio> element or ffprobe and pass it in).
 *
 * @param {Array} scenes - normalized scenes
 * @param {Object} opts
 * @param {(args:Object)=>Promise<{url:string, durationMs?:number}>} opts.synthesize
 * @param {string} opts.provider
 * @param {string} opts.voice
 * @param {string} opts.language
 * @returns {Promise<Result<Array<{audioUrl:(string|null), durationMs:(number|null)}>>>}
 */
export async function synthesizeNarration(scenes, opts) {
  const { synthesize, provider, voice, language } = opts;
  if (typeof synthesize !== 'function') {
    return Result.err(new Error('synthesizeNarration: synthesize fn required'));
  }
  try {
    const results = [];
    for (const scene of scenes) {
      const text = (scene.text || '').trim();
      if (!text) {
        results.push({ audioUrl: null, durationMs: null });
        continue;
      }
      const out = await synthesize({ text, provider, voice, language });
      results.push({
        audioUrl: out?.url ?? null,
        durationMs: Number.isFinite(out?.durationMs) ? out.durationMs : null,
      });
    }
    return Result.ok(results);
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    return Result.err(error);
  }
}

/**
 * Build the full Remotion input props for a story.
 *
 * @param {Object} story - { pages:[], language?, genre?, mood?, title? }
 * @param {Object} [opts]
 * @param {(args:Object)=>Promise<{url:string, durationMs?:number}>} [opts.synthesize]
 *        - injected TTS. If omitted, narration is skipped (durations fall back).
 * @param {string} [opts.provider='gemini']
 * @param {string} [opts.voice]            - defaults via getDefaultVoice()
 * @param {string} [opts.tier='free']
 * @param {number} [opts.usedThisMonth=0]
 * @param {string|null} [opts.cachedVideoUrl=null]
 * @param {Function} [opts.moderator=noopModerator]
 * @returns {Promise<Result<Object>>} render input props + guard verdicts
 */
export async function buildRenderInput(story, opts = {}) {
  const pages = Array.isArray(story?.pages) ? story.pages : [];
  if (pages.length === 0) {
    return Result.err(new Error('buildRenderInput: story has no pages'));
  }

  const language = story?.language || 'hebrew';
  const provider = opts.provider || 'gemini';
  const voice = opts.voice || getDefaultVoice(provider, language);
  const rtl = isRtlLanguage(language);

  // 1. normalize
  const normalized = pages.map((p, i) => normalizePage(p, i, { language }));

  // 2. moderation (allow-by-default MVP, multi-layer interface)
  const mod = await moderateStory(
    { scenes: normalized.map((s) => ({ text: s.text, imageUrl: s.imageUrl })), story },
    opts.moderator || noopModerator
  );
  if (!mod.allowed) {
    return Result.err(
      Object.assign(new Error('buildRenderInput: blocked by moderation'), {
        moderation: mod,
      })
    );
  }

  // 3. narration (optional — only if a synth fn was injected)
  let narrationDurations = normalized.map((s) => s.narrationMs);
  let audioUrls = normalized.map(() => null);
  if (typeof opts.synthesize === 'function') {
    const narr = await synthesizeNarration(normalized, {
      synthesize: opts.synthesize,
      provider,
      voice,
      language,
    });
    if (narr.isErr) return narr;
    const arr = narr.value();
    audioUrls = arr.map((a) => a.audioUrl);
    narrationDurations = arr.map((a, i) => a.durationMs ?? normalized[i].narrationMs);
  }

  // 4. timeline (frame-accurate)
  const timeline = buildTimeline(pages, { language, narrationDurations });

  // 5. music bed
  const music = resolveMusicBed(story);

  // 6. cache key + budget
  const cacheKey = storyVideoCacheKey({
    scenes: normalized.map((s) => ({ text: s.text, imageUrl: s.imageUrl })),
    voice,
    provider,
    musicBedId: music.id,
    language,
  });
  const budget = checkRenderBudget({
    tier: opts.tier || 'free',
    usedThisMonth: opts.usedThisMonth || 0,
    cacheKey,
    cachedVideoUrl: opts.cachedVideoUrl ?? null,
  });

  // Assemble the props the Remotion <Composition> consumes.
  const inputProps = {
    fps: FPS,
    width: VIDEO_WIDTH,
    height: VIDEO_HEIGHT,
    rtl,
    language,
    title: story?.title ?? null,
    music: { url: music.url, volume: music.volume, id: music.id },
    scenes: timeline.scenes.map((s, i) => ({
      index: s.index,
      text: s.text,
      imageUrl: s.imageUrl,
      audioUrl: audioUrls[i] ?? null,
      durationInFrames: s.durationFrames,
      startFrame: s.startFrame,
    })),
  };

  return Result.ok({
    inputProps,
    durationInFrames: timeline.totalFrames,
    durationMs: timeline.totalMs,
    cacheKey,
    budget,
    moderation: mod,
    voice,
    provider,
  });
}
