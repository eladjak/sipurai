/**
 * Remotion entry point. Kept SEPARATE from the Vite app entry so Remotion's own
 * bundler (esbuild via @remotion/bundler) compiles only the composition tree —
 * the Vite app never imports this file, and this file never imports Vite/Clerk.
 */
import { registerRoot } from 'remotion';
import { RemotionRoot } from './Root.jsx';

registerRoot(RemotionRoot);
