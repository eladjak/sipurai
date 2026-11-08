/**
 * Client-side switch for the printed-book ordering feature.
 *
 * Default is OFF. When it is off: no route is registered, no button is
 * rendered, and the feature code is not even part of the production bundle
 * (App.jsx tests the same env value inline so the bundler can drop it).
 */
export function isPrintOrderEnabled() {
  return import.meta.env.VITE_PRINT_ORDER_ENABLED === 'true';
}
