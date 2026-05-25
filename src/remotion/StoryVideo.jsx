import React from 'react';
import { AbsoluteFill, Sequence, Audio } from 'remotion';
import StoryScene from './StoryScene.jsx';

/**
 * StoryVideo — top-level Remotion composition for a Sipurai story.
 *
 * Props (built by src/lib/storyVideo/pipeline.js → buildRenderInput):
 *   - scenes:  [{ index, text, imageUrl, audioUrl, durationInFrames, startFrame }]
 *   - rtl:     boolean (Hebrew/Yiddish → RTL captions)
 *   - music:   { url, volume } | null  (one royalty-free bed, ducked under narration)
 *
 * Each scene is its own <Sequence>; the music bed spans the whole composition.
 * Ken-Burns + captions live in <StoryScene>. AI video is NOT part of the MVP.
 */
export default function StoryVideo({ scenes = [], rtl = true, music = null }) {
  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      {/* Music bed: one track for the whole story, low volume under narration.
          Omitted (no layer) until a royalty-free file is dropped in /public/audio. */}
      {music && music.url ? (
        <Audio src={music.url} volume={music.volume ?? 0.12} loop />
      ) : null}

      {scenes.map((scene) => (
        <Sequence
          key={scene.index}
          from={scene.startFrame}
          durationInFrames={scene.durationInFrames}
          name={`scene-${scene.index + 1}`}
        >
          <StoryScene scene={scene} rtl={rtl} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
}
