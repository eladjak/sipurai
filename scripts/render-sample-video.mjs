/**
 * Local sample render — proves the Remotion pipeline produces a real mp4.
 *
 * Bundles the composition (esbuild via @remotion/bundler), selects StoryVideo,
 * and renders the 2-page sample to out/story-video-sample.mp4.
 *
 * Requires a Chrome Headless Shell (Remotion downloads it on first run) and
 * FFmpeg (bundled with @remotion/renderer). If the environment can't provide a
 * browser, this script fails loudly — it never fakes success.
 *
 * Run: bun run video:render:sample   (or  node scripts/render-sample-video.mjs)
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir } from 'node:fs/promises';
import { bundle } from '@remotion/bundler';
import { selectComposition, renderMedia } from '@remotion/renderer';
import { SAMPLE_INPUT_PROPS } from '../src/remotion/sampleStory.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

async function main() {
  const entry = path.join(root, 'src', 'remotion', 'index.js');
  const outDir = path.join(root, 'out');
  await mkdir(outDir, { recursive: true });
  const outFile = path.join(outDir, 'story-video-sample.mp4');

  console.log('[render] bundling composition…');
  const serveUrl = await bundle({
    entryPoint: entry,
    onProgress: (p) => {
      if (p % 25 === 0) console.log(`[render] bundle ${p}%`);
    },
  });

  console.log('[render] selecting composition StoryVideo…');
  const composition = await selectComposition({
    serveUrl,
    id: 'StoryVideo',
    inputProps: SAMPLE_INPUT_PROPS,
  });

  console.log(
    `[render] rendering ${composition.durationInFrames} frames @ ${composition.fps}fps → ${outFile}`
  );
  await renderMedia({
    serveUrl,
    composition,
    codec: 'h264',
    outputLocation: outFile,
    inputProps: SAMPLE_INPUT_PROPS,
    onProgress: ({ progress }) => {
      const pct = Math.round(progress * 100);
      if (pct % 10 === 0) console.log(`[render] ${pct}%`);
    },
  });

  console.log(`[render] DONE → ${outFile}`);
}

main().catch((err) => {
  console.error('[render] FAILED:', err?.message || err);
  process.exit(1);
});
