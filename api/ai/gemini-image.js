/**
 * Gemini 3 Pro image generation helper — used by api/ai/generate.js when
 * provider='gemini-pro'. Returns { base64, mimeType }.
 *
 * Pattern: per ~/.claude/rules/multi-engine-design-synthesis.md — Gemini 3 Pro
 * is the strongest engine for Hebrew text fidelity inside images and for
 * scenes with embedded labels. Pre-paid Hetzner/VPS workflow already uses
 * gemini-3-pro-image-preview for Hebrew UI mockups (Triplus, Mole-AI).
 *
 * Env: GEMINI_API_KEY (required). Created 2026-05-14 for AI Studio smart routing.
 */

const GEMINI_PRO_IMAGE_MODEL = 'gemini-3-pro-image-preview';
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

export async function geminiProImage(apiKey, prompt, options = {}) {
  const { aspectRatio = '1:1' } = options;

  // Append child-safety + no-text instructions to match Gemini Fast contract.
  // Pro model is allowed Hebrew text (it handles it well) so we don't strip that.
  const safePrompt = `${prompt}\n\nThis image is for a children's book. It must be completely child-friendly, wholesome, and appropriate for young readers.`;

  const url = `${GEMINI_BASE_URL}/${GEMINI_PRO_IMAGE_MODEL}:generateContent`;

  const body = {
    contents: [{ parts: [{ text: safePrompt }] }],
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
      imageConfig: { aspectRatio },
      // CRITICAL: thinkingBudget required for gemini-3-pro-*. If omitted,
      // thinking-mode tokens eat maxOutputTokens → truncation (see
      // reference_gemini_thinking_truncation_fix_may_10.md).
      thinkingConfig: { thinkingBudget: 512 },
      maxOutputTokens: 4000,
    },
  };

  const r = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!r.ok) {
    const errText = await r.text();
    const error = new Error(
      `Gemini 3 Pro image failed (${r.status}): ${errText.substring(0, 300)}`
    );
    error.status = r.status >= 500 ? 502 : r.status;
    throw error;
  }

  const data = await r.json();

  const finishReason = data.candidates?.[0]?.finishReason;
  if (finishReason === 'SAFETY') {
    const error = new Error(
      'Image was blocked by safety filters. Please try a different prompt.'
    );
    error.status = 422;
    throw error;
  }

  const parts = data.candidates?.[0]?.content?.parts;
  if (!parts) {
    throw new Error('No image generated. The model returned an empty response.');
  }

  const imagePart = parts.find((p) => p.inlineData);
  if (!imagePart) {
    throw new Error('No image in response. The model returned text only.');
  }

  return {
    base64: imagePart.inlineData.data,
    mimeType: imagePart.inlineData.mimeType || 'image/png',
  };
}
