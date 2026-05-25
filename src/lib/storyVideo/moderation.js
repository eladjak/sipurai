/**
 * Story → Video — content moderation hook (interface stub).
 *
 * Council (3/3) flagged MULTI-LAYER moderation as a non-negotiable, including
 * on the ILLUSTRATIONS themselves (Gemini's minority point), not just text.
 *
 * MVP behavior: allow-by-default no-op, so the pipeline is wired end-to-end but
 * never blocks a render in dev. The interface is shaped for a real provider
 * (Hive AI / OpenAI moderation) to drop in without touching callers.
 *
 * TODO(premium): wire `moderateStory` to Hive AI — text + image + (later) audio
 * + AI-video frames. Reject identity-drift / unsafe outputs before enqueue.
 */

/**
 * @typedef {Object} ModerationResult
 * @property {boolean} allowed   - true = safe to render
 * @property {string}  provider  - which backend produced the verdict
 * @property {Array<{ layer:string, index:number, reason:string }>} flags
 */

/**
 * The pluggable moderator interface. A real implementation replaces this.
 * @param {Object} input
 * @param {Array<{ text:string, imageUrl:(string|null) }>} input.scenes
 * @param {Object} [input.story]
 * @returns {Promise<ModerationResult>}
 */
export async function moderateStory(input, moderator = noopModerator) {
  const scenes = Array.isArray(input?.scenes) ? input.scenes : [];
  return moderator({ scenes, story: input?.story });
}

/**
 * Default allow-everything moderator (MVP). Returns no flags.
 * Kept async to match the real provider signature.
 */
export async function noopModerator() {
  return {
    allowed: true,
    provider: 'noop-allow',
    flags: [],
    // Explicit marker so logs/tests can see moderation ran but is a stub.
    stub: true,
  };
}

/**
 * Example shape of a real moderator, kept here as documentation only.
 * Not wired. Illustrates the per-layer flag contract for Hive AI.
 *
 * async function hiveModerator({ scenes }) {
 *   const flags = [];
 *   for (const [i, s] of scenes.entries()) {
 *     // const t = await hive.text(s.text);   if (!t.safe) flags.push({ layer:'text', index:i, reason:t.reason });
 *     // const im = await hive.image(s.imageUrl); if (!im.safe) flags.push({ layer:'image', index:i, reason:im.reason });
 *   }
 *   return { allowed: flags.length === 0, provider: 'hive', flags };
 * }
 */
