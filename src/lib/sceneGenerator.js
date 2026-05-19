/**
 * Scene Generator — high-level helper that produces a structured scene-by-scene
 * outline from a story idea (theme + characters) using the existing InvokeLLM
 * pipeline. Returns shape: { scenes: Scene[] }.
 *
 * Scene shape:
 * {
 *   id: string,
 *   title: string,
 *   description: string,
 *   mood: string,        // e.g. "joyful", "tense", "calm"
 *   setting: string,     // location/time-of-day
 *   characters: string[],// character names or ids
 *   prompt_for_image: string, // illustration prompt (image-safe, child-friendly)
 * }
 *
 * Inputs:
 * @param {Object} options
 * @param {string} options.storyIdea         - free-form theme/idea (required)
 * @param {Array<{id?:string,name:string,description?:string,traits?:string}>} options.characters
 * @param {string} [options.language="english"]  "hebrew" | "english" | "yiddish"
 * @param {string} [options.ageRange="5-7"]
 * @param {number} [options.sceneCount=6]    5..8 enforced
 * @param {string} [options.genre]
 * @param {string} [options.tone]
 * @param {string} [options.artStyle]
 *
 * @returns {Promise<{scenes: Array<Object>}>}
 *
 * Notes:
 * - All AI text is run through sanitizeAIOutput at the boundary.
 * - On AI failure, returns a deterministic fallback scaffold so the UI is
 *   always usable. Error is captured via errorTracking.
 * - Uses response_json_schema so Gemini returns structured output.
 */

import { InvokeLLM } from "@/integrations/Core";
import {
  buildSafetyPromptPrefix,
  sanitizeAIOutput,
} from "@/utils/content-moderation";
import { captureError } from "@/lib/errorTracking";

const MIN_SCENES = 5;
const MAX_SCENES = 8;

function clampSceneCount(n) {
  const parsed = Number.isFinite(n) ? Math.round(n) : 6;
  return Math.max(MIN_SCENES, Math.min(MAX_SCENES, parsed));
}

