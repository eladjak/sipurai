/**
 * Tiny 2-page sample story for Remotion Studio preview + local test render.
 * Images are remote royalty-free placeholders (picsum) so the composition can
 * render without local assets. Hebrew text exercises the RTL caption path.
 *
 * durationInFrames is provided directly (no narration audio) so the sample
 * renders deterministically without hitting the TTS provider.
 */

import { FPS } from '../lib/storyVideo/constants.js';

const SCENE_SECONDS = 3;
const SCENE_FRAMES = SCENE_SECONDS * FPS;

export const SAMPLE_SCENES = [
  {
    index: 0,
    text: 'לילי גילתה דלת קטנה ביער, ואור זהוב בקע מבעדה.',
    imageUrl: 'https://picsum.photos/seed/sipurai-1/1920/1080',
    audioUrl: null,
    durationInFrames: SCENE_FRAMES,
    startFrame: 0,
  },
  {
    index: 1,
    text: 'מעבר לדלת חיכה גן קסום מלא בפרפרים זוהרים.',
    imageUrl: 'https://picsum.photos/seed/sipurai-2/1920/1080',
    audioUrl: null,
    durationInFrames: SCENE_FRAMES,
    startFrame: SCENE_FRAMES,
  },
];

export const SAMPLE_INPUT_PROPS = {
  scenes: SAMPLE_SCENES,
  rtl: true,
  language: 'hebrew',
  music: { url: null, volume: 0.12, id: 'calm-kids-bed' },
};

export const SAMPLE_DURATION_IN_FRAMES = SCENE_FRAMES * SAMPLE_SCENES.length;
