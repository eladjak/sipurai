/**
 * OpenAI Image EDIT helper — generate scene images that preserve a character's
 * appearance via the gpt-image-1 edit endpoint.
 *
 * Per GPT-5 consult (2026-05-10): the killer feature for kids' books is
 * character continuity. Generate the avatar ONCE, then for every page of the
 * book pass that avatar PNG as the reference + a scene prompt. The model
 * preserves face, clothing, proportions, palette across all 12 pages.
 *
 * Endpoint: POST https://api.openai.com/v1/images/edits
 * Required: image (PNG file or URL), prompt (string), n, size
 *
 * Created 2026-05-10.
 */

const OPENAI_IMAGE_MODEL = 'gpt-image-1';

const ASPECT_TO_SIZE = {
  '1:1': '1024x1024',
  '4:3': '1024x768',
  '3:4': '768x1024',
  '16:9': '1536x1024',
  '9:16': '1024x1536',
};

/**
 * Generate a scene image that preserves the reference character.
 * @param {string} apiKey
 * @param {string} prompt - Scene prompt; do NOT repeat character description here, the reference image carries it
 * @param {Object} options
 * @param {string} options.referenceImageBase64 - PNG base64 of the character avatar (no data: prefix)
 * @param {string} [options.aspectRatio='1:1']
 * @param {'low'|'medium'|'high'} [options.quality='medium']
 * @returns {{ base64: string, mimeType: string }}
 */
export async function openaiImageEdit(apiKey, prompt, options = {}) {
  const { referenceImageBase64, aspectRatio = '1:1', quality = 'medium' } = options;
  if (!referenceImageBase64 || typeof referenceImageBase64 !== 'string') {
    const err = new Error('referenceImageBase64 required');
    err.status = 400;
    throw err;
  }

  const size = ASPECT_TO_SIZE[aspectRatio] ?? '1024x1024';

  const safePrompt = `${prompt}\n\nPreserve the character's face, hair, clothing, age, and overall palette from the reference image. Do NOT include text, letters, numbers, or written signs in the image. Wholesome, child-friendly, age-appropriate.`;

  // gpt-image-1 edits endpoint expects multipart/form-data
  const form = new FormData();
  form.append('model', OPENAI_IMAGE_MODEL);
  form.append('prompt', safePrompt);
  form.append('n', '1');
  form.append('size', size);
  form.append('quality', quality);

  // Convert base64 to a Blob for multipart upload
  const binaryStr = Buffer.from(referenceImageBase64, 'base64');
  const blob = new Blob([binaryStr], { type: 'image/png' });
  form.append('image', blob, 'reference.png');

  const r = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  if (!r.ok) {
    const errText = await r.text();
    const err = new Error(`OpenAI image edit failed (${r.status}): ${errText.substring(0, 300)}`);
    err.status = r.status >= 500 ? 502 : r.status;
    throw err;
  }

  const data = await r.json();
  const b64 = data?.data?.[0]?.b64_json;
  if (!b64) {
    throw new Error('OpenAI image edit returned no image data.');
  }
  return { base64: b64, mimeType: 'image/png' };
}
