/**
 * The book's *content* recipe — every prompt that decides what the story says.
 *
 * It lives here, apart from both the wizard and the reader, because two very
 * different surfaces need to build the same book:
 *
 *  - the **wizard**, which has the full form state the parent just filled in;
 *  - the **reader**, which offers to finish an interrupted book and has only
 *    the `books` row to work from.
 *
 * If each built its own prompts they would drift, and a book finished from the
 * reader would read like a different book from its own first three pages. One
 * builder, two callers.
 *
 * What the row cannot carry (and therefore what a reader-side resume loses):
 * the rhyme scheme and the scene spine are wizard-only state with no column to
 * live in, so pages written during a resume are prose and scene-unaware even if
 * the first pages rhymed. That is a real fidelity cost, accepted deliberately:
 * a book a parent can finish beats a book that stays broken. Persisting either
 * one means adding a column, which is a decision for a human — see
 * docs/INCREMENTAL-GENERATION.md.
 */

import { buildSafetyPromptPrefix, sanitizeAIOutput } from '@/utils/content-moderation';
import { IMAGE_FAILED_PREFIX } from '@/lib/bookGeneration';

const LAYOUT_TYPES = ['standard', 'image_top', 'image_full', 'text_overlay', 'two_column'];

/** Planned page count for a book's `length` setting. Cover/title page included. */
export function pageCountFor(length) {
  if (length === 'short') return 6;
  if (length === 'long') return 15;
  return 10;
}

/**
 * @param {Object} input
 * @param {Object} input.bookData        The book's own fields (form state, or the persisted row).
 * @param {Array}  [input.characters]    Selected character records.
 * @param {Array}  [input.scenes]        Wizard-only scene spine. Enriches image prompts.
 * @param {string} [input.topic]
 * @param {boolean}[input.useRhyming]
 * @param {Object} [input.rhymeSettings]
 * @param {Object} [input.storyBible]    Opt-in fast path: pre-written page texts.
 * @param {number} [input.pageCount]
 * @returns {import('@/lib/bookGeneration').GenerationRecipe}
 */
