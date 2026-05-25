/**
 * Vercel Serverless Function — Text-to-Speech proxy.
 *
 * Supports two providers:
 *   - "openai": OpenAI Audio API (gpt-4o-mini-tts) — voices: alloy/echo/fable/onyx/nova/shimmer/coral/sage
 *   - "gemini": Google Generative AI TTS (gemini-2.5-flash-preview-tts) — voices: Kore/Charon/Fenrir/Aoede/Puck/...
 *
 * POST { provider, text, voice?, format? } → audio bytes (Content-Type: audio/mpeg or audio/L16)
 *
 * Keeps API keys server-side. Created 2026-05-08 night per Elad.
 */

import { requireClerkAuth } from '../_lib/verifyClerk.js';

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 12;
const MAX_TEXT_LENGTH = 4000;
const ALLOWED_PROVIDERS = ['openai', 'gemini'];
const DEFAULT_OPENAI_VOICE = 'nova';
const DEFAULT_GEMINI_VOICE = 'Kore';
const OPENAI_TTS_MODEL = 'gpt-4o-mini-tts';
const GEMINI_TTS_MODEL = 'gemini-2.5-flash-preview-tts';

const ipHits = new Map();

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = ipHits.get(ip);
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    ipHits.set(ip, { count: 1, windowStart: now });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count += 1;
  return true;
}

function log(msg, extra) {
  console.log(`[tts] ${msg}`, extra ?? '');
}

export default async function handler(req, res) {
  const allowedOrigins = ['https://sipurai.ai', 'https://www.sipurai.ai', 'http://localhost:5173'];
  const origin = req.headers.origin;
  const corsOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', corsOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(204).end();
  }
  res.setHeader('Access-Control-Allow-Origin', corsOrigin);
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Auth: require a valid Clerk session JWT so anonymous callers can't burn
  // OpenAI/Gemini TTS quota.
  const auth = await requireClerkAuth(req);
  if (!auth.ok) {
    log('UNAUTHORIZED', auth.reason);
    return res.status(401).json({ error: 'Authentication required.' });
  }

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
  if (!checkRateLimit(ip)) {
    log('RATE_LIMITED', { ip });
    return res.status(429).json({ error: 'Too many TTS requests. Please wait.' });
  }

  const { provider = 'openai', text, voice, format = 'mp3', instructions } = req.body || {};

  if (!ALLOWED_PROVIDERS.includes(provider)) {
    return res.status(400).json({ error: `Invalid provider. Must be one of: ${ALLOWED_PROVIDERS.join(', ')}` });
  }
  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid "text" field.' });
  }
  if (text.length > MAX_TEXT_LENGTH) {
    return res.status(400).json({ error: `Text too long. Maximum ${MAX_TEXT_LENGTH} characters.` });
  }
  if (instructions !== undefined && (typeof instructions !== 'string' || instructions.length > 2000)) {
    return res.status(400).json({ error: 'Invalid instructions field (must be string ≤ 2000 chars).' });
  }

  try {
    if (provider === 'openai') {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        log('NO_OPENAI_KEY');
        return res.status(500).json({ error: 'OpenAI TTS not configured.' });
      }
      return await openaiTts(res, apiKey, text, voice ?? DEFAULT_OPENAI_VOICE, format, instructions);
    }
    if (provider === 'gemini') {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        log('NO_GEMINI_KEY');
        return res.status(500).json({ error: 'Gemini TTS not configured.' });
      }
      return await geminiTts(res, apiKey, text, voice ?? DEFAULT_GEMINI_VOICE);
    }
  } catch (err) {
    const message = err.message || 'TTS failed.';
    const status = err.status || 500;
    log('HANDLER_ERROR', { provider, status, message });
    return res.status(status).json({ error: message });
  }
}

async function openaiTts(res, apiKey, text, voice, format, instructions) {
  const body = {
    model: OPENAI_TTS_MODEL,
    voice,
    input: text,
    response_format: format === 'wav' ? 'wav' : 'mp3',
  };
  if (instructions) body.instructions = instructions;

  const r = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!r.ok) {
    const errText = await r.text();
    log('OPENAI_TTS_ERROR', { status: r.status, errText: errText.substring(0, 300) });
    const error = new Error(`OpenAI TTS failed (${r.status}): ${errText.substring(0, 200)}`);
    error.status = r.status >= 500 ? 502 : r.status;
    throw error;
  }

  const buf = Buffer.from(await r.arrayBuffer());
  res.setHeader('Content-Type', format === 'wav' ? 'audio/wav' : 'audio/mpeg');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  log('OPENAI_TTS_OK', { bytes: buf.length, voice, textLen: text.length });
  return res.status(200).send(buf);
}

async function geminiTts(res, apiKey, text, voice) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_TTS_MODEL}:generateContent`;
  const body = {
    contents: [{ parts: [{ text }] }],
    generationConfig: {
      responseModalities: ['AUDIO'],
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } },
      },
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
    log('GEMINI_TTS_ERROR', { status: r.status, errText: errText.substring(0, 300) });
    const error = new Error(`Gemini TTS failed (${r.status}): ${errText.substring(0, 200)}`);
    error.status = r.status >= 500 ? 502 : r.status;
    throw error;
  }

  const data = await r.json();
  const audioPart = data?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
  if (!audioPart) {
    log('GEMINI_NO_AUDIO');
    throw new Error('No audio in Gemini response.');
  }
  const buf = Buffer.from(audioPart.inlineData.data, 'base64');
  // Gemini returns 24kHz 16-bit mono PCM by default — wrap as WAV for browser playback
  const wav = pcmToWav(buf, 24000, 1, 16);
  res.setHeader('Content-Type', 'audio/wav');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  log('GEMINI_TTS_OK', { bytes: wav.length, voice, textLen: text.length });
  return res.status(200).send(wav);
}

function pcmToWav(pcm, sampleRate, channels, bitsPerSample) {
  const byteRate = (sampleRate * channels * bitsPerSample) / 8;
  const blockAlign = (channels * bitsPerSample) / 8;
  const dataSize = pcm.length;
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);
  return Buffer.concat([header, pcm]);
}
