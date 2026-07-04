/**
 * Vercel Serverless Function — AI generation proxy.
 *
 * Keeps GEMINI_API_KEY server-side (never shipped to the browser).
 * Accepts POST { prompt, type, options } and proxies to Google Generative AI.
 *
 * type: "text" | "image"
 */

import { requireClerkAuth } from '../_lib/verifyClerk.js';

// ─── Simple in-memory rate limiter (per IP, resets every minute) ─────────────

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 20; // max requests per IP per minute

const ipHits = new Map(); // ip -> { count, windowStart }

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = ipHits.get(ip);

  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    ipHits.set(ip, { count: 1, windowStart: now });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return false;
  }

  entry.count += 1;
  return true;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const GEMINI_TEXT_MODEL = process.env.GEMINI_TEXT_MODEL || 'gemini-2.5-flash';
// Cost-tier image model. Was 'gemini-3-pro-image-preview' (~$0.04/img preview pricing,
// caused April→May bill spike). gemini-2.5-flash-image is GA stable + ~3x cheaper.
// Quality acceptable for kids' books per QA. Override via env GEMINI_IMAGE_MODEL.
const GEMINI_IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image';
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

// ─── Diagnostic Logging ─────────────────────────────────────────────────────

function log(label, data) {
  const ts = new Date().toISOString();
  console.log(`[generate.js][${ts}] ${label}`, JSON.stringify(data, null, 0));
}

const MAX_PROMPT_LENGTH = 12_000;
const ALLOWED_TYPES = ['text', 'image'];

// ─── Schema Conversion ──────────────────────────────────────────────────────

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

// ─── Handler ─────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  // CORS preflight — restrict to our domain only
  const allowedOrigins = ['https://sipurai.ai', 'https://www.sipurai.ai', 'http://localhost:5173'];
  const origin = req.headers.origin;
  const corsOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', corsOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(204).end();
  }

  // Set CORS for all responses
  res.setHeader('Access-Control-Allow-Origin', corsOrigin);

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Auth: require a valid Clerk session JWT so anonymous callers can't burn
  // Gemini/OpenAI quota. (Verifies RS256 signature against Clerk JWKS.)
  const auth = await requireClerkAuth(req);
  if (!auth.ok) {
    log('UNAUTHORIZED', { reason: auth.reason });
    return res.status(401).json({ error: 'Authentication required.' });
  }

  // Rate limit
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
  if (!checkRateLimit(ip)) {
    log('RATE_LIMITED', { ip });
    return res.status(429).json({ error: 'Too many requests. Please wait a moment.' });
  }

  // Validate API key is configured server-side
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    log('NO_API_KEY', { hasKey: false });
    return res.status(500).json({ error: 'AI service is not configured.' });
  }

  // Parse and validate request body
  const { prompt, type, options } = req.body || {};

  log('REQUEST', {
    type,
    promptLength: prompt?.length || 0,
    promptPreview: typeof prompt === 'string' ? prompt.substring(0, 120) : '(not a string)',
    hasOptions: !!options,
    ip: ip.substring(0, 8) + '...',
  });

  if (!prompt || typeof prompt !== 'string') {
    log('INVALID_PROMPT', { prompt: typeof prompt });
    return res.status(400).json({ error: 'Missing or invalid "prompt" field.' });
  }

  if (prompt.length > MAX_PROMPT_LENGTH) {
    return res.status(400).json({ error: `Prompt too long. Maximum ${MAX_PROMPT_LENGTH} characters.` });
  }

  if (!type || !ALLOWED_TYPES.includes(type)) {
    return res.status(400).json({ error: 'Invalid "type". Must be "text" or "image".' });
  }

  try {
    if (type === 'text') {
      const result = await handleText(apiKey, prompt, options);
      log('TEXT_SUCCESS', { hasResult: !!result?.result, resultLength: typeof result?.result === 'string' ? result.result.length : 'json' });
      return res.status(200).json(result);
    }

    if (type === 'image') {
      // Provider routing: 'openai' (DALL-E gpt-image-1), 'gemini-pro' (gemini-3-pro-image-preview
      // for Hebrew+rich text), or 'gemini' (gemini-2.5-flash-image, cost tier default).
      const rawProvider = options?.provider;
      const provider =
        rawProvider === 'openai' ? 'openai'
        : rawProvider === 'gemini-pro' ? 'gemini-pro'
        : 'gemini';
      let result;
      if (provider === 'openai') {
        const oaKey = process.env.OPENAI_API_KEY;
        if (!oaKey) {
          log('IMAGE_OPENAI_NO_KEY');
          return res.status(500).json({ error: 'OpenAI not configured for images.' });
        }
        // Character-reference workflow: pass referenceImageBase64 to use image-edit endpoint
        // for cross-page character continuity (Sprint 24).
        if (options?.referenceImageBase64) {
          const { openaiImageEdit } = await import('./openai-image-edit.js');
          result = await openaiImageEdit(oaKey, prompt, options);
        } else {
          const { openaiImage } = await import('./openai-image.js');
          result = await openaiImage(oaKey, prompt, options);
        }
      } else if (provider === 'gemini-pro') {
        const { geminiProImage } = await import('./gemini-image.js');
        result = await geminiProImage(apiKey, prompt, options);
      } else {
        result = await handleImage(apiKey, prompt, options);
      }
      log('IMAGE_SUCCESS', { provider, hasBase64: !!result?.base64, base64Length: result?.base64?.length || 0, mimeType: result?.mimeType, mode: options?.referenceImageBase64 ? 'edit' : 'generate' });
      return res.status(200).json(result);
    }
  } catch (err) {
    const message = err.message || 'AI generation failed.';
    const status = err.status || 500;
    log('HANDLER_ERROR', { type, status, message, stack: err.stack?.substring(0, 300) });
    return res.status(status).json({ error: message });
  }
}

