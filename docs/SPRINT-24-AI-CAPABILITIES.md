# Sprint 24 — Sipurai full-OpenAI capabilities

Per Elad request 2026-05-09 + GPT-5 architectural consult 2026-05-10.

## What's deployed (opt-in, non-breaking)

### 1. Story Bible JSON pipeline — `src/lib/storyBible.js`
One structured upfront LLM call returns the entire book Bible:
- `title`, `moral`, `narration_preset`
- `characters[]` — locked descriptors reused VERBATIM in every page's image prompt
- `global_style` — single style anchor for visual consistency
- `pages[]` — per page: `text`, `image_prompt`, `tts_directions`

Helpers:
- `generateStoryBible({topic, characters, language, ageRange, pageCount, style, preset, safetyDirective})`
- `characterPromptFor(bible)` — string for image prompts
- `imagePromptFor(bible, pageIndex)` — final image prompt
- `narrationDirectiveFor(bible, pageIndex)` — `{voice, instructions}` merged preset + per-page

### 2. Hebrew narration presets — `NARRATION_PRESETS`
Steers `gpt-4o-mini-tts` via the `instructions` param (since voices are EN-tuned):

| Preset | Voice | Use |
|---|---|---|
| `bedtime` | sage | calm, slower, lower pitch — winding down before sleep |
| `playful` | coral | warm, expressive, mild excitement during magical moments — default |
| `dramatic-lite` | fable | mild dramatic shading, varies pace — adventures |

Each preset is Hebrew-aware: explicitly directs the model to Israeli Hebrew, slower than conversation, soft pauses at sentence endings, no theatrics, no scary tones.

### 3. Character-reference image workflow — `api/ai/openai-image-edit.js`
Generate the avatar ONCE (gpt-image-1 generate), then for every page pass that PNG as a `multipart/form-data` reference to `/v1/images/edits`. Model preserves face/clothing/proportions/palette across all 12 pages.

Wired through:
- `api/ai/generate.js` image branch — when `options.referenceImageBase64` is present, routes to image-edit instead of image-generate
- `src/lib/aiProvider.js` — `generateImage({prompt, referenceImageBase64})` accepts the new param

### 4. TTS instructions plumbing — `api/ai/tts.js` + `src/lib/ttsProvider.js`
- New optional `instructions` param (≤2000 chars) passed through to OpenAI TTS body
- `synthesize({text, voice, instructions})` client helper updated

## How to use (recommended flow for next BookWizard refactor)

```js
import { generateStoryBible, narrationDirectiveFor, imagePromptFor } from '@/lib/storyBible';
import { generateImage } from '@/lib/aiProvider';
import { synthesize } from '@/lib/ttsProvider';

// Step 1: ONE call — generate the full Bible
const bible = await generateStoryBible({
  topic: 'מסע אל הירח',
  language: 'hebrew',
  ageRange: '4-7',
  pageCount: 12,
  preset: 'bedtime',
});

// Step 2: Generate the character avatar ONCE
const avatar = await generateImage({
  prompt: bible.characters[0].description + ', portrait, ' + bible.global_style,
  aspectRatio: '1:1',
  provider: 'openai',
});

// Step 3: For every page — image-edit with the avatar + page-specific prompt
const pageImages = [];
for (let i = 0; i < bible.pages.length; i++) {
  const pageImg = await generateImage({
    prompt: imagePromptFor(bible, i),
    aspectRatio: '4:3',
    provider: 'openai',
    referenceImageBase64: avatar.url.startsWith('data:') ? avatar.url.split(',')[1] : null, // or fetch+b64 the URL
  });
  pageImages.push(pageImg);
}

// Step 4: TTS — preset + per-page directions auto-merged
const pageAudio = [];
for (let i = 0; i < bible.pages.length; i++) {
  const directive = narrationDirectiveFor(bible, i);
  const audio = await synthesize({
    text: bible.pages[i].text,
    provider: 'openai',
    voice: directive.voice,
    instructions: directive.instructions,
  });
  pageAudio.push(audio);
}
```

## Status

- ✅ All deployed (`b6bbcc5`, `<this-commit>`).
- ⚠️ Vercel env `OPENAI_API_KEY` already set (Wave-7).
- ⚠️ Existing BookWizard / BookCreation flows are unchanged — opt-in only.
- 🔜 Next: refactor BookWizard to use `generateStoryBible` end-to-end. Estimated 1 sprint, blocked on Hebrew narration QA + character-edit cost analysis.

## Per GPT-5 — what's NOT yet deployed (deferred)

- **Realtime API** for live read-aloud (child can talk back). Larger sprint.
- **Function calling for in-story interactivity** ("what should Maya do next?"). Tied to Realtime.
- **TTS streaming** (instead of full file each page). Audio quality vs latency tradeoff.
- **Tiered model selection** (gpt-5.5 for plan + final QA, gpt-5-mini for variants). Today everything goes through Gemini Flash via Core.InvokeLLM. Future: add `model` param to InvokeLLM + route by task.

## Voices reference (per provider)

OpenAI gpt-4o-mini-tts:
- `coral` — warm, parent-friendly, default for Hebrew kids per GPT-5
- `sage` — calm, lower pitch, bedtime
- `fable` — expressive, dramatic-lite
- `nova` — bright, playful (often default-EN)
- `shimmer` — softer alternative
- `alloy` / `echo` / `onyx` — adult-leaning, avoid for kids

Gemini gemini-2.5-flash-preview-tts:
- `Aoede` — default for Hebrew/Yiddish per ttsProvider.js
- `Kore` — default for English
- 6 others available
