/**
 * TTS Provider — cloud TTS via /api/ai/tts (OpenAI or Gemini).
 *
 * Usage:
 *   const { url, blob } = await synthesize({ text, provider: 'openai', voice: 'nova' });
 *   const audio = new Audio(url); audio.play();
 *
 * Created 2026-05-08 night per Elad — phase 1 of cloud-TTS for Sipurai narration.
 */

const PROXY_URL = '/api/ai/tts';

/**
 * Synthesize speech from text via the serverless TTS proxy.
 * @param {{ text: string, provider?: 'openai'|'gemini', voice?: string, format?: 'mp3'|'wav' }} params
 * @returns {Promise<{ url: string, blob: Blob, mimeType: string }>}
 */
export async function synthesize({ text, provider = 'openai', voice, format }) {
  if (!text || typeof text !== 'string') throw new Error('synthesize: text required');
  const r = await fetch(PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, provider, voice, format }),
  });
  if (!r.ok) {
    const errBody = await r.text();
    throw new Error(`TTS failed (${r.status}): ${errBody.substring(0, 300)}`);
  }
  const mimeType = r.headers.get('content-type') ?? 'audio/mpeg';
  const blob = await r.blob();
  const url = URL.createObjectURL(blob);
  return { url, blob, mimeType };
}

export const VOICES = {
  openai: ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer', 'coral', 'sage'],
  gemini: ['Kore', 'Charon', 'Fenrir', 'Aoede', 'Puck', 'Leda', 'Zephyr', 'Orus'],
};

export function getDefaultVoice(provider, language = 'hebrew') {
  if (provider === 'gemini') {
    return language === 'hebrew' || language === 'yiddish' ? 'Aoede' : 'Kore';
  }
  return language === 'hebrew' || language === 'yiddish' ? 'shimmer' : 'nova';
}
