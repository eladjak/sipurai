export const configuredPrintEditionPolicy = import.meta.env?.VITE_PRINT_EDITION_POLICY || 'open';

/** Pilot visibility only. The existing provider keeps its auth, rate and spend checks. */
export function printEditionCapabilities(mode = 'open', plan = 'free') {
  const advanced = mode === 'open' || (mode === 'subscriber-preview' && ['premium', 'family'].includes(plan));
  return {
    illustrationGeneration: advanced,
    rewriteSuggestions: advanced,
    advancedLayout: advanced,
    extraPages: advanced,
    storyFont: advanced,
    upgradedPaper: advanced,
  };
}