// ─── Text Generation ─────────────────────────────────────────────────────────

async function handleText(apiKey, prompt, options = {}) {
  const { response_json_schema, response_format, temperature, max_tokens } = options;

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

  const response = await fetch(
    `${GEMINI_BASE_URL}/${GEMINI_TEXT_MODEL}:generateContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig,
      }),
    }
  );

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: { message: response.statusText } }));
    const error = new Error(`AI text generation failed: ${err.error?.message || response.statusText}`);
    error.status = response.status >= 500 ? 502 : response.status;
    throw error;
  }

  const data = await response.json();

  if (data.candidates?.[0]?.finishReason === 'SAFETY') {
    const error = new Error('Content was blocked by safety filters. Please try a different prompt.');
    error.status = 422;
    throw error;
  }

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('No text generated. The model returned an empty response.');
  }

  if (wantsJson) {
    try {
      return { result: JSON.parse(text) };
    } catch {
      throw new Error('AI returned invalid JSON. Please try again.');
    }
  }

  return { result: text };
}

// ─── Image Generation ────────────────────────────────────────────────────────

async function handleImage(apiKey, prompt, options = {}) {
  const { aspectRatio = '1:1', referenceImageBase64 } = options;

  // Append child-safety and no-text instructions
  const safePrompt = `${prompt}\n\nIMPORTANT: This image is for a children's book. It must be completely child-friendly, wholesome, and appropriate for young readers. Do NOT include any text, letters, words, or writing in the illustration. The image should contain ONLY visual elements - no Hebrew letters, no English text, no numbers, no signs with text. Pure illustration only.`;

  // Character-reference workflow (Sprint 24 plumbing → wired 2026-07-05): when
  // a reference image is provided, attach it as a multimodal part so
  // gemini-2.5-flash-image keeps the characters visually identical across pages.
  const parts = [{ text: safePrompt }];
  if (referenceImageBase64) {
    parts.push({ inlineData: { mimeType: 'image/png', data: referenceImageBase64 } });
  }

  const url = `${GEMINI_BASE_URL}/${GEMINI_IMAGE_MODEL}:generateContent`;
  log('IMAGE_API_CALL', { url, model: GEMINI_IMAGE_MODEL, aspectRatio, promptLength: safePrompt.length, hasReference: !!referenceImageBase64 });

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
        imageConfig: { aspectRatio },
      },
    }),
  });

  log('IMAGE_API_RESPONSE', { status: response.status, ok: response.ok, statusText: response.statusText });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: { message: response.statusText } }));
    log('IMAGE_API_ERROR', { status: response.status, errorBody: JSON.stringify(err).substring(0, 500) });
    const error = new Error(`Image generation failed: ${err.error?.message || response.statusText}`);
    error.status = response.status >= 500 ? 502 : response.status;
    throw error;
  }

  const data = await response.json();

  const finishReason = data.candidates?.[0]?.finishReason;
  const partCount = data.candidates?.[0]?.content?.parts?.length || 0;
  const partTypes = data.candidates?.[0]?.content?.parts?.map((p) =>
    p.inlineData ? `image(${p.inlineData.mimeType})` : p.text ? `text(${p.text.length}chars)` : 'unknown'
  ) || [];
  log('IMAGE_API_PARSED', { finishReason, partCount, partTypes, hasCandidates: !!data.candidates?.length });

  if (finishReason === 'SAFETY') {
    log('IMAGE_SAFETY_BLOCK', { promptPreview: prompt.substring(0, 100) });
    const error = new Error('Image was blocked by safety filters. Please try a different prompt.');
    error.status = 422;
    throw error;
  }

  const parts = data.candidates?.[0]?.content?.parts;
  if (!parts) {
    log('IMAGE_NO_PARTS', { rawCandidates: JSON.stringify(data.candidates || null).substring(0, 500) });
    throw new Error('No image generated. The model returned an empty response.');
  }

  const imagePart = parts.find((p) => p.inlineData);
  if (!imagePart) {
    log('IMAGE_NO_INLINE_DATA', { partTypes });
    throw new Error('No image in response. The model returned text only.');
  }

  return {
    base64: imagePart.inlineData.data,
    mimeType: imagePart.inlineData.mimeType || 'image/png',
  };
}
