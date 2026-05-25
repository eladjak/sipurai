/**
 * Remotion CLI config — used by `remotion studio` and `remotion render`.
 *
 * This file is read ONLY by the Remotion CLI, never by Vite. It points the CLI
 * at the composition entry (src/remotion/index.js), which is isolated from the
 * Vite app so the two bundlers never collide.
 */
import { Config } from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);
// H.264 mp4 — broadest browser/social compatibility.
Config.setCodec('h264');
// Entry point for the composition tree.
Config.setEntryPoint('./src/remotion/index.js');
