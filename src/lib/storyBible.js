/**
 * Story Bible — Structured story generation with consistency primitives.
 *
 * Per GPT-5 consult (2026-05-10): replaces ad-hoc multi-call flows with one
 * upfront structured "bible" that downstream renderers (text, image, TTS)
 * read from. This gives:
 *   - Character continuity (single source-of-truth for appearance)
 *   - Image-prompt continuity (every page references the SAME character desc)
 *   - Narration tone consistency (per-page tts_directions tied to story arc)
 *   - Single deterministic schema for caching + replay
 *
 * Usage:
 *   import { generateStoryBible, characterPromptFor, narrationDirectiveFor } from '@/lib/storyBible';
 *   const bible = await generateStoryBible({ topic, characters, language, ageRange, pageCount, style, preset });
 *   // bible.pages[i] has: { text, image_prompt, tts_directions }
 *
 * Opt-in: existing BookWizard/BookCreation flow is unchanged. Wire by passing
 * `useStoryBible: true` in book-creation params (TODO).
 */

import { InvokeLLM } from '@/integrations/Core';

// ─── Hebrew narration presets ───────────────────────────────────────────────
// Per GPT-5 advice: OpenAI voices are EN-tuned, so for Hebrew we steer via the
// `instructions` param (gpt-4o-mini-tts) rather than relying on voice alone.

export const NARRATION_PRESETS = {
  bedtime: {
    voice: 'sage',
    instructions:
      'Narrate in calm Israeli Hebrew with soft, gentle intonation suitable for a child winding down before sleep. ' +
      'Speak noticeably slower than conversation. Long pauses at sentence endings. ' +
      'Whisper-warm, never theatrical, never scary. Voice slightly lower in pitch than usual.',
  },
  playful: {
    voice: 'coral',
    instructions:
      'Narrate in warm, expressive Israeli Hebrew like a parent reading to an excited child aged 4-7. ' +
      'Slightly slower than conversation. Mild excitement during magical moments — not cartoonish. ' +
      'Soft pauses at sentence endings, clear enunciation, friendly smile in the voice.',
  },
  'dramatic-lite': {
    voice: 'fable',
    instructions:
      'Narrate in expressive Israeli Hebrew with mild dramatic shading appropriate for kids aged 5-9. ' +
      'Vary pace with the action — slower for setup, brisker for adventure beats. ' +
      'Distinct character voices via subtle pitch shifts, never silly. Calm landing on each page final sentence.',
  },
};

export function getNarrationPreset(presetKey = 'playful') {
  return NARRATION_PRESETS[presetKey] || NARRATION_PRESETS.playful;
}

// ─── Story Bible schema ─────────────────────────────────────────────────────
// One structured response that downstream code reads from. No re-prompting per page.

const STORY_BIBLE_SCHEMA = {
  type: 'object',
  required: ['title', 'characters', 'global_style', 'pages', 'narration_preset'],
  properties: {
    title: { type: 'string', description: 'Short, evocative book title in target language' },
    moral: { type: 'string', description: 'One-sentence age-appropriate takeaway' },
    characters: {
      type: 'array',
      description: 'Locked character descriptors (referenced verbatim in each image prompt)',
      items: {
        type: 'object',
        required: ['name', 'description'],
        properties: {
          name: { type: 'string' },
          role: { type: 'string', description: 'protagonist | sidekick | mentor | foil' },
          description: {
            type: 'string',
            description:
              'Physical anchor: age, hair, eye color, clothing, accessories, body language. Same string reused per page.',
          },
        },
      },
    },
    global_style: {
      type: 'string',
      description:
        'One sentence, reused as the style anchor in every image prompt. e.g. "warm watercolor children\'s picture book illustration, soft texture, clear composition, no text"',
    },
    narration_preset: {
      type: 'string',
      description: 'bedtime | playful | dramatic-lite — drives TTS voice + instructions',
    },
    pages: {
      type: 'array',
      description: 'Page-by-page beats',
      items: {
        type: 'object',
        required: ['page_number', 'text', 'image_prompt', 'tts_directions'],
        properties: {
          page_number: { type: 'integer' },
          beat: { type: 'string', description: 'narrative beat (setup/inciting/rising/climax/falling/resolution)' },
          text: { type: 'string', description: 'Final reading text — 2-4 sentences in target language' },
          image_prompt: {
            type: 'string',
            description:
              'Self-contained image prompt: combines global_style + character descriptors + scene action. NO TEXT in image.',
          },
          tts_directions: {
            type: 'string',
            description:
              'One-line per-page steering for TTS engine — e.g. "soft, slightly excited; pause before final word".',
          },
        },
      },
    },
  },
};

