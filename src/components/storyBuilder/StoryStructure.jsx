import React, { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sparkles,
  RefreshCw,
  Wand2,
  Film,
  Plus,
  AlertCircle
} from "lucide-react";
import { InvokeLLM } from "@/integrations/Core";
import {
  buildSafetyPromptPrefix,
  sanitizeAIOutput
} from "@/utils/content-moderation";
import { captureError } from "@/lib/errorTracking";
import { useI18n } from "@/components/i18n/i18nProvider";
import SceneCard from "./SceneCard";

/**
 * Safe translation lookup. Our i18n provider returns the key itself when a
 * translation is missing. This helper treats the dotted-key echo as missing
 * and falls back to the inline default.
 */
function tx(t, key, fallback) {
  const v = t(key);
  if (!v || v === key) return fallback;
  if (typeof v === "string" && v.includes(".") && v.startsWith(key.split(".")[0] + ".")) {
    return fallback;
  }
  return v;
}

/**
 * Canonical 4-scene structure (beginning / conflict / resolution / end).
 * 6-scene mode adds rising + climax. Used both as the AI's contract
 * (return EXACTLY this many roles in this order) and as the local fallback
 * when AI generation fails.
 */
const STRUCTURE_4 = ["beginning", "conflict", "resolution", "end"];
const STRUCTURE_6 = [
  "beginning",
  "rising",
  "conflict",
  "climax",
  "resolution",
  "end"
];

/**
 * Generate a stable id for a new scene without bringing in uuid as a dep.
 */
