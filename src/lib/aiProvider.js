/**
 * AI Provider — Text and image generation via Gemini.
 *
 * Production: Calls /api/ai/generate serverless proxy (API key stays server-side).
 * Development: If VITE_GEMINI_API_KEY is set, uses direct Gemini API calls
 *              for convenience. Otherwise falls back to the proxy.
 *
 * External interface (invokeLLM, generateImage, base64ToFile) is unchanged.
 */

import { getApiAuthHeaders } from '@/lib/apiAuth';

// ─── Configuration ──────────────────────────────────────────────────────────

const GEMINI_TEXT_MODEL = 'gemini-2.5-flash';
// Cost-tier image model. Was 'gemini-3-pro-image-preview' (~$0.04/img preview pricing).
// gemini-2.5-flash-image is the GA stable + ~3x cheaper. Quality difference for kids' books
// is acceptable per QA. Override via VITE_GEMINI_IMAGE_MODEL if needed.
const GEMINI_IMAGE_MODEL = import.meta.env.VITE_GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image';
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

/**
 * Whether to use direct Gemini API calls (dev with local key)
 * or the serverless proxy (production / dev without key).
 */
function useDirectApi() {
  return import.meta.env.DEV && !!import.meta.env.VITE_GEMINI_API_KEY;
}

function getApiKey() {
  const key = import.meta.env.VITE_GEMINI_API_KEY;
  if (!key) {
    throw new Error(
      'VITE_GEMINI_API_KEY is not configured. ' +
      'Add it to your .env file to use AI features in development.'
    );
  }
  return key;
}

// ─── Schema Conversion (for direct mode) ────────────────────────────────────

const TYPE_MAP = {
  string: 'STRING',
  number: 'NUMBER',
  integer: 'INTEGER',
  boolean: 'BOOLEAN',
  array: 'ARRAY',
  object: 'OBJECT',
};

function convertSchemaToGemini(schema) {
  if (!schema || typeof schema !== 'object') return schema;

  const converted = {};

  for (const [key, value] of Object.entries(schema)) {
    if (key === 'type' && typeof value === 'string') {
      converted.type = TYPE_MAP[value.toLowerCase()] || value.toUpperCase();
    } else if (key === 'properties' && typeof value === 'object') {
      converted.properties = {};
      for (const [propName, propSchema] of Object.entries(value)) {
        converted.properties[propName] = convertSchemaToGemini(propSchema);
      }
    } else if (key === 'items' && typeof value === 'object') {
      converted.items = convertSchemaToGemini(value);
    } else if (key === 'required' && Array.isArray(value)) {
      converted.required = value;
    } else if (key === 'description' && typeof value === 'string') {
      converted.description = value;
    }
  }

  return converted;
}

// ─── Proxy Calls ────────────────────────────────────────────────────────────

