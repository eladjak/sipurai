# AI Providers — env vars + voices

## Environment variables (Vercel)

| Variable | Required | Purpose |
|---|---|---|
| `GEMINI_API_KEY` | yes | Existing — Gemini text + image + Gemini TTS |
| `OPENAI_API_KEY` | yes (for OpenAI features) | OpenAI image (`gpt-image-1`) + OpenAI TTS (`gpt-4o-mini-tts`) |

After adding `OPENAI_API_KEY` in Vercel project settings, redeploy for it to take effect.

## Endpoints

| Path | Method | Purpose |
|---|---|---|
| `/api/ai/generate` | POST | Text + image. Body: `{prompt, type: "text"\|"image", options: {provider: "gemini"\|"openai", aspectRatio, quality}}` |
| `/api/ai/tts` | POST | Speech. Body: `{provider: "openai"\|"gemini", text, voice?, format?}` → audio bytes |

## Client-side selection

- **Image provider** — set `localStorage.sipurai_image_provider` to `"openai"` or `"gemini"` (default `"gemini"`)
- **TTS engine** — TTSControls dropdown writes to `localStorage.sipurai_tts_engine` (`"browser"` | `"openai"` | `"gemini"`)

## Voices

### OpenAI (`gpt-4o-mini-tts`)
- alloy · echo · fable · onyx · **nova** (default-en) · **shimmer** (default-he/yi) · coral · sage

### Gemini (`gemini-2.5-flash-preview-tts`)
- **Kore** (default-en) · Charon · Fenrir · **Aoede** (default-he/yi) · Puck · Leda · Zephyr · Orus

## Cost notes

- OpenAI TTS: ~$0.015 per 1K characters (gpt-4o-mini-tts)
- Gemini TTS: free tier / pay-as-you-go (varies)
- OpenAI image: ~$0.03–0.07 per image (gpt-image-1, depends on size + quality)

## Rate limits (server-side, per-IP/min)

- `/api/ai/generate`: 20 req/min
- `/api/ai/tts`: 12 req/min

## Files

- `api/ai/generate.js` — generate proxy (Gemini text + image, OpenAI image branch)
- `api/ai/openai-image.js` — OpenAI image helper
- `api/ai/tts.js` — TTS proxy (OpenAI + Gemini, PCM→WAV for Gemini)
- `src/lib/aiProvider.js` — `invokeLLM`, `generateImage` (provider-aware)
- `src/lib/ttsProvider.js` — `synthesize`, `VOICES`, `getDefaultVoice`
- `src/hooks/useTTS.js` — `engine: 'browser' | 'openai' | 'gemini'`
- `src/components/bookReader/TTSControls.jsx` — engine selector + `getStoredTTSEngine()` helper
