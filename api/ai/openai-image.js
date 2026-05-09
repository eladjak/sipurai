/**
 * OpenAI Image generation helper — used by api/ai/generate.js when provider='openai'.
 *
 * Calls OpenAI Images API (gpt-image-1 model). Returns { base64, mimeType } to match
 * the Gemini handler's contract so the front-end Core.GenerateImage stays unchanged.
 *
 * Env: OPENAI_API_KEY (required). Created 2026-05-08 night.
 */

const OPENAI_IMAGE_MODEL = 'gpt-image-1';

const ASPECT_TO_SIZE = {
  '1:1': '1024x1024',
  '4:3': '1024x768',
  '3:4': '768x1024',
  '16:9': '1536x1024',
  '9:16': '1024x1536',
};

export async function openaiImage(apiKey, prompt, options = {}) {
  const { aspectRatio = '1:1', quality = 'medium' } = options;
  const size = ASPECT_TO_SIZE[aspectRatio] ?? '1024x1024';

  const safePrompt = `${prompt}\n\nThis image is for a children's book. It must be wholesome, child-friendly, and contain NO text, letters, words, numbers, or signs. Pure illustration only.`;

  // gpt-image-1 always returns base64 by default — response_format is not a valid param
  const body = {
    model: OPENAI_IMAGE_MODEL,
    prompt: safePrompt,
    n: 1,
    size,
    quality,
  };

  const r = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!r.ok) {
    const errText = await r.text();
    const error = new Error(`OpenAI image failed (${r.status}): ${errText.substring(0, 300)}`);
    error.status = r.status >= 500 ? 502 : r.status;
    throw error;
  }

  const data = await r.json();
  const b64 = data?.data?.[0]?.b64_json;
  if (!b64) {
    throw new Error('OpenAI returned no image data.');
  }
  return { base64: b64, mimeType: 'image/png' };
}