// ─── Generator ──────────────────────────────────────────────────────────────

/**
 * @param {Object} input
 * @param {string} input.topic - Story topic (in target language)
 * @param {Array<{name:string, description:string}>} [input.characters] - Pre-defined characters; if provided, locked
 * @param {'hebrew'|'english'|'yiddish'} input.language
 * @param {string} input.ageRange - "4-6", "7-9"
 * @param {number} [input.pageCount=12]
 * @param {string} [input.style='warm watercolor'] - Art style hint
 * @param {'bedtime'|'playful'|'dramatic-lite'} [input.preset='playful']
 * @param {string} [input.safetyDirective] - Safety prefix to prepend
 */
export async function generateStoryBible(input) {
  const {
    topic,
    characters = [],
    language,
    ageRange,
    pageCount = 12,
    style = 'warm watercolor children\'s picture book illustration, soft texture, clear composition, no text in image',
    preset = 'playful',
    safetyDirective = '',
  } = input;

  const langLabel = language === 'hebrew' ? 'Hebrew (עברית)' : language === 'yiddish' ? 'Yiddish (ייִדיש)' : 'English';

  const prompt = `${safetyDirective}You are a master picture-book author. Produce a complete Story Bible in ${langLabel} for a kids' picture book.

REQUIREMENTS:
- Topic: ${topic}
- Target age: ${ageRange}
- Page count: exactly ${pageCount}
- Art style anchor: ${style}
- Narration preset: ${preset}
${characters.length ? `- Pre-locked characters (use VERBATIM descriptions): ${JSON.stringify(characters)}` : ''}

RULES:
1. Final story text MUST be in ${langLabel}. No mixing of languages in the text.
2. Each page's image_prompt MUST reuse the EXACT character description from the characters[] array — same hair, clothes, age — for visual continuity across all ${pageCount} pages.
3. Each image_prompt is self-contained. It includes: (global_style) + (locked character descriptor) + (scene action) + "no text, no letters, no writing in image".
4. tts_directions are single-line per-page steering ("calm and warm, soft pause before last sentence").
5. Apply narrative arc: setup → inciting → rising → climax → falling → resolution across the ${pageCount} pages.
6. Content MUST be wholesome, child-safe, age-appropriate, never scary.
7. Hebrew/Yiddish: write naturally in target language — no English calques, no AI-tells.

Return ONLY the JSON matching the provided schema.`;

  const result = await InvokeLLM({
    prompt,
    response_json_schema: STORY_BIBLE_SCHEMA,
    temperature: 0.7,
  });

  const bible = result?.result || result;
  if (!bible || !bible.characters || !bible.pages) {
    throw new Error('Story Bible generation returned malformed structure');
  }
  return bible;
}

// ─── Helpers for downstream renderers ───────────────────────────────────────

/** Build the canonical character description string for image prompts. */
export function characterPromptFor(bible) {
  if (!bible?.characters?.length) return '';
  return bible.characters
    .map((c) => `${c.name} (${c.role || 'character'}): ${c.description}`)
    .join('. ');
}

/** Compose the final image prompt for a page — global style + characters + scene. */
export function imagePromptFor(bible, pageIndex) {
  const page = bible.pages?.[pageIndex];
  if (!page) return '';
  // The model's per-page image_prompt already inlines characters + style per the schema.
  // Helper exists so callers can override or augment without re-prompting the LLM.
  return page.image_prompt;
}

/** Get the narration preset (voice + instructions) and merge per-page directions. */
export function narrationDirectiveFor(bible, pageIndex) {
  const preset = getNarrationPreset(bible?.narration_preset);
  const page = bible?.pages?.[pageIndex];
  const pageDirection = page?.tts_directions || '';
  return {
    voice: preset.voice,
    instructions: pageDirection
      ? `${preset.instructions}\n\nPage-specific direction: ${pageDirection}`
      : preset.instructions,
  };
}
