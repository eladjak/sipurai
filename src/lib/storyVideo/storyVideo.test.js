import { describe, it, expect } from 'vitest';
import {
  msToFrames,
  framesToMs,
  isRtlLanguage,
  normalizePage,
  sceneDurationMs,
  buildTimeline,
} from './timing.js';
import { moodForGenre, resolveMusicBed } from './music.js';
import { moderateStory, noopModerator } from './moderation.js';
import {
  fnv1a,
  storyVideoCacheKey,
  checkRenderBudget,
  RENDER_BUDGET_BY_TIER,
} from './budget.js';
import {
  createRenderJob,
  canTransition,
  transition,
  isTerminal,
} from './renderQueue.js';
import { buildRenderInput } from './pipeline.js';
import {
  FPS,
  MIN_SCENE_MS,
  DEFAULT_SCENE_MS,
  SCENE_TAIL_PADDING_MS,
  VIDEO_STATUS,
} from './constants.js';

describe('timing.msToFrames / framesToMs', () => {
  it('converts ms to whole frames (round up, never clip)', () => {
    expect(msToFrames(1000, 30)).toBe(30);
    expect(msToFrames(1001, 30)).toBe(31); // rounds up
    expect(msToFrames(0)).toBe(0);
    expect(msToFrames(-5)).toBe(0);
  });
  it('round-trips frames→ms approximately', () => {
    expect(framesToMs(30, 30)).toBe(1000);
    expect(framesToMs(0)).toBe(0);
  });
});

describe('timing.isRtlLanguage', () => {
  it('flags hebrew and yiddish as RTL', () => {
    expect(isRtlLanguage('hebrew')).toBe(true);
    expect(isRtlLanguage('YIDDISH')).toBe(true);
    expect(isRtlLanguage('english')).toBe(false);
    expect(isRtlLanguage(undefined)).toBe(false);
  });
});

describe('timing.normalizePage', () => {
  it('reads canonical { text, image_url } shape', () => {
    const n = normalizePage({ text: 'שלום', image_url: 'http://x/y.png' }, 0);
    expect(n).toMatchObject({ index: 0, text: 'שלום', imageUrl: 'http://x/y.png' });
  });
  it('reads demo { text, imagePrompt } shape and tolerates missing image', () => {
    const n = normalizePage({ pageNumber: 2, text: 'דף' }, 1);
    expect(n.text).toBe('דף');
    expect(n.imageUrl).toBeNull();
  });
  it('prefers English text when language is english', () => {
    const n = normalizePage({ text: 'עברית', textEn: 'English' }, 0, {
      language: 'english',
    });
    expect(n.text).toBe('English');
  });
  it('picks up a per-page narration duration', () => {
    const n = normalizePage({ text: 'x', duration_ms: 4200 }, 0);
    expect(n.narrationMs).toBe(4200);
  });
});

describe('timing.sceneDurationMs', () => {
  it('adds tail padding to narration length', () => {
    expect(sceneDurationMs(5000)).toBe(5000 + SCENE_TAIL_PADDING_MS);
  });
  it('falls back to default when no narration', () => {
    expect(sceneDurationMs(null)).toBe(DEFAULT_SCENE_MS);
  });
  it('clamps to the minimum scene length', () => {
    expect(sceneDurationMs(100)).toBe(MIN_SCENE_MS);
  });
});

describe('timing.buildTimeline', () => {
  const pages = [
    { text: 'a', image_url: 'http://x/1.png' },
    { text: 'b', image_url: 'http://x/2.png' },
    { text: 'c', image_url: 'http://x/3.png' },
  ];

  it('lays scenes back-to-back with no frame gaps or overlaps', () => {
    const tl = buildTimeline(pages, { narrationDurations: [2000, 2000, 2000] });
    expect(tl.scenes).toHaveLength(3);
    expect(tl.fps).toBe(FPS);
    let cursor = 0;
    for (const s of tl.scenes) {
      expect(s.startFrame).toBe(cursor);
      expect(s.endFrame).toBe(cursor + s.durationFrames);
      expect(s.durationFrames).toBeGreaterThan(0);
      cursor = s.endFrame;
    }
    expect(tl.totalFrames).toBe(cursor);
  });

  it('uses narrationDurations override per scene', () => {
    const tl = buildTimeline(pages, { narrationDurations: [3000, 8000, 1000] });
    // scene 0: 3000+pad ; scene 1: 8000+pad ; scene 2: clamped to MIN
    expect(tl.scenes[0].durationMs).toBe(3000 + SCENE_TAIL_PADDING_MS);
    expect(tl.scenes[1].durationMs).toBe(8000 + SCENE_TAIL_PADDING_MS);
    expect(tl.scenes[2].durationMs).toBe(MIN_SCENE_MS);
  });

  it('handles empty input gracefully', () => {
    const tl = buildTimeline([]);
    expect(tl.scenes).toHaveLength(0);
    expect(tl.totalFrames).toBe(0);
  });
});

