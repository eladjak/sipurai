/**
 * Ken-Burns transform helper (pure).
 *
 * Produces a CSS `transform` string for a given progress (0→1) through a scene.
 * Animates ONLY scale + translate (transform) — never width/height/top/left —
 * per the global animation rule. A deterministic per-scene direction keeps
 * consecutive scenes from drifting the same way (more cinematic).
 */

import {
  KEN_BURNS_ZOOM_FROM,
  KEN_BURNS_ZOOM_TO,
  KEN_BURNS_PAN_FRACTION,
} from '../lib/storyVideo/constants.js';

/** 4 pan directions, picked by scene index so the motion alternates. */
const PAN_DIRS = [
  { x: 1, y: 1 },
  { x: -1, y: 1 },
  { x: 1, y: -1 },
  { x: -1, y: -1 },
];

/**
 * @param {number} progress  0→1 through the scene
 * @param {number} sceneIndex used to vary pan direction deterministically
 * @returns {{ transform:string, scale:number }}
 */
export function kenBurnsTransform(progress, sceneIndex = 0) {
  const p = Math.min(1, Math.max(0, progress));
  const scale = KEN_BURNS_ZOOM_FROM + (KEN_BURNS_ZOOM_TO - KEN_BURNS_ZOOM_FROM) * p;

  const dir = PAN_DIRS[Math.abs(sceneIndex) % PAN_DIRS.length];
  // Pan as a percentage of frame; small and subtle.
  const panX = dir.x * KEN_BURNS_PAN_FRACTION * 100 * p;
  const panY = dir.y * KEN_BURNS_PAN_FRACTION * 100 * p;

  return {
    transform: `translate(${panX.toFixed(3)}%, ${panY.toFixed(3)}%) scale(${scale.toFixed(4)})`,
    scale,
  };
}
