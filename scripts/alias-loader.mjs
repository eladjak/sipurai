/**
 * Minimal ESM resolve hook mapping the project's `@/…` alias to `src/…`.
 *
 * The app resolves `@/` through Vite; a plain `node` process does not. Rather
 * than add a dependency (or, worse, duplicate the modules under test with
 * relative imports and end up testing a copy), this teaches Node the one alias
 * the project uses.
 *
 * Usage:  node --import ./scripts/alias-loader.mjs scripts/<script>.mjs
 */
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

const SRC = new URL('../src/', import.meta.url).href;

register(
  'data:text/javascript,' +
    encodeURIComponent(`
      const SRC = ${JSON.stringify(SRC)};
      export async function resolve(specifier, context, nextResolve) {
        if (specifier.startsWith('@/')) {
          const rest = specifier.slice(2);
          const hasExt = /\\.[a-zA-Z0-9]+$/.test(rest);
          // Mirror Vite's extension resolution for the extensions this repo uses.
          const candidates = hasExt ? [rest] : [rest + '.js', rest + '.jsx', rest + '/index.js'];
          for (const candidate of candidates) {
            try {
              return await nextResolve(SRC + candidate, context);
            } catch {
              // try the next extension
            }
          }
        }
        return nextResolve(specifier, context);
      }
    `),
  pathToFileURL('./')
);
