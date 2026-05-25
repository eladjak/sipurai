import React from 'react';
import { Composition } from 'remotion';
import StoryVideo from './StoryVideo.jsx';
import {
  SAMPLE_INPUT_PROPS,
  SAMPLE_DURATION_IN_FRAMES,
} from './sampleStory.js';
import {
  FPS,
  VIDEO_WIDTH,
  VIDEO_HEIGHT,
} from '../lib/storyVideo/constants.js';

/**
 * Remotion root — registers the StoryVideo composition for Studio + CLI render.
 *
 * Duration is derived from the input props (sum of scene frames) via
 * calculateMetadata, so rendering a real story with `--props` automatically
 * sizes the video to that story's timeline.
 */
export const RemotionRoot = () => {
  return (
    <Composition
      id="StoryVideo"
      component={StoryVideo}
      durationInFrames={SAMPLE_DURATION_IN_FRAMES}
      fps={FPS}
      width={VIDEO_WIDTH}
      height={VIDEO_HEIGHT}
      defaultProps={SAMPLE_INPUT_PROPS}
      calculateMetadata={({ props }) => {
        const scenes = Array.isArray(props?.scenes) ? props.scenes : [];
        const total = scenes.reduce(
          (sum, s) => sum + (Number(s.durationInFrames) || 0),
          0
        );
        return {
          durationInFrames: Math.max(1, total || SAMPLE_DURATION_IN_FRAMES),
          fps: FPS,
          width: VIDEO_WIDTH,
          height: VIDEO_HEIGHT,
        };
      }}
    />
  );
};