function newSceneId() {
  return `scene_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Build a fallback structure when AI is unavailable / fails.
 * Pre-populates each scene with the user's selected characters so the
 * character-scene integration is still demonstrable offline.
 */
function buildFallbackScenes(structure, characters) {
  return structure.map((role) => ({
    id: newSceneId(),
    role,
    title: "",
    description: "",
    characters: characters.map((c) => c.id),
    illustration_prompt: ""
  }));
}

/**
 * Normalize an AI scene payload into the canonical shape, sanitizing all
 * AI-produced text fields and dropping any character ids that aren't in the
 * current selection.
 */
function normalizeScene(raw, role, allCharIds) {
  const requestedChars = Array.isArray(raw?.characters) ? raw.characters : [];
  const filtered = requestedChars
    .map((id) => String(id))
    .filter((id) => allCharIds.includes(id));

  return {
    id: raw?.id || newSceneId(),
    role: raw?.role || role,
    title: sanitizeAIOutput(raw?.title || ""),
    description: sanitizeAIOutput(raw?.description || ""),
    characters: filtered.length > 0 ? filtered : allCharIds, // default: every selected char appears
    illustration_prompt: sanitizeAIOutput(raw?.illustration_prompt || "")
  };
}

/**
 * StoryStructure — generates and edits a 4-6 scene story spine.
 *
 * Sits between the Characters step and the Preview/Edit step in BookWizard.
 * Surfaces structure to the user (beginning → conflict → resolution → end),
 * binds each scene to selected characters via chips, and emits the scene
 * list upward so the final book-creation pipeline can re-use the
 * scene-level illustration prompts.
 *
 * @param {Object} props
 * @param {Array} props.scenes - array of scene objects (controlled)
 * @param {Function} props.onScenesChange - (scenes) => void
 * @param {string} props.topic - selected topic (canonical id or custom text)
 * @param {string} props.customIdea - free-form idea when topic === "custom"
 * @param {Array} props.selectedCharacters - wizard-selected characters
 * @param {string} props.language - book content language (english|hebrew|yiddish)
 * @param {string} props.ageRange - e.g. "5-7"
 * @param {boolean} props.isRTL
 * @param {number} [props.defaultSceneCount=4] - 4 or 6
 */
export default function StoryStructure({
  scenes,
  onScenesChange,
  topic,
  customIdea,
  selectedCharacters = [],
  language = "english",
  ageRange = "5-7",
  isRTL,
  defaultSceneCount = 4
}) {
  const { t } = useI18n();
  const isHebrew = language === "hebrew";
  const isYiddish = language === "yiddish";

  const [sceneCount, setSceneCount] = useState(defaultSceneCount);
  const [isGenerating, setIsGenerating] = useState(false);
  const [regeneratingIndex, setRegeneratingIndex] = useState(null);
  const [error, setError] = useState(null);

  const allCharIds = selectedCharacters.map((c) => c.id);

  const structure = sceneCount === 6 ? STRUCTURE_6 : STRUCTURE_4;

  // Translations with safe fallbacks (i18n keys may not be wired yet).
  // Uses tx() so a missing key resolves to the inline fallback.
  const labels = {
    title: tx(t, "storyBuilder.structure.title", isHebrew ? "מבנה הסיפור" : "Story Structure"),
    subtitle: tx(
      t,
      "storyBuilder.structure.subtitle",
      isHebrew
        ? "בנה את שלד הסיפור — סצנה אחרי סצנה. תוכל לערוך כל סצנה."
        : "Build the story spine — scene by scene. Edit any scene below."
    ),
    generate: tx(t, "storyBuilder.structure.generate", isHebrew ? "צור מבנה אוטומטית" : "Generate structure"),
    regenerate: tx(t, "storyBuilder.structure.regenerate", isHebrew ? "צור מחדש" : "Regenerate all"),
    countLabel: tx(t, "storyBuilder.structure.countLabel", isHebrew ? "כמה סצנות?" : "How many scenes?"),
    fourLabel: tx(t, "storyBuilder.structure.four", isHebrew ? "4 — קלאסי" : "4 — Classic"),
    sixLabel: tx(t, "storyBuilder.structure.six", isHebrew ? "6 — מעמיק" : "6 — Detailed"),
    empty: tx(
      t,
      "storyBuilder.structure.empty",
      isHebrew
        ? "עדיין לא נוצר מבנה. לחץ על \"צור מבנה אוטומטית\" כדי להתחיל."
        : "No structure yet. Click \"Generate structure\" to begin."
    ),
    addScene: tx(t, "storyBuilder.structure.addScene", isHebrew ? "הוסף סצנה" : "Add scene"),
    errorTitle: tx(t, "storyBuilder.structure.errorTitle", isHebrew ? "ייצור המבנה נכשל" : "Couldn't generate structure"),
    errorRetry: tx(t, "storyBuilder.structure.errorRetry", isHebrew ? "נסה שוב" : "Try again")
  };

  /**
   * Build the prompt sent to InvokeLLM. The system role is enforced at the
   * top of the prompt; the response_json_schema below makes Gemini return
   * structured output.
   */
  const buildPrompt = useCallback(
    (roles) => {
      const safetyPrefix = buildSafetyPromptPrefix(ageRange);
      const langInstruction =
        language === "hebrew"
          ? "יש ליצור את כל התוכן בעברית בלבד. "
          : language === "yiddish"
          ? "שרייב דעם גאנצן אינהאלט אויף יידיש. "
          : "Create all content in English only. ";

      const topicText =
        topic === "custom" && customIdea ? customIdea : topic || "an adventure";

      const characterLines = selectedCharacters
        .map((c) => {
          const traits = c.traits ? ` — ${c.traits}` : "";
          return `- id: "${c.id}" | name: "${c.name}"${traits}`;
        })
        .join("\n");

      const allowedIds = selectedCharacters.map((c) => c.id).join(", ");

      const rolesList = roles
        .map((r, i) => `${i + 1}. ${r}`)
        .join("\n");

      return `${safetyPrefix}${langInstruction}You are a children's book scene planner.

Plan a story spine of EXACTLY ${roles.length} scenes for a children's book about: "${topicText}"
Target age: ${ageRange}.

Each scene MUST be returned in this canonical order, with the matching "role" string:
${rolesList}

Available characters (use their EXACT ids in the characters[] array, never invent new ids):
${characterLines || "(no specific characters; invent a small cast)"}

Allowed character ids: [${allowedIds}]

For each scene return:
- role: one of "${roles.join('", "')}"
- title: short scene title (max 60 chars)
- description: 1-2 sentence beat of what happens (max 300 chars)
- characters: array of character ids that appear in THIS scene; use only ids from the allowed list
- illustration_prompt: visual description for the page art (max 400 chars, no text-in-image, child-friendly)

Return the scenes as a JSON object with key "scenes" (array of ${roles.length} scenes), in canonical order.`;
    },
    [topic, customIdea, selectedCharacters, language, ageRange]
  );

  /**
   * Generate (or regenerate) the full set of scenes via the AI.
   */
  const generateScenes = useCallback(async () => {
    if (!topic && !customIdea) {
      setError(
        tx(
          t,
          "storyBuilder.structure.errorNoTopic",
          isHebrew
            ? "בחר נושא לפני יצירת המבנה."
            : "Pick a topic before generating the structure."
        )
      );
      return;
    }
    if (selectedCharacters.length === 0) {
      setError(
        tx(
          t,
          "storyBuilder.structure.errorNoChars",
          isHebrew
            ? "בחר לפחות דמות אחת לפני יצירת המבנה."
            : "Pick at least one character first."
        )
      );
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const roles = structure;
      const prompt = buildPrompt(roles);

      const sceneSchema = {
        type: "object",
        properties: {
          role: { type: "string" },
          title: { type: "string" },
          description: { type: "string" },
          characters: {
            type: "array",
            items: { type: "string" }
          },
          illustration_prompt: { type: "string" }
        },
        required: [
          "role",
          "title",
          "description",
          "characters",
          "illustration_prompt"
        ]
      };

      const result = await InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            scenes: {
              type: "array",
              items: sceneSchema
            }
          },
          required: ["scenes"]
        }
      });

      const rawScenes = Array.isArray(result?.scenes) ? result.scenes : [];

      // Align AI output with canonical roles. If AI returned fewer items than
      // expected, fall through to a stub for the missing roles.
      const normalized = roles.map((role, i) =>
        normalizeScene(
          rawScenes[i] || { role },
          role,
          allCharIds
        )
      );

      onScenesChange(normalized);
    } catch (err) {
      captureError(
        err instanceof Error ? err : new Error(String(err?.message || err)),
        { context: "StoryStructure.generateScenes" }
      );
      setError(
        `${labels.errorTitle}: ${err?.message?.slice(0, 200) || "unknown"}`
      );
      // Even on failure, seed empty fallback scenes so the UI is editable
      if (!scenes || scenes.length === 0) {
        onScenesChange(buildFallbackScenes(structure, selectedCharacters));
      }
    } finally {
      setIsGenerating(false);
    }
  }, [
    topic,
    customIdea,
    selectedCharacters,
    structure,
    buildPrompt,
    onScenesChange,
    allCharIds,
    scenes,
    labels.errorTitle,
    isHebrew,
    t
  ]);

  /**
   * Regenerate a single scene in place — keeps the others stable.
   */
  const regenerateOne = useCallback(
    async (index) => {
      const role = scenes[index]?.role || structure[index] || "scene";
      setRegeneratingIndex(index);
      try {
        const safetyPrefix = buildSafetyPromptPrefix(ageRange);
        const langInstruction =
          language === "hebrew"
            ? "יש ליצור את התוכן בעברית בלבד. "
            : language === "yiddish"
            ? "שרייב דעם אינהאלט אויף יידיש. "
            : "Create the content in English only. ";

        const topicText =
          topic === "custom" && customIdea
            ? customIdea
            : topic || "an adventure";

        const contextSummary = scenes
          .map((s, i) => `${i + 1}. (${s.role}) ${s.title || "—"}: ${s.description || "—"}`)
          .join("\n");

        const allowedIds = selectedCharacters.map((c) => c.id).join(", ");

        const prompt = `${safetyPrefix}${langInstruction}You are a children's book scene planner.
Topic: "${topicText}". Age: ${ageRange}.

Here is the existing story spine:
${contextSummary}

Rewrite scene #${index + 1} (role: "${role}") only — keep it consistent with the surrounding scenes.
Allowed character ids: [${allowedIds}].

Return JSON with: role, title (max 60), description (max 300), characters (array of allowed ids), illustration_prompt (max 400, no text-in-image, child-friendly).`;

        const result = await InvokeLLM({
          prompt,
          response_json_schema: {
            type: "object",
            properties: {
              role: { type: "string" },
              title: { type: "string" },
              description: { type: "string" },
              characters: { type: "array", items: { type: "string" } },
              illustration_prompt: { type: "string" }
            },
            required: ["role", "title", "description", "illustration_prompt"]
          }
        });

        const normalized = normalizeScene(result || { role }, role, allCharIds);
        // Preserve the existing scene id so React keys stay stable
        normalized.id = scenes[index]?.id || normalized.id;

        const next = [...scenes];
        next[index] = normalized;
        onScenesChange(next);
      } catch (err) {
        captureError(
          err instanceof Error ? err : new Error(String(err?.message || err)),
          { context: "StoryStructure.regenerateOne", index }
        );
        setError(
          `${labels.errorTitle}: ${err?.message?.slice(0, 200) || "unknown"}`
        );
      } finally {
        setRegeneratingIndex(null);
      }
    },
    [
      scenes,
      structure,
      topic,
      customIdea,
      selectedCharacters,
      language,
      ageRange,
      onScenesChange,
      allCharIds,
      labels.errorTitle
    ]
  );

  /**
   * Patch a single scene's editable fields from a SceneCard.
   */
  const updateScene = useCallback(
    (index, patch) => {
      const next = scenes.map((s, i) => (i === index ? { ...s, ...patch } : s));
      onScenesChange(next);
    },
    [scenes, onScenesChange]
  );

  // When the user toggles 4 ↔ 6, if scenes already exist, regenerate so the
  // role list matches. If no scenes yet, just update the count.
  useEffect(() => {
    if (scenes && scenes.length > 0 && scenes.length !== structure.length) {
      // Don't auto-regenerate — just let the user re-press the button so
      // they're aware it'll re-call the AI.
    }
  }, [structure.length, scenes]);

  const hasScenes = Array.isArray(scenes) && scenes.length > 0;

  return (
    <div className="space-y-5" dir={isRTL ? "rtl" : "ltr"}>
      {/* Header */}
      <div className="text-center mb-2">
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div
            className={`flex items-center justify-center gap-2 mb-2 ${
              isRTL ? "flex-row-reverse" : ""
            }`}
          >
            <Film className="h-6 w-6 text-purple-600" aria-hidden="true" />
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
              {labels.title}
            </h2>
          </div>
          <p className="text-gray-500 dark:text-gray-400 text-base">
            {labels.subtitle}
          </p>
        </motion.div>
      </div>

      {/* Scene-count toggle + Generate button */}
      <div
        className={`flex flex-wrap items-center justify-center gap-3 ${
          isRTL ? "flex-row-reverse" : ""
        }`}
      >
        <div
          className={`inline-flex rounded-xl bg-gray-100 dark:bg-gray-800 p-1 ${
            isRTL ? "flex-row-reverse" : ""
          }`}
          role="radiogroup"
          aria-label={labels.countLabel}
        >
          {[
            { value: 4, label: labels.fourLabel },
            { value: 6, label: labels.sixLabel }
          ].map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={sceneCount === opt.value}
              onClick={() => setSceneCount(opt.value)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-150 ${
                sceneCount === opt.value
                  ? "bg-white dark:bg-gray-900 text-purple-700 dark:text-purple-300 shadow-sm"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <motion.div
          whileHover={!isGenerating ? { scale: 1.03 } : {}}
          whileTap={!isGenerating ? { scale: 0.97 } : {}}
        >
          <Button
            onClick={generateScenes}
            disabled={isGenerating}
            className="relative overflow-hidden bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white gap-2 rounded-xl h-11 px-6 font-bold shadow-md shadow-purple-200/50 border-0 disabled:opacity-50"
            aria-label={hasScenes ? labels.regenerate : labels.generate}
          >
            {isGenerating ? (
              <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : hasScenes ? (
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Wand2 className="h-4 w-4" aria-hidden="true" />
            )}
            <span>{hasScenes ? labels.regenerate : labels.generate}</span>
          </Button>
        </motion.div>
      </div>

      {/* Error banner */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex items-start gap-2 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 px-4 py-3"
            role="alert"
          >
            <AlertCircle
              className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0"
              aria-hidden="true"
            />
            <div className="flex-1 text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={generateScenes}
              disabled={isGenerating}
              className="h-7 px-2 text-xs text-red-700 hover:text-red-800 hover:bg-red-100 dark:hover:bg-red-900/30"
            >
              {labels.errorRetry}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading skeleton */}
      {isGenerating && !hasScenes && (
        <div className="space-y-3">
          {structure.map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4 space-y-2">
                <Skeleton className="h-5 w-1/3" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-4/5" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isGenerating && !hasScenes && !error && (
        <Card>
          <CardContent className="p-8 text-center">
            <Sparkles
              className="h-10 w-10 text-purple-300 mx-auto mb-3"
              aria-hidden="true"
            />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {labels.empty}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Scene cards list */}
      {hasScenes && (
        <div className="space-y-3">
          <AnimatePresence initial={false}>
            {scenes.map((scene, i) => (
              <SceneCard
                key={scene.id || i}
                scene={scene}
                onSceneChange={(patch) => updateScene(i, patch)}
                allCharacters={selectedCharacters}
                onRegenerate={() => regenerateOne(i)}
                isRegenerating={regeneratingIndex === i}
                isRTL={isRTL}
                language={language}
                sceneNumber={i + 1}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

export { STRUCTURE_4, STRUCTURE_6, buildFallbackScenes, normalizeScene };