async function proxyCall(type, prompt, options = {}) {
  // Wave-12: 60s timeout per call so UI never hangs forever on a stalled AI provider
  const timeoutMs = type === 'image' ? 90_000 : 60_000;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const authHeaders = await getApiAuthHeaders();
    const response = await fetch('/api/ai/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({ prompt, type, options }),
      signal: ctrl.signal,
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || `AI request failed (${response.status})`);
    }

    return response.json();
  } catch (err) {
    if (err?.name === 'AbortError') {
      throw new Error(`AI request timed out after ${timeoutMs / 1000}s. Please try again.`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// ─── Text Generation (LLM) ─────────────────────────────────────────────────

/**
 * Invoke an LLM for text generation with optional structured JSON output.
 *
 * @param {Object} params
 * @param {string} params.prompt - The prompt text
 * @param {Object} [params.response_json_schema] - JSON Schema for structured output
 * @param {Object} [params.response_format] - Alternative: { type: "json_object" }
 * @param {number} [params.temperature] - Generation temperature (0-2)
 * @param {number} [params.max_tokens] - Maximum output tokens
 * @returns {Object|string} Parsed JSON object when schema is provided, raw text otherwise
 */
export async function invokeLLM({
  prompt,
  response_json_schema,
  response_format,
  temperature,
  max_tokens,
}) {
  // ── Proxy mode (production) ──
  if (!useDirectApi()) {
    const data = await proxyCall('text', prompt, {
      response_json_schema,
      response_format,
      temperature,
      max_tokens,
    });
    return data.result;
  }

  // ── Direct mode (dev with local key) ──
  const apiKey = getApiKey();
  const wantsJson = !!(response_json_schema || response_format?.type === 'json_object');

  const generationConfig = {};

  if (response_json_schema) {
    generationConfig.responseMimeType = 'application/json';
    generationConfig.responseSchema = convertSchemaToGemini(response_json_schema);
  } else if (wantsJson) {
    generationConfig.responseMimeType = 'application/json';
  }

  if (temperature !== undefined) {
    generationConfig.temperature = temperature;
  }
  if (max_tokens !== undefined) {
    generationConfig.maxOutputTokens = max_tokens;
  }

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig,
  };

  const response = await fetch(
    `${GEMINI_BASE_URL}/${GEMINI_TEXT_MODEL}:generateContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: { message: response.statusText } }));
    throw new Error(`AI text generation failed: ${err.error?.message || response.statusText}`);
  }

  const data = await response.json();

  if (data.candidates?.[0]?.finishReason === 'SAFETY') {
    throw new Error('Content was blocked by safety filters. Please try a different prompt.');
  }

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('No text generated. The model returned an empty response.');
  }

  if (wantsJson) {
    try {
      return JSON.parse(text);
    } catch {
      throw new Error('AI returned invalid JSON. Please try again.');
    }
  }

  return text;
}

// ─── Image Generation ───────────────────────────────────────────────────────

/**
 * Generate an image from a text prompt.
 *
 * Returns raw base64 data. The caller (Core.js) is responsible for
 * converting this to a persistent URL via upload.
 *
 * @param {Object} params
 * @param {string} params.prompt - Image description
 * @param {string} [params.aspectRatio='1:1'] - Aspect ratio
 * @param {'gemini'|'gemini-pro'|'openai'} [params.provider] - Image provider override (defaults to env or gemini)
 * @param {string} [params.modelId] - Smart routing: SUPPORTED_MODEL_IDS from smartModelPicker.js.
 *                                    When set, overrides `provider` argument.
 * @returns {{ base64: string, mimeType: string }}
 */
export async function generateImage({ prompt, aspectRatio = '1:1', provider, modelId, referenceImageBase64 }) {
  // ── modelId takes priority over provider when supplied (ModelSelector path) ──
  let resolvedProvider = provider;
  if (modelId) {
    if (modelId === 'dall-e-3') resolvedProvider = 'openai';
    else if (modelId === 'gemini-3-pro-image') resolvedProvider = 'gemini-pro';
    else if (modelId === 'gemini-2-5-flash-image') resolvedProvider = 'gemini';
  }

  const effectiveProvider = resolvedProvider
    ?? (typeof window !== 'undefined' && window.localStorage?.getItem('sipurai_image_provider'))
    ?? import.meta.env.VITE_IMAGE_PROVIDER
    ?? 'gemini';

  // ── Proxy mode (production) — always for OpenAI + gemini-pro since keys are server-only ──
  // referenceImageBase64 rides along to the proxy (Gemini multimodal part /
  // OpenAI image-edit endpoint). In dev-direct mode it is attached below.
  if (!useDirectApi() || effectiveProvider === 'openai' || effectiveProvider === 'gemini-pro') {
    return proxyCall('image', prompt, { aspectRatio, provider: effectiveProvider, referenceImageBase64 });
  }

  // ── Direct mode (dev with local key) ──
  const apiKey = getApiKey();

  const safePrompt = `${prompt}\n\nIMPORTANT: This image is for a children's book. It must be completely child-friendly, wholesome, and appropriate for young readers.`;

  // Character-reference workflow: same multimodal part as the server path.
  const directParts = [{ text: safePrompt }];
  if (referenceImageBase64) {
    directParts.push({ inlineData: { mimeType: 'image/png', data: referenceImageBase64 } });
  }

  const response = await fetch(
    `${GEMINI_BASE_URL}/${GEMINI_IMAGE_MODEL}:generateContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [{ parts: directParts }],
        generationConfig: {
          responseModalities: ['TEXT', 'IMAGE'],
          imageConfig: { aspectRatio },
        },
      }),
    }
  );

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: { message: response.statusText } }));
    throw new Error(`Image generation failed: ${err.error?.message || response.statusText}`);
  }

  const data = await response.json();

  if (data.candidates?.[0]?.finishReason === 'SAFETY') {
    throw new Error('Image was blocked by safety filters. Please try a different prompt.');
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

// ─── Utilities ──────────────────────────────────────────────────────────────

/**
 * Convert a base64 string to a File object for upload.
 */
export function base64ToFile(base64, mimeType = 'image/png', filename = 'generated.png') {
  const binaryStr = atob(base64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: mimeType });
  return new File([blob], filename, { type: mimeType });
}
