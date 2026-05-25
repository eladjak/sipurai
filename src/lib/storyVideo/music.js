/**
 * Story → Video — music bed resolver (pure).
 *
 * Council MVP: ONE royalty-free track per story (not per scene), ducked under
 * narration. fal/Suno music-gen is a PREMIUM upgrade, not MVP.
 *
 * This module only *selects* a bed descriptor by mood; it does not fetch audio.
 * The actual file is dropped into /public/audio/ and referenced via staticFile()
 * at render time. Until then `url` stays null and the composition simply omits
 * the music layer (render still succeeds).
 */

import { DEFAULT_MUSIC_BED, MUSIC_VOLUME } from './constants.js';

/** Mood → royalty-free bed placeholder. Real URLs filled when assets land. */
const MUSIC_LIBRARY = {
  calm: { id: 'calm-kids-bed', url: null, mood: 'calm' },
  adventure: { id: 'adventure-kids-bed', url: null, mood: 'adventure' },
  whimsical: { id: 'whimsical-kids-bed', url: null, mood: 'whimsical' },
  gentle: { id: 'gentle-lullaby-bed', url: null, mood: 'gentle' },
};

/**
 * Map a story genre to a music mood. Defensive defaults for the MVP.
 * @param {string} [genre]
 * @returns {string} mood key
 */
export function moodForGenre(genre) {
  switch (String(genre || '').toLowerCase()) {
    case 'adventure':
    case 'sci-fi':
    case 'space':
      return 'adventure';
    case 'fantasy':
    case 'magic':
      return 'whimsical';
    case 'bedtime':
    case 'lullaby':
      return 'gentle';
    default:
      return 'calm';
  }
}

/**
 * Resolve the music bed descriptor for a story.
 * @param {{ genre?: string, mood?: string }} [story]
 * @returns {{ id:string, url:(string|null), mood:string, volume:number, license:string }}
 */
export function resolveMusicBed(story = {}) {
  const mood = story.mood || moodForGenre(story.genre);
  const bed = MUSIC_LIBRARY[mood] || DEFAULT_MUSIC_BED;
  return {
    id: bed.id,
    url: bed.url ?? null,
    mood,
    volume: MUSIC_VOLUME,
    license: 'royalty-free-placeholder',
  };
}
