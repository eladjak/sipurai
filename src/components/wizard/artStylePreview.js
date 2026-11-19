const newPreviews = new Set(["anime", "pixar", "storybook", "watercolor"]);
const alternatePreviews = new Set(["comic", "disney", "fantasy"]);

export function artStylePreviewSource(style) {
  if (newPreviews.has(style)) return `/images/spx/styles/spx4-${style}.webp`;
  if (alternatePreviews.has(style)) return `/images/style-${style}.jpg`;
  return `/images/spx/styles/${style}.webp`;
}