function makeId() {
  return `scene_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

/**
 * Build the LLM prompt. Output language is enforced via a leading instruction
 * so the model produces Hebrew/Yiddish content when needed.
 */
function buildPrompt({
  storyIdea,
  characters,
  language,
  ageRange,
  sceneCount,
  genre,
  tone,
  artStyle,
}) {
  const safetyPrefix = buildSafetyPromptPrefix(ageRange);

  const langInstruction =
    language === "hebrew"
      ? "יש לכתוב את כל הסצנות, הכותרות, המצב-רוח, התפאורה והפרומפטים לאיורים בעברית בלבד. "
      : language === "yiddish"
      ? "שרייב די גאַנצע אינהאַלט אויף יידיש. "
      : "Write all scene content, titles, mood, setting and illustration prompts in English only. ";

  const characterLines =
    Array.isArray(characters) && characters.length > 0
      ? characters
          .map((c) => {
            const id = c.id ? ` (id:${c.id})` : "";
            const traits = c.traits ? ` — ${c.traits}` : "";
            const desc = c.description ? ` — ${c.description}` : "";
            return `- ${c.name}${id}${traits}${desc}`;
          })
          .join("\n")
      : "(no specific characters provided — invent a small, child-friendly cast)";

  const genreLine = genre ? `Genre: ${genre}. ` : "";
  const toneLine = tone ? `Tone: ${tone}. ` : "";
  const styleLine = artStyle ? `Visual style for illustrations: ${artStyle}. ` : "";

  return `${safetyPrefix}${langInstruction}You are a senior children's-book scene planner.

Plan EXACTLY ${sceneCount} scenes for a personalized children's story.

Story idea (theme): "${storyIdea}"
Target age: ${ageRange}.
${genreLine}${toneLine}${styleLine}
Characters available:
${characterLines}

The story must have:
1. A clear beginning (introduce characters + setting)
2. A small conflict or quest
3. A turning point / discovery
4. A satisfying, positive resolution
5. A warm ending

Each scene MUST contain:
- title:            short (max 60 chars), evocative
- description:      1-2 sentence beat of what happens (max 280 chars)
- mood:             one or two words (e.g. "joyful", "curious", "tense-but-safe"). Never "scary", "violent", "frightening".
- setting:          where & when (max 80 chars)
- characters:       array of character names (or ids if provided) that appear in this scene
- prompt_for_image: detailed visual description (max 400 chars). No on-image text. Child-safe, age-appropriate, no scary or violent imagery. Vibrant, warm, consistent character look across scenes.

Return JSON with a single key "scenes" — an array of EXACTLY ${sceneCount} scene objects in story order.`;
}

/**
 * Build a deterministic fallback scaffold if AI fails. UI stays usable.
 */
function buildFallback({ storyIdea, characters, language, sceneCount }) {
  const isHebrew = language === "hebrew";
  const isYiddish = language === "yiddish";
  const charNames =
    Array.isArray(characters) && characters.length > 0
      ? characters.map((c) => c.name).filter(Boolean)
      : [];

  const titles = isHebrew
    ? ["פתיחה", "המסע מתחיל", "אתגר", "תגלית", "התרת הסבך", "סיום מתוק"]
    : isYiddish
    ? ["אנהייב", "די רייזע הייבט זיך אן", "אן אויסרוף", "אנטדעקונג", "באשיידונג", "א ווארעמער סוף"]
    : ["Opening", "Journey Begins", "A Challenge", "Discovery", "Resolution", "Warm Ending"];

  const count = clampSceneCount(sceneCount);
  return Array.from({ length: count }).map((_, i) => ({
    id: makeId(),
    title: titles[i] || (isHebrew ? `סצנה ${i + 1}` : `Scene ${i + 1}`),
    description: isHebrew
      ? `נקודה ${i + 1} בסיפור על ${storyIdea}.`
      : isYiddish
      ? `סצענע ${i + 1} פֿון דעם מעשה וועגן ${storyIdea}.`
      : `Beat ${i + 1} of the story about ${storyIdea}.`,
    mood: isHebrew ? "חמים" : isYiddish ? "וואַרעם" : "warm",
    setting: isHebrew ? "ברירת מחדל — לערוך" : isYiddish ? "פאַרשטאַנדיק — רעדאַקטירן" : "default — edit",
    characters: charNames,
    prompt_for_image: isHebrew
      ? `איור ידידותי לילדים, צבעוני, של ${storyIdea}.`
      : isYiddish
      ? `קינדער-פֿרײַנדלעך אילוסטראציע פֿון ${storyIdea}.`
      : `Child-friendly, warm, colorful illustration of ${storyIdea}.`,
  }));
}

/**
 * Normalize one raw scene object from the AI into the canonical shape.
 * Sanitizes every text field at the boundary.
 */
function normalizeRawScene(raw, fallbackTitle) {
  const chars = Array.isArray(raw?.characters)
    ? raw.characters.map((c) => sanitizeAIOutput(String(c))).filter(Boolean)
    : [];

  return {
    id: raw?.id ? String(raw.id) : makeId(),
    title: sanitizeAIOutput(raw?.title || fallbackTitle || ""),
    description: sanitizeAIOutput(raw?.description || ""),
    mood: sanitizeAIOutput(raw?.mood || ""),
    setting: sanitizeAIOutput(raw?.setting || ""),
    characters: chars,
    prompt_for_image: sanitizeAIOutput(
      raw?.prompt_for_image || raw?.illustration_prompt || ""
    ),
  };
}

/**
 * Generate a structured scene plan for a story idea.
 *
 * Returns { scenes: Scene[] }. Guarantees at least MIN_SCENES on success; on
 * failure returns the fallback scaffold so the UI is editable offline.
 */
export async function generateScenePlan({
  storyIdea,
  characters = [],
  language = "english",
  ageRange = "5-7",
  sceneCount = 6,
  genre,
  tone,
  artStyle,
} = {}) {
  if (!storyIdea || typeof storyIdea !== "string" || storyIdea.trim().length < 3) {
    throw new Error("generateScenePlan: storyIdea is required (min 3 chars)");
  }

  const count = clampSceneCount(sceneCount);

  const prompt = buildPrompt({
    storyIdea: storyIdea.trim(),
    characters,
    language,
    ageRange,
    sceneCount: count,
    genre,
    tone,
    artStyle,
  });

  const sceneItemSchema = {
    type: "object",
    properties: {
      title: { type: "string" },
      description: { type: "string" },
      mood: { type: "string" },
      setting: { type: "string" },
      characters: { type: "array", items: { type: "string" } },
      prompt_for_image: { type: "string" },
    },
    required: [
      "title",
      "description",
      "mood",
      "setting",
      "characters",
      "prompt_for_image",
    ],
  };

  try {
    const result = await InvokeLLM({
      prompt,
      response_json_schema: {
        type: "object",
        properties: {
          scenes: { type: "array", items: sceneItemSchema },
        },
        required: ["scenes"],
      },
    });

    const rawScenes = Array.isArray(result?.scenes) ? result.scenes : [];

    if (rawScenes.length === 0) {
      throw new Error("AI returned an empty scenes array");
    }

    // Align to requested count: if we got fewer, pad with fallback beats.
    const fallback = buildFallback({
      storyIdea,
      characters,
      language,
      sceneCount: count,
    });

    const scenes = Array.from({ length: count }).map((_, i) => {
      const raw = rawScenes[i];
      return raw
        ? normalizeRawScene(raw, fallback[i].title)
        : fallback[i];
    });

    return { scenes };
  } catch (err) {
    captureError(
      err instanceof Error ? err : new Error(String(err?.message || err)),
      { context: "sceneGenerator.generateScenePlan", storyIdea, language, count }
    );
    return { scenes: buildFallback({ storyIdea, characters, language, sceneCount: count }) };
  }
}

/**
 * Generate just the illustration prompt for a single scene without
 * re-running the whole plan. Useful when a user edits a scene description
 * and wants a refreshed visual prompt.
 */
export async function generateSceneImagePrompt({
  scene,
  storyIdea,
  language = "english",
  ageRange = "5-7",
  artStyle,
} = {}) {
  if (!scene || !scene.description) {
    throw new Error("generateSceneImagePrompt: scene.description required");
  }

  const safetyPrefix = buildSafetyPromptPrefix(ageRange);
  const langInstruction =
    language === "hebrew"
      ? "כתוב את הפרומפט לאיור בעברית בלבד. "
      : language === "yiddish"
      ? "שרייב דעם אילוסטראציע-פראמפט אויף יידיש. "
      : "Write the illustration prompt in English only. ";

  const styleLine = artStyle ? `Visual style: ${artStyle}. ` : "";

  const prompt = `${safetyPrefix}${langInstruction}You are an art director for a children's book.

Story idea: "${storyIdea || "a warm children's story"}"
Scene: "${scene.title || ""}" — ${scene.description}
Setting: ${scene.setting || "unspecified"}
Mood: ${scene.mood || "warm"}
Characters in scene: ${(scene.characters || []).join(", ") || "(none)"}
${styleLine}

Produce ONE detailed illustration prompt (max 400 chars). Child-safe, age-appropriate, no on-image text, no scary or violent imagery. Vibrant warm colors, consistent character appearance.

Return JSON: { "prompt_for_image": "..." }`;

  try {
    const result = await InvokeLLM({
      prompt,
      response_json_schema: {
        type: "object",
        properties: { prompt_for_image: { type: "string" } },
        required: ["prompt_for_image"],
      },
    });
    return sanitizeAIOutput(result?.prompt_for_image || "");
  } catch (err) {
    captureError(
      err instanceof Error ? err : new Error(String(err?.message || err)),
      { context: "sceneGenerator.generateSceneImagePrompt" }
    );
    return scene.prompt_for_image || "";
  }
}

export const __internal = {
  buildPrompt,
  buildFallback,
  normalizeRawScene,
  clampSceneCount,
  MIN_SCENES,
  MAX_SCENES,
};