describe('music.moodForGenre / resolveMusicBed', () => {
  it('maps genres to moods', () => {
    expect(moodForGenre('adventure')).toBe('adventure');
    expect(moodForGenre('fantasy')).toBe('whimsical');
    expect(moodForGenre('bedtime')).toBe('gentle');
    expect(moodForGenre('unknown')).toBe('calm');
  });
  it('resolves a bed descriptor with placeholder url + duck volume', () => {
    const bed = resolveMusicBed({ genre: 'fantasy' });
    expect(bed.mood).toBe('whimsical');
    expect(bed.url).toBeNull(); // placeholder until asset lands
    expect(bed.volume).toBeGreaterThan(0);
    expect(bed.volume).toBeLessThan(0.3);
  });
});

describe('moderation (allow-by-default stub)', () => {
  it('allows everything via the noop moderator', async () => {
    const r = await moderateStory(
      { scenes: [{ text: 'hi', imageUrl: null }] },
      noopModerator
    );
    expect(r.allowed).toBe(true);
    expect(r.flags).toEqual([]);
    expect(r.stub).toBe(true);
  });
  it('respects a custom blocking moderator', async () => {
    const blocker = async () => ({
      allowed: false,
      provider: 'test',
      flags: [{ layer: 'image', index: 0, reason: 'unsafe' }],
    });
    const r = await moderateStory({ scenes: [{ text: 'x', imageUrl: 'y' }] }, blocker);
    expect(r.allowed).toBe(false);
    expect(r.flags).toHaveLength(1);
  });
});

describe('budget.fnv1a / cache key', () => {
  it('is deterministic and hex', () => {
    expect(fnv1a('abc')).toBe(fnv1a('abc'));
    expect(fnv1a('abc')).toMatch(/^[0-9a-f]{8}$/);
    expect(fnv1a('abc')).not.toBe(fnv1a('abd'));
  });
  it('cache key changes when render-affecting content changes', () => {
    const base = {
      scenes: [{ text: 'a', imageUrl: 'i1' }],
      voice: 'Aoede',
      provider: 'gemini',
      musicBedId: 'calm-kids-bed',
      language: 'hebrew',
    };
    const k1 = storyVideoCacheKey(base);
    const k2 = storyVideoCacheKey({ ...base, voice: 'Kore' });
    const k3 = storyVideoCacheKey({
      ...base,
      scenes: [{ text: 'a-changed', imageUrl: 'i1' }],
    });
    expect(k1).toMatch(/^sv1:[0-9a-f]{8}$/);
    expect(k1).not.toBe(k2);
    expect(k1).not.toBe(k3);
  });
  it('is stable for identical content', () => {
    const a = storyVideoCacheKey({ scenes: [{ text: 't', imageUrl: 'u' }] });
    const b = storyVideoCacheKey({ scenes: [{ text: 't', imageUrl: 'u' }] });
    expect(a).toBe(b);
  });
});

describe('budget.checkRenderBudget', () => {
  it('allows within budget and reports remaining', () => {
    const v = checkRenderBudget({ tier: 'free', usedThisMonth: 2 });
    expect(v.allowed).toBe(true);
    expect(v.reason).toBe('within-budget');
    expect(v.remaining).toBe(RENDER_BUDGET_BY_TIER.free - 2);
  });
  it('denies when budget exceeded', () => {
    const v = checkRenderBudget({
      tier: 'free',
      usedThisMonth: RENDER_BUDGET_BY_TIER.free,
    });
    expect(v.allowed).toBe(false);
    expect(v.reason).toBe('budget-exceeded');
    expect(v.remaining).toBe(0);
  });
  it('cache hit short-circuits budget even when over limit', () => {
    const v = checkRenderBudget({
      tier: 'free',
      usedThisMonth: 999,
      cacheKey: 'sv1:deadbeef',
      cachedVideoUrl: 'https://cdn/x.mp4',
    });
    expect(v.allowed).toBe(true);
    expect(v.cached).toBe(true);
    expect(v.reason).toBe('cache-hit');
    expect(v.videoUrl).toBe('https://cdn/x.mp4');
  });
});

