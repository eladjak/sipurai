import React from 'react';
import {
  AbsoluteFill,
  Img,
  Audio,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} from 'remotion';
import { kenBurnsTransform } from './kenBurns.js';
import { NARRATION_VOLUME, TRANSITION_MS } from '../lib/storyVideo/constants.js';

/**
 * A single storybook scene:
 *  - full-bleed illustration with a Ken-Burns pan/zoom (transform only)
 *  - gentle fade in/out at the scene edges (opacity only)
 *  - per-page narration audio (existing Gemini TTS output)
 *  - a timed, programmatic RTL Hebrew caption overlay (AI video CANNOT render
 *    Hebrew — captions are ALWAYS a programmatic overlay, never burned in)
 *
 * Rendered inside a <Sequence>, so `useCurrentFrame()` here is scene-local
 * (starts at 0 for each scene).
 */
export default function StoryScene({ scene, rtl }) {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();

  const progress = durationInFrames > 1 ? frame / (durationInFrames - 1) : 1;
  const { transform } = kenBurnsTransform(progress, scene.index);

  // Fade in/out at the scene edges (opacity only). Window = TRANSITION_MS.
  const fadeFrames = Math.max(1, Math.round((TRANSITION_MS / 1000) * fps));
  const opacity = interpolate(
    frame,
    [0, fadeFrames, durationInFrames - fadeFrames, durationInFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  // Caption slides up + fades in slightly after the image settles.
  const captionStart = Math.round(fadeFrames * 0.5);
  const captionOpacity = interpolate(
    frame,
    [captionStart, captionStart + fadeFrames],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );
  const captionTranslate = interpolate(
    frame,
    [captionStart, captionStart + fadeFrames],
    [24, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  return (
    <AbsoluteFill style={{ backgroundColor: '#0b0b0f', opacity }}>
      {/* Illustration layer — Ken Burns */}
      {scene.imageUrl ? (
        <AbsoluteFill>
          <Img
            src={scene.imageUrl}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transform,
              willChange: 'transform',
            }}
          />
        </AbsoluteFill>
      ) : (
        <AbsoluteFill
          style={{
            background: 'linear-gradient(135deg,#1e293b,#0f172a)',
            transform,
          }}
        />
      )}

      {/* Scrim so the caption stays readable over any illustration */}
      <AbsoluteFill
        style={{
          background:
            'linear-gradient(to top, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.25) 26%, rgba(0,0,0,0) 52%)',
        }}
      />

      {/* Programmatic RTL caption overlay */}
      {scene.text ? (
        <AbsoluteFill
          style={{
            justifyContent: 'flex-end',
            alignItems: 'stretch',
            padding: '0 7% 6%',
          }}
        >
          <div
            dir={rtl ? 'rtl' : 'ltr'}
            style={{
              opacity: captionOpacity,
              transform: `translateY(${captionTranslate}px)`,
              willChange: 'transform, opacity',
              color: '#fff',
              fontFamily:
                "'Heebo','Rubik','Assistant',-apple-system,'Segoe UI',Arial,sans-serif",
              fontWeight: 600,
              fontSize: 52,
              lineHeight: 1.45,
              textAlign: rtl ? 'right' : 'left',
              textShadow: '0 2px 14px rgba(0,0,0,0.85)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {scene.text}
          </div>
        </AbsoluteFill>
      ) : null}

      {/* Per-page narration */}
      {scene.audioUrl ? (
        <Audio src={scene.audioUrl} volume={NARRATION_VOLUME} />
      ) : null}
    </AbsoluteFill>
  );
}
