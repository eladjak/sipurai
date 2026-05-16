/**
 * Core integrations — AI text, image generation, and file uploads.
 *
 * Phase 1: AI text + image generation → Gemini API (direct, no Base44)
 * Phase 2: File uploads → Supabase Storage (no more Base44 for storage)
 *
 * All existing callers import from this file and need NO changes.
 */

import {
  invokeLLM as geminiInvokeLLM,
  generateImage as geminiGenerateImage,
  base64ToFile,
} from '../lib/aiProvider';
import { uploadFileToSupabase } from '../lib/supabaseClient';
import { safeAsync, Result } from '../lib/resultHelper';

// ─── Text Generation ────────────────────────────────────────────────────────
// Powered by Gemini API directly

export async function InvokeLLM(params) {
  return geminiInvokeLLM(params);
}

// ─── Image Generation ───────────────────────────────────────────────────────
// Routes to backend per modelId (DALL-E / Gemini 3 Pro / Gemini Fast).
// Returned base64 is uploaded to Supabase Storage → persistent URL.
//
// modelId param (new, optional): pass from ModelSelector or SmartAutoSelector.
//   - 'dall-e-3'              → OpenAI gpt-image-1
//   - 'gemini-3-pro-image'    → Gemini 3 Pro (Hebrew text + rich illustration)
//   - 'gemini-2-5-flash-image'→ Gemini 2.5 Flash (default cost tier)
//   - undefined               → existing default routing (env / localStorage)

export async function GenerateImage({ prompt, quality, size, modelId, aspectRatio }) {
  if (import.meta.env.DEV) {
    console.log('[Core.GenerateImage] Starting image generation, prompt length:', prompt?.length, 'modelId:', modelId);
  }

  // Wrap 3rd-party AI fetch in Result at the boundary (no try/catch in business logic).
  const genResult = await safeAsync(() =>
    geminiGenerateImage({ prompt, modelId, aspectRatio })
  );

  if (genResult.isErr) {
    const err = genResult.error();
    console.error('[Core.GenerateImage] image generation FAILED:', err?.message || err);
    throw err;
  }

  const { base64, mimeType } = genResult.unwrap();

  if (!base64) {
    console.error('[Core.GenerateImage] No base64 data received from provider');
    throw new Error('Image generation returned no data');
  }

  const file = base64ToFile(base64, mimeType, `sipurai-${Date.now()}.png`);

  // Upload is also wrapped in Result; on failure fall back to inline data URI.
  const uploadResult = await safeAsync(() => uploadFileToSupabase(file, 'generated'));
  if (uploadResult.isOk) {
    const url = uploadResult.unwrap().file_url;
    if (import.meta.env.DEV) console.log('[Core.GenerateImage] Upload success, URL:', url?.substring(0, 80));
    return { url };
  }

  if (import.meta.env.DEV) {
    console.warn('[Core.GenerateImage] Supabase upload failed, using data URI fallback:', uploadResult.error()?.message);
  }
  return { url: `data:${mimeType};base64,${base64}` };
}

// ─── File Upload ────────────────────────────────────────────────────────────
// Now uses Supabase Storage

export async function UploadFile({ file }) {
  return uploadFileToSupabase(file, 'uploads');
}

