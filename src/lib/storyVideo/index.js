/**
 * Story → Video pipeline — public barrel.
 *
 * MVP (council 2026-05-25, unanimous): Remotion + Ken Burns + existing Gemini
 * TTS, async render queue, per-user budget cap + hash cache, multi-layer
 * moderation hook (allow-by-default stub), programmatic RTL Hebrew captions.
 */

export * from './constants.js';
export * from './timing.js';
export * from './music.js';
export * from './moderation.js';
export * from './budget.js';
export * from './renderQueue.js';
export { buildRenderInput, synthesizeNarration } from './pipeline.js';