export function buildRecipe({
  bookData,
  characters = [],
  scenes = [],
  topic = '',
  useRhyming = false,
  rhymeSettings = { pattern: 'aabb' },
  storyBible = null,
  pageCount,
  defaultAgeRange = '5-10',
}) {
  const count = pageCount || pageCountFor(bookData?.length);
  const isHebrewBook = bookData?.language === 'hebrew';
  const ageRange = bookData?.age_range || defaultAgeRange;
  const safetyPrefix = buildSafetyPromptPrefix(ageRange);

  const langInstruction = isHebrewBook
    ? 'יש ליצור את כל התוכן בעברית בלבד. '
    : bookData?.language === 'yiddish'
      ? 'שרייב דעם גאנצן אינהאלט אויף יידיש. '
      : 'Create all content in English only. ';

  const characterNames = characters.map((c) => c.name).filter(Boolean).join(', ');
  const characterAppearances = characters
    .map((c) => {
      const parts = [c.name];
      const trait = c.appearance || c.description || c.traits;
      if (trait) parts.push(trait);
      return parts.join(': ');
    })
    .join('. ');

  const topicDescription = topic || bookData?.genre || bookData?.description || '';
  const artStyle = bookData?.art_style || 'watercolor';

  const outlinePrompt = `${safetyPrefix}${langInstruction}Create a detailed outline for a children's book:
- Title: ${bookData?.title || ''}
- Description: ${bookData?.description || ''}
- Topic: ${topicDescription}
- Characters: ${characterNames}
- Art style: ${artStyle}
- Tone: ${bookData?.tone || 'exciting'}
- Moral: ${bookData?.moral || 'positive message'}
- Age range: ${ageRange}

Create exactly ${count} pages (including a title page).
For each page, provide a brief description of what happens.
The story should have a clear beginning, middle, and end.`;

  const coverPrompt = `IMPORTANT: Do NOT include any text, letters, words, or writing in the illustration. Pure visual illustration only - no Hebrew letters, no English text, no numbers, no signs with text. Children's book cover art featuring characters ${characterNames} in a ${topicDescription} setting. ${characterAppearances ? `Character appearances: ${characterAppearances}.` : ''} Illustrated in ${artStyle} style. Bright, colorful, child-friendly.`;

  const nikudInstruction = isHebrewBook
    ? '\nהוסף ניקוד מלא לכל הטקסט בעברית. כל מילה חייבת לכלול ניקוד.'
    : '';

  const rhymingInstruction = useRhyming ? rhymeDirective(rhymeSettings?.pattern, isHebrewBook) : '';

  const hasScenes = Array.isArray(scenes) && scenes.length > 0;
  const charById = Object.fromEntries(characters.map((c) => [c.id, c]));

  // Updated from the `book-created` event: the outline call renames the book,
  // and later page prompts should quote the title the parent will actually see.
  const titleRef = { current: bookData?.title || '' };

  return {
    pageCount: count,
    bookFields: { ...bookData },

    // Token ceilings, and whether the model is allowed to think first.
    //
    // Both were set from measurement against the live API on 2026-08-07, not
    // from a guess:
    //
    //  - Uncapped, an outline call reached ~131KB and a page-text call ~81KB,
    //    each stopping mid-string and surfacing only as "invalid JSON".
    //  - Capped at 2048 with thinking left on, a page FAILED REPRODUCIBLY:
    //    1604 of those tokens went to internal reasoning and the answer got
    //    436. The cap did not cause a runaway, it exposed one.
    //  - With thinking off, the same page finished in 631 tokens total.
    //
    // So: writing one page of a children's story is not a reasoning task, and
    // paying 3.5x the tokens to have the model deliberate about it bought a
    // truncated answer. The outline is different — it decides the shape of the
    // whole story — so it keeps its reasoning and is given room for it.
    outlineMaxTokens: 512 * count + 4096,
    outlineThinkingBudget: undefined,
    pageMaxTokens: 2048,
    pageThinkingBudget: 0,

    outlinePrompt,
    outlineSchema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        outline: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              page_number: { type: 'number' },
              description: { type: 'string' },
            },
          },
        },
      },
    },
    coverPrompt,
    layoutFor: (i) => (i === 0 ? 'cover' : LAYOUT_TYPES[(i - 1) % LAYOUT_TYPES.length]),
    sanitize: sanitizeAIOutput,
    setTitle: (title) => {
      if (title) titleRef.current = title;
    },

    // Hebrew books get nikud on every word, and the nikud version is what a
    // child actually reads — so it is what lands in `text_content`. There is no
    // separate column for the unpointed text; it would need a migration.
    readPageText: (result) => {
      const plain = result?.text_content || '';
      const nikud = result?.text_with_nikud || '';
      return isHebrewBook && nikud ? nikud : plain;
    },

    pageTextOverride: (index) => {
      const bp = storyBible?.pages?.[index];
      if (!bp?.text) return null;
      return {
        text_content: bp.text,
        ...(isHebrewBook && bp.text_with_nikud ? { text_with_nikud: bp.text_with_nikud } : {}),
        image_prompt: bp.image_prompt || `${artStyle} illustration: ${String(bp.text).slice(0, 100)}`,
      };
    },

    pageTextSchema: () => ({
      type: 'object',
      properties: {
        text_content: { type: 'string' },
        ...(isHebrewBook ? { text_with_nikud: { type: 'string' } } : {}),
        image_prompt: { type: 'string' },
      },
    }),

    pageTextPrompt: (entry, index) => `${safetyPrefix}${langInstruction}Write the text content for page ${index} of a children's story based on this description: "${entry.description}"

Story details:
- Title: ${titleRef.current}
- Main characters: ${characterNames}
- Art style: ${artStyle}
- Target age: ${ageRange}
${index === 0 ? 'This is the title page/introduction. Keep it brief and engaging.' : ''}
${rhymingInstruction}${nikudInstruction}

Also create a detailed image generation prompt for this page.

Return as JSON with:
1. text_content: The page text${isHebrewBook ? ' (plain text without nikud)' : ''}
${isHebrewBook ? '2. text_with_nikud: The exact same page text with full nikud (vowel diacritics) on every word\n3. image_prompt: Detailed image generation prompt' : '2. image_prompt: Detailed image generation prompt'}`,

    imagePrompt: (page, index, { reference } = {}) => {
      // Page 0 is the cover/title page, so the first body scene maps to page 1.
      const sceneForPage = hasScenes
        ? scenes[Math.max(0, Math.min(scenes.length - 1, index === 0 ? 0 : index - 1))]
        : null;

      const sceneCharNames = sceneForPage?.characters?.length
        ? sceneForPage.characters.map((cid) => charById[cid]?.name).filter(Boolean).join(', ')
        : characterNames;

      const sceneAppearances = sceneForPage?.characters?.length
        ? sceneForPage.characters
            .map((cid) => {
              const c = charById[cid];
              if (!c) return null;
              const trait = c.appearance || c.description || c.traits;
              return trait ? `${c.name}: ${trait}` : c.name;
            })
            .filter(Boolean)
            .join('. ')
        : characterAppearances;

      const characterContext = sceneAppearances ? `Characters: ${sceneAppearances}. ` : '';
      const consistencyInstruction = 'CRITICAL: Maintain EXACT visual consistency for all characters across every illustration: Same hair color, eye color, skin tone, clothing in every image. Same art style, color palette, and visual mood throughout. Characters must look IDENTICAL in every page - as if drawn by the same artist. Do NOT change character appearance between pages. ';
      const noTextInstruction = 'IMPORTANT: Do NOT include any text, letters, words, or writing in the illustration. The image should contain ONLY visual elements - no Hebrew letters, no English text, no numbers, no signs with text. Pure illustration only. ';
      const sceneFraming = sceneForPage
        ? `Scene role: ${sceneForPage.role}. Scene beat: ${sceneForPage.description || sceneForPage.title || ''}. ${sceneForPage.illustration_prompt ? `Scene visual: ${sceneForPage.illustration_prompt}. ` : ''}`
        : '';
      const sceneCharLine = sceneCharNames ? `Featuring: ${sceneCharNames}. ` : '';
      const referenceInstruction = reference
        ? 'Use the attached reference image ONLY for the characters\' identity — face, hair, skin tone, colors and outfit must match it EXACTLY. Compose a NEW scene per the description. '
        : '';

      // The row's own image_prompt is the most specific beat available: the
      // outline description on a skeleton page, the model's richer prompt once
      // the text has been written. A previous failure marker is stripped so a
      // retry does not feed "[Image generation failed]" to the image model.
      const beat = String(page?.image_prompt || '').replace(IMAGE_FAILED_PREFIX, '');
      return `${consistencyInstruction}${referenceInstruction}${noTextInstruction}${characterContext}${sceneCharLine}${sceneFraming}Scene: ${beat}. Children's book illustration in ${artStyle} style. Bright, colorful, age-appropriate for ${ageRange} year olds.`;
    },
  };
}