describe('renderQueue state machine', () => {
  it('creates a queued job', () => {
    const job = createRenderJob({
      storyId: 's1',
      cacheKey: 'sv1:abc',
      durationInFrames: 90,
      inputProps: {},
    });
    expect(job.status).toBe(VIDEO_STATUS.QUEUED);
    expect(job.queuedAt).toBeTruthy();
  });
  it('enforces legal transitions', () => {
    expect(canTransition(VIDEO_STATUS.QUEUED, VIDEO_STATUS.RENDERING)).toBe(true);
    expect(canTransition(VIDEO_STATUS.QUEUED, VIDEO_STATUS.READY)).toBe(false);
    expect(canTransition(VIDEO_STATUS.READY, VIDEO_STATUS.QUEUED)).toBe(true);
  });
  it('transitions immutably and stamps timing', () => {
    const job = createRenderJob({ storyId: 's1', cacheKey: 'k', durationInFrames: 1, inputProps: {} });
    const rendering = transition(job, VIDEO_STATUS.RENDERING);
    expect(rendering.status).toBe(VIDEO_STATUS.RENDERING);
    expect(rendering.startedAt).toBeTruthy();
    expect(job.status).toBe(VIDEO_STATUS.QUEUED); // original untouched
    const ready = transition(rendering, VIDEO_STATUS.READY, { videoUrl: 'http://x.mp4' });
    expect(ready.status).toBe(VIDEO_STATUS.READY);
    expect(ready.videoUrl).toBe('http://x.mp4');
    expect(isTerminal(ready.status)).toBe(true);
  });
  it('throws on illegal transition', () => {
    const job = createRenderJob({ storyId: 's', cacheKey: 'k', durationInFrames: 1, inputProps: {} });
    expect(() => transition(job, VIDEO_STATUS.READY)).toThrow(/illegal transition/);
  });
});

describe('pipeline.buildRenderInput', () => {
  const story = {
    title: 'הגן הסודי',
    language: 'hebrew',
    genre: 'fantasy',
    pages: [
      { text: 'דף ראשון', image_url: 'http://x/1.png' },
      { text: 'דף שני', image_url: 'http://x/2.png' },
    ],
  };

  it('builds frame-accurate input props with fake narration synth', async () => {
    const fakeSynth = async ({ text }) => ({
      url: `blob:fake/${encodeURIComponent(text)}`,
      durationMs: 4000,
    });
    const res = await buildRenderInput(story, { synthesize: fakeSynth, tier: 'free' });
    expect(res.isOk).toBe(true);
    const out = res.value();
    expect(out.inputProps.scenes).toHaveLength(2);
    expect(out.inputProps.rtl).toBe(true);
    expect(out.inputProps.scenes[0].audioUrl).toContain('blob:fake');
    // 4000ms + pad each → both scenes equal, total = 2x
    expect(out.inputProps.scenes[1].startFrame).toBe(
      out.inputProps.scenes[0].durationInFrames
    );
    expect(out.durationInFrames).toBe(
      out.inputProps.scenes[0].durationInFrames +
        out.inputProps.scenes[1].durationInFrames
    );
    expect(out.cacheKey).toMatch(/^sv1:/);
    expect(out.budget.allowed).toBe(true);
    expect(out.voice).toBe('Aoede'); // default hebrew gemini voice
  });

  it('works without a synth (durations fall back, no audio)', async () => {
    const res = await buildRenderInput(story, {});
    expect(res.isOk).toBe(true);
    const out = res.value();
    expect(out.inputProps.scenes[0].audioUrl).toBeNull();
    expect(out.durationInFrames).toBeGreaterThan(0);
  });

  it('errors on empty story', async () => {
    const res = await buildRenderInput({ pages: [] });
    expect(res.isErr).toBe(true);
  });

  it('blocks when moderation rejects', async () => {
    const blocker = async () => ({ allowed: false, provider: 't', flags: [{ layer: 'text', index: 0, reason: 'x' }] });
    const res = await buildRenderInput(story, { moderator: blocker });
    expect(res.isErr).toBe(true);
    expect(res.error().moderation.allowed).toBe(false);
  });

  it('surfaces a cache hit through the budget verdict', async () => {
    const res = await buildRenderInput(story, {
      cachedVideoUrl: 'https://cdn/cached.mp4',
      tier: 'free',
      usedThisMonth: 999,
    });
    expect(res.isOk).toBe(true);
    expect(res.value().budget.cached).toBe(true);
    expect(res.value().budget.videoUrl).toBe('https://cdn/cached.mp4');
  });
});
