/**
 * Story → Video — async render job model.
 *
 * Council (3/3): render MUST be asynchronous/queued, never a synchronous call.
 * Even local Ken-Burns renders take seconds-to-minutes; a sync call would block
 * the UI and the request. This module models the job lifecycle as a pure state
 * machine. The actual worker (Vercel function / Supabase Edge / local CLI) reads
 * a 'queued' row, transitions it to 'rendering', renders via Remotion, uploads
 * to Storage, then sets 'ready' (or 'failed').
 *
 * The UI polls video_status; it never awaits the render inline.
 */

import { VIDEO_STATUS } from './constants.js';

/** Allowed transitions for the render job state machine. */
const TRANSITIONS = {
  [VIDEO_STATUS.NONE]: [VIDEO_STATUS.QUEUED],
  [VIDEO_STATUS.QUEUED]: [VIDEO_STATUS.RENDERING, VIDEO_STATUS.FAILED],
  [VIDEO_STATUS.RENDERING]: [VIDEO_STATUS.READY, VIDEO_STATUS.FAILED],
  [VIDEO_STATUS.READY]: [VIDEO_STATUS.QUEUED], // allow re-render (cache-bust)
  [VIDEO_STATUS.FAILED]: [VIDEO_STATUS.QUEUED], // allow retry
};

/**
 * Create a fresh render job descriptor (status: queued).
 * @param {Object} params
 * @param {string} params.storyId
 * @param {string} params.cacheKey
 * @param {number} params.durationInFrames
 * @param {Object} params.inputProps
 * @returns {Object} job
 */
export function createRenderJob({ storyId, cacheKey, durationInFrames, inputProps }) {
  return {
    storyId,
    cacheKey,
    durationInFrames,
    inputProps,
    status: VIDEO_STATUS.QUEUED,
    videoUrl: null,
    error: null,
    queuedAt: new Date().toISOString(),
    startedAt: null,
    finishedAt: null,
  };
}

/** True if `from → to` is a legal status transition. */
export function canTransition(from, to) {
  return Array.isArray(TRANSITIONS[from]) && TRANSITIONS[from].includes(to);
}

/**
 * Apply a status transition immutably. Throws on an illegal transition so bugs
 * surface loudly instead of corrupting state.
 * @param {Object} job
 * @param {string} to - target VIDEO_STATUS
 * @param {Object} [patch] - extra fields to merge (videoUrl, error, …)
 * @returns {Object} new job
 */
export function transition(job, to, patch = {}) {
  const from = job?.status;
  if (!canTransition(from, to)) {
    throw new Error(`renderQueue: illegal transition ${from} → ${to}`);
  }
  const stamp = new Date().toISOString();
  const timing =
    to === VIDEO_STATUS.RENDERING
      ? { startedAt: stamp }
      : to === VIDEO_STATUS.READY || to === VIDEO_STATUS.FAILED
        ? { finishedAt: stamp }
        : {};
  return { ...job, ...patch, ...timing, status: to };
}

/** Convenience: is the job in a terminal state? */
export function isTerminal(status) {
  return status === VIDEO_STATUS.READY || status === VIDEO_STATUS.FAILED;
}