function rhymeDirective(pattern, isHebrewBook) {
  if (pattern === 'aabb') {
    return isHebrewBook
      ? `\nכתוב את הסיפור בחרוזים מושלמים בדפוס AABB.
כללים חשובים:
- כל שתי שורות חייבות להתחרז בצורה מדויקת (לא חרוזים מאולצים)
- שמור על קצב עקבי של 6-8 מילים בשורה
- החרוזים חייבים להישמע טבעיים וזורמים, לא מאולצים
- המשמעות חשובה יותר מהחרוז - אם החרוז לא עובד, שנה את הניסוח
- כתוב כמו משורר ילדים מקצועי (בסגנון לאה גולדברג או מרים ילן-שטקליס)`
      : `\nWrite the story in perfect AABB rhyming couplets.
Rules:
- Every two lines must rhyme perfectly (not forced or awkward rhymes)
- Maintain consistent rhythm of 6-10 syllables per line
- Rhymes must sound natural and flowing, never forced
- Meaning is more important than rhyme - if a rhyme doesn't work, rephrase
- Write like a professional children's poet (Dr. Seuss / Shel Silverstein style)`;
  }

  if (pattern === 'abab') {
    return isHebrewBook
      ? `\nכתוב את הסיפור בחרוזים מושלמים בדפוס ABAB.
כללים חשובים:
- שורות 1 ו-3 מתחרזות זו עם זו בצורה מדויקת
- שורות 2 ו-4 מתחרזות זו עם זו בצורה מדויקת
- שמור על קצב עקבי של 6-8 מילים בשורה
- החרוזים חייבים להישמע טבעיים וזורמים, לא מאולצים
- כתוב כמו משורר ילדים מקצועי (בסגנון לאה גולדברג או מרים ילן-שטקליס)`
      : `\nWrite with alternating rhyme (lines 1&3 rhyme, 2&4 rhyme: ABAB pattern).
Rules:
- Lines 1 and 3 of each stanza must rhyme perfectly with each other
- Lines 2 and 4 of each stanza must rhyme perfectly with each other
- Maintain consistent rhythm of 6-10 syllables per line
- Rhymes must sound natural and flowing, never forced
- Write like a professional children's poet (Dr. Seuss / Shel Silverstein style)`;
  }

  const upper = String(pattern || '').toUpperCase();
  return isHebrewBook
    ? `\nכתוב את הסיפור בחרוזים מושלמים בתבנית ${upper}.
כללים חשובים:
- כל החרוזים חייבים להיות מדויקים ולא מאולצים
- שמור על קצב עקבי של 6-8 מילים בשורה
- כתוב כמו משורר ילדים מקצועי`
    : `\nWrite the story in perfect rhyming format with pattern: ${upper}.
Rules:
- All rhymes must be precise and natural, never forced
- Maintain consistent rhythm of 6-10 syllables per line
- Write like a professional children's poet`;
}
