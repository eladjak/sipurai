function normalized(value) {
  return value.normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase();
}

function promptScene(prompt) {
  if (typeof prompt !== 'string' || prompt.length > 12_000 || prompt.startsWith('[Image generation failed]')) return null;
  const role = prompt.lastIndexOf('Scene role: ');
  const beat = prompt.lastIndexOf('Scene beat: ');
  const scene = prompt.lastIndexOf('Scene: ');
  const style = prompt.lastIndexOf(". Children's book illustration in ");
  if (role < 0 || role >= beat || beat >= scene || scene >= style) return null;
  const detail = normalized(prompt.slice(scene + 'Scene: '.length, style));
  const direction = normalized(prompt.slice(role, scene));
  if (detail.length < 32 || detail.split(' ').length < 6) return null;
  return { direction, detail };
}

/** Advisory only. Use saved panorama intent or matched structured illustration directions. */
export function spreadSuggestion(first, second, savedPanorama) {
  if (!Number.isSafeInteger(first?.page_number) || second?.page_number !== first.page_number + 1) return null;
  if (typeof savedPanorama === 'string' && savedPanorama.trim()) return 'saved-panorama';
  const a = promptScene(first.image_prompt);
  const b = promptScene(second.image_prompt);
  return a && b && a.direction === b.direction && a.detail === b.detail ? 'same-scene' : null;
}
