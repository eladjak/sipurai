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
 * New runs recover rhyme, scene order, editorial text and art direction from
 * a private recipe saved alongside the book. Historical books can reconstruct
 * their recipe only from fields that existed when the parent made them.
 */

import { buildSafetyPromptPrefix, sanitizeAIOutput } from '@/utils/content-moderation';
import { manuscriptRequest, cleanStoryText, hebrewTitleInstruction, selectHebrewTitle } from "@/lib/storyManuscript";
import { IMAGE_FAILED_PREFIX } from '@/lib/bookGeneration';

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
 * @param {string} [input.defaultAgeRange]
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
  let cast = characters;
  const describeCast = (members) => members
    .map((c) => {
      const parts = [c.name];
      const trait = c.appearance || c.description || c.traits;
      if (trait) parts.push(trait);
      return parts.join(': ');
    })
    .join('. ');

  let characterAppearances = describeCast(cast);
  const topicDescription = topic || bookData?.genre || bookData?.description || '';
  const artStyle = bookData?.art_style || 'watercolor';

  const outlinePrompt = `${safetyPrefix}${langInstruction}Create a detailed outline for a children's book:
- Title: ${bookData?.title || ''}
${isHebrewBook ? `${hebrewTitleInstruction} החזר בשדה title את אותה כותרת בדיוק, עם ניקוד בלבד וללא שינוי אותיות או סימני פיסוק.` : ''}
- Description: ${bookData?.description || ''}
- Topic: ${topicDescription}
- Characters: ${characterNames}
- Art style: ${artStyle}
- Tone: ${bookData?.tone || 'exciting'}
- Moral: ${bookData?.moral || 'positive message'}
- Age range: ${ageRange}

Create exactly ${count} pages (including a title page).
Respect this approved sequence of scenes: ${JSON.stringify(scenes.map(({title, description}) => ({title, description})))}.
For each page, provide a brief description of what happens, why it follows from the previous scene, and what changes for the next one.
The story should have a clear beginning, middle, and end. For each supplied character, give a short visual reference sheet:
preserve the name and all supplied traits (${characterAppearances}); specify recurring face, silhouette, outfit, and one distinctive detail.`;

  // Stable per-story framing varies compositions without changing cast identity or
  // introducing random changes when a generation is resumed.
  const framingOptions = [
    'a low viewpoint looking toward the action',
    'an overhead view revealing the setting',
    'a close foreground object framing the action beyond',
    'a wide scene with the action off-center',
    'a view through an architectural or natural opening',
  ];
  const framingSeed = JSON.stringify([bookData?.title, topicDescription, scenes.map(s => [s.title, s.description]), characters.map(c => [c.name, c.appearance || c.description])]);
  const framingIndex = Array.from(framingSeed).reduce((hash, char) => (Math.imul(hash, 31) + char.codePointAt(0)) >>> 0, 0) % framingOptions.length;
  const getCoverPrompt = () => {
    const opening = scenes[0]?.illustration_prompt || scenes[0]?.description || bookData?.description || topicDescription;
    return `Children's picture-book cover in ${artStyle} style for ${JSON.stringify(titleRef.current)}. Story premise: ${topicDescription}. Opening: ${opening}. Show one distinctive object or action unique to this story. Use ${framingOptions[framingIndex]} and a silhouette that make that moment unmistakable. Cast: ${characterAppearances || characterNames}. Art must reach all four edges. Keep faces and action clear of trim and leave an uninterrupted pale area in the lower quarter for typesetting. No letters, numbers, watermarks or other writing.`;
  };

  const nikudInstruction = isHebrewBook
    ? '\nהוסף ניקוד מלא לכל הטקסט בעברית. כל מילה חייבת לכלול ניקוד.'
    : '';

  const rhymingInstruction = useRhyming ? rhymeDirective(rhymeSettings?.pattern, isHebrewBook) : '';

  const hasScenes = Array.isArray(scenes) && scenes.length > 0;
  let charById = Object.fromEntries(characters.map((c) => [c.id, c]));

  // Updated from the `book-created` event: the outline call renames the book,
  // and later page prompts should quote the title the parent will actually see.
  const titleRef = { current: bookData?.title || '' };

  const bookFields = { ...bookData };
  function applyCastSheet(sheet) {
    if (!Array.isArray(sheet) || !characters.length) return;
    cast = characters.map(character => {
      const entry = sheet.find(item => item?.name === character.name);
      if (typeof entry?.description !== 'string' || !entry.description.trim()) return character;
      const base = character.appearance || character.description || character.traits || '';
      return { ...character, appearance: [base, entry.description.trim().slice(0, 450)].filter(Boolean).join('. ') };
    });
    characterAppearances = describeCast(cast);
    charById = Object.fromEntries(cast.map(character => [character.id, character]));
    bookFields.selectedCharacters = cast.map(({id, name, appearance, description, traits}) =>
      ({id, name, appearance, description, traits})
    );
  }

  return {
    checkpointInputs: () => ({
      bookData: Object.fromEntries(['title', 'description', 'language', 'age_range', 'genre', 'length', 'tone', 'art_style', 'print_size', 'moral']
        .filter(key => bookData[key] != null).map(key => [key, bookData[key]])),
      characters: cast.map(({id, name, appearance, description, traits}) => ({id, name, appearance, description, traits})),
      scenes, topic, useRhyming, rhymeSettings, pageCount: count,
      ...(storyBible && { storyBible }),
    }),
    pageCount: count,
    approvedTitle: bookData.title?.trim(),
    selectTitle: (candidate) => isHebrewBook ? selectHebrewTitle(bookData.title?.trim(), candidate) : (bookData.title?.trim() || candidate),
    bookFields,
    applyCastSheet: sheet => applyCastSheet(storyBible?.characters || sheet),

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
        cast: { type: 'array', items: { type: 'object', properties: {
          name: { type: 'string' }, description: { type: 'string' },
        } } },
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
    manuscriptRequest: storyBible ? null : (outline, title) => manuscriptRequest({
      outline, title, language: bookData.language || 'english', cast: characterAppearances,
      scenes, tone: bookData.tone, ageRange, rhyme: rhymingInstruction, safety: safetyPrefix,
    }),
    get coverPrompt() { return getCoverPrompt(); },
    layoutFor: (i) => (i === 0 ? 'cover' : 'image_full'),
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
      return cleanStoryText(isHebrewBook && nikud ? nikud : plain, isHebrewBook);
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

Story sequence for continuity: ${JSON.stringify(entry.outline || [])}. Keep the same cast, setting and causal sequence.
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
      const noTextInstruction = 'Extend the scene to all four edges with no borders. Keep faces, hands and action clear of the trim and the quiet lower quarter reserved for typesetting. Continue the setting through that quiet area with simple, low-detail scenery. No letters, numbers, signs or other writing. ';
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
      const openingComposition = index === 1 ? `Establish the world in a new composition distinct from the cover: use ${framingOptions[(framingIndex + 1) % framingOptions.length]}. Use the concrete setting and visible action of this opening scene. ` : '';
      return `${consistencyInstruction}${referenceInstruction}${noTextInstruction}${openingComposition}${characterContext}${sceneCharLine}${sceneFraming}Scene: ${beat}. Children's book illustration in ${artStyle} style. Bright, colorful, age-appropriate for ${ageRange} year olds.`;
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
