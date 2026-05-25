import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Sparkles,
  RefreshCw,
  Wand2,
  AlertCircle,
  Film,
  ImageIcon,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { generateScenePlan } from "@/lib/sceneGenerator";
import { GenerateImage } from "@/integrations/Core";
import { captureError } from "@/lib/errorTracking";

/**
 * Scene Plan Step — sits between "story idea" (draft) and "page generation".
 *
 * Given the book's idea/theme + characters, calls generateScenePlan() to
 * produce a 5-8 scene outline. Each scene shows: title, description, mood,
 * setting, characters, prompt_for_image. User can:
 *   - edit any field inline
 *   - regenerate the whole plan
 *   - generate a preview illustration per scene (calls GenerateImage)
 *   - confirm and proceed to page generation
 *
 * Localization uses the per-book translation function `t` passed in by the
 * parent (BookCreation), with safe inline fallbacks.
 */
export default function ScenePlanStep({
  book,
  isRTL,
  t,
  onBack,
  onConfirm,
  isGenerating,
}) {
  const isHebrew = isRTL;
  const isYiddish = book?.language === "yiddish";

  // Local copy of scenes (editable). Once user clicks "Generate book",
  // we pass these scenes up so BookCreation can use scene-level prompts.
  const [scenes, setScenes] = useState([]);
  const [planning, setPlanning] = useState(false);
  const [error, setError] = useState(null);
  const [previewIndex, setPreviewIndex] = useState(null); // index currently generating preview
  const [previewUrls, setPreviewUrls] = useState({}); // sceneId -> url

  // Translation helpers with safe inline fallback (book-translations.js doesn't
  // have these keys yet; book-translations falls back to the key string)
  const L = (key, fallback) => {
    const v = t?.(key);
    return v && v !== key ? v : fallback;
  };

  const labels = {
    title: L(
      "book.scenePlan.title",
      isHebrew ? "תכנון סצנות הסיפור" : isYiddish ? "פלאַנירן די סצענעס" : "Plan Your Scenes"
    ),
    subtitle: L(
      "book.scenePlan.subtitle",
      isHebrew
        ? "ה-AI יבנה לך מתווה סצנה-אחר-סצנה. תוכל לערוך כל סצנה לפני שיוצרים את הספר."
        : isYiddish
        ? "די AI וועט בויען א סצענע-נאך-סצענע אַוטליין. דו קענסט רעדאַקטירן יעדער סצענע."
        : "AI will build a scene-by-scene outline. Edit any scene before we generate the book."
    ),
    generate: L(
      "book.scenePlan.generate",
      isHebrew ? "צור מתווה סצנות" : isYiddish ? "מאַך אַ סצענע-פּלאַן" : "Generate Scene Plan"
    ),
    regenerate: L(
      "book.scenePlan.regenerate",
      isHebrew ? "צור מחדש" : isYiddish ? "מאַך פֿון דאָס נײַ" : "Regenerate plan"
    ),
    sceneLabel: L(
      "book.scenePlan.scene",
      isHebrew ? "סצנה" : isYiddish ? "סצענע" : "Scene"
    ),
    titleField: L(
      "book.scenePlan.titleField",
      isHebrew ? "כותרת" : isYiddish ? "טיטל" : "Title"
    ),
    descriptionField: L(
      "book.scenePlan.descriptionField",
      isHebrew ? "תיאור" : isYiddish ? "באַשרײַבונג" : "Description"
    ),
    moodField: L(
      "book.scenePlan.moodField",
      isHebrew ? "מצב רוח" : isYiddish ? "שטימונג" : "Mood"
    ),
    settingField: L(
      "book.scenePlan.settingField",
      isHebrew ? "תפאורה" : isYiddish ? "באַשטעלונג" : "Setting"
    ),
    charactersField: L(
      "book.scenePlan.charactersField",
      isHebrew ? "דמויות" : isYiddish ? "פֿיגורן" : "Characters"
    ),
    imagePromptField: L(
      "book.scenePlan.imagePromptField",
      isHebrew ? "פרומפט לאיור" : isYiddish ? "אילוסטראציע-פּראָמפּט" : "Illustration prompt"
    ),
    previewBtn: L(
      "book.scenePlan.previewBtn",
      isHebrew ? "תצוגה מקדימה" : isYiddish ? "פאָרשוי" : "Preview image"
    ),
    previewGenerating: L(
      "book.scenePlan.previewGenerating",
      isHebrew ? "יוצר תמונה..." : isYiddish ? "מאַכן בילד..." : "Generating image..."
    ),
    back: L(
      "book.scenePlan.back",
      isHebrew ? "חזרה" : isYiddish ? "צוריק" : "Back"
    ),
    confirm: L(
      "book.scenePlan.confirm",
      isHebrew ? "אישור והמשך ליצירת הספר" : isYiddish ? "באַשטעטיק און פאָרזעצן" : "Confirm & continue"
    ),
    empty: L(
      "book.scenePlan.empty",
      isHebrew
        ? 'עדיין לא נוצר מתווה. לחץ על "צור מתווה סצנות" כדי להתחיל.'
        : isYiddish
        ? "נאָך נישט קיין פּלאַן. דריקט אויף 'מאַך אַ פּלאַן'."
        : 'No plan yet. Click "Generate Scene Plan" to begin.'
    ),
    errorTitle: L(
      "book.scenePlan.errorTitle",
      isHebrew ? "כשל ביצירת המתווה" : isYiddish ? "פּלאַן-דורכפֿאַל" : "Couldn't generate plan"
    ),
    previewError: L(
      "book.scenePlan.previewError",
      isHebrew ? "כשל ביצירת תצוגה מקדימה" : isYiddish ? "פאָרשוי דורכפֿאַל" : "Preview failed"
    ),
  };

  // Build the storyIdea string from the book's draft fields.
  const buildStoryIdea = useCallback(() => {
    if (!book) return "";
    const parts = [];
    if (book.title) parts.push(book.title);
    if (book.genre) parts.push(`Genre: ${book.genre}`);
    if (book.moral) parts.push(`Moral: ${book.moral}`);
    if (book.interests) parts.push(`Child's interests: ${book.interests}`);
    if (book.child_name) parts.push(`Main character: ${book.child_name}, age ${book.child_age || ""}`);
    return parts.join(" — ") || "A warm children's story";
  }, [book]);

  // Build characters[] from the book's family_members + main child.
  const buildCharacters = useCallback(() => {
    const list = [];
    if (book?.child_name) {
      list.push({
        name: book.child_name,
        description: `${book.child_age || ""} years old, the main character`,
      });
    }
    if (book?.family_members) {
      book.family_members
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((name) => list.push({ name, description: "family member" }));
    }
    return list;
  }, [book]);

  const handleGenerate = useCallback(async () => {
    setPlanning(true);
    setError(null);
    try {
      const sceneCount = book?.length === "short" ? 5 : book?.length === "long" ? 8 : 6;
      const result = await generateScenePlan({
        storyIdea: buildStoryIdea(),
        characters: buildCharacters(),
        language: book?.language || "english",
        ageRange: book?.age_range || "5-7",
        sceneCount,
        genre: book?.genre,
        tone: book?.tone,
        artStyle: book?.art_style,
      });
      setScenes(result.scenes || []);
      setPreviewUrls({});
    } catch (err) {
      captureError(
        err instanceof Error ? err : new Error(String(err?.message || err)),
        { context: "ScenePlanStep.handleGenerate" }
      );
      setError(`${labels.errorTitle}: ${err?.message?.slice(0, 200) || "unknown"}`);
    } finally {
      setPlanning(false);
    }
  }, [book, buildStoryIdea, buildCharacters, labels.errorTitle]);

  const updateScene = useCallback((index, patch) => {
    setScenes((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }, []);

  const handlePreview = useCallback(
    async (index) => {
      const scene = scenes[index];
      if (!scene?.prompt_for_image) return;
      setPreviewIndex(index);
      try {
        const result = await GenerateImage({ prompt: scene.prompt_for_image });
        if (result?.url) {
          setPreviewUrls((p) => ({ ...p, [scene.id]: result.url }));
        }
      } catch (err) {
        captureError(
          err instanceof Error ? err : new Error(String(err?.message || err)),
          { context: "ScenePlanStep.handlePreview", index }
        );
        setError(labels.previewError);
      } finally {
        setPreviewIndex(null);
      }
    },
    [scenes, labels.previewError]
  );

  const handleConfirm = useCallback(() => {
    onConfirm?.(scenes);
  }, [scenes, onConfirm]);

  const hasScenes = scenes.length > 0;

  return (
    <div className="max-w-5xl mx-auto py-8" dir={isRTL ? "rtl" : "ltr"}>
      {/* Header */}
      <div className={`flex items-center gap-2 mb-4 ${isRTL ? "flex-row-reverse" : ""}`}>
        <Button variant="ghost" onClick={onBack} disabled={isGenerating || planning}>
          <ArrowLeft className={`h-4 w-4 ${isRTL ? "ml-2 rotate-180" : "mr-2"}`} />
          {labels.back}
        </Button>
      </div>

      <div className="text-center mb-6">
        <div className={`flex items-center justify-center gap-2 mb-2 ${isRTL ? "flex-row-reverse" : ""}`}>
          <Film className="h-7 w-7 text-purple-600" aria-hidden="true" />
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
            {labels.title}
          </h1>
        </div>
        <p className="text-gray-500 dark:text-gray-400 text-base max-w-2xl mx-auto">
          {labels.subtitle}
        </p>
      </div>

      {/* Generate button */}
      <div className={`flex justify-center mb-6 ${isRTL ? "flex-row-reverse" : ""}`}>
        <motion.div
          whileHover={!planning ? { scale: 1.03 } : {}}
          whileTap={!planning ? { scale: 0.97 } : {}}
        >
          <Button
            onClick={handleGenerate}
            disabled={planning || isGenerating}
            size="lg"
            className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white gap-2 rounded-xl h-12 px-6 font-bold shadow-md shadow-purple-200/50 border-0 disabled:opacity-50"
            aria-label={hasScenes ? labels.regenerate : labels.generate}
          >
            {planning ? (
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
            className="flex items-start gap-2 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 px-4 py-3 mb-4"
            role="alert"
          >
            <AlertCircle
              className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0"
              aria-hidden="true"
            />
            <div className="flex-1 text-sm text-red-700 dark:text-red-300">{error}</div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Skeletons while planning */}
      {planning && !hasScenes && (
        <div className="space-y-4">
          {[0, 1, 2, 3, 4, 5].map((i) => (
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
      {!planning && !hasScenes && !error && (
        <Card>
          <CardContent className="p-8 text-center">
            <Sparkles className="h-10 w-10 text-purple-300 mx-auto mb-3" aria-hidden="true" />
            <p className="text-sm text-gray-500 dark:text-gray-400">{labels.empty}</p>
          </CardContent>
        </Card>
      )}

      {/* Scene cards */}
      {hasScenes && (
        <div className="space-y-4">
          <AnimatePresence initial={false}>
            {scenes.map((scene, i) => (
              <motion.div
                key={scene.id}
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25, delay: i * 0.04 }}
              >
                <Card className="overflow-hidden border-2 border-purple-100 dark:border-purple-900/40">
                  <CardHeader className="bg-gradient-to-r from-violet-500 to-purple-600 text-white py-3 px-4">
                    <div className={`flex items-center gap-3 ${isRTL ? "flex-row-reverse" : ""}`}>
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-white/25 backdrop-blur-sm font-bold text-sm">
                        {i + 1}
                      </div>
                      <CardTitle className="text-base font-bold flex-1 min-w-0 truncate">
                        {scene.title || `${labels.sceneLabel} ${i + 1}`}
                      </CardTitle>
                      {scene.mood && (
                        <Badge variant="secondary" className="bg-white/20 text-white border-0">
                          {scene.mood}
                        </Badge>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent className="p-4 space-y-3">
                    {/* Title */}
                    <div>
                      <Label className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1 block">
                        {labels.titleField}
                      </Label>
                      <Input
                        value={scene.title || ""}
                        onChange={(e) => updateScene(i, { title: e.target.value })}
                        dir={isRTL ? "rtl" : "ltr"}
                        maxLength={80}
                        className="font-semibold"
                      />
                    </div>

                    {/* Description */}
                    <div>
                      <Label className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1 block">
                        {labels.descriptionField}
                      </Label>
                      <Textarea
                        value={scene.description || ""}
                        onChange={(e) => updateScene(i, { description: e.target.value })}
                        dir={isRTL ? "rtl" : "ltr"}
                        rows={2}
                        maxLength={500}
                        className="resize-none"
                      />
                    </div>

                    {/* Mood + Setting row */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1 block">
                          {labels.moodField}
                        </Label>
                        <Input
                          value={scene.mood || ""}
                          onChange={(e) => updateScene(i, { mood: e.target.value })}
                          dir={isRTL ? "rtl" : "ltr"}
                          maxLength={50}
                        />
                      </div>
                      <div>
                        <Label className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1 block">
                          {labels.settingField}
                        </Label>
                        <Input
                          value={scene.setting || ""}
                          onChange={(e) => updateScene(i, { setting: e.target.value })}
                          dir={isRTL ? "rtl" : "ltr"}
                          maxLength={120}
                        />
                      </div>
                    </div>

                    {/* Characters */}
                    {Array.isArray(scene.characters) && scene.characters.length > 0 && (
                      <div>
                        <Label className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1 block">
                          {labels.charactersField}
                        </Label>
                        <div className={`flex flex-wrap gap-1.5 ${isRTL ? "flex-row-reverse" : ""}`}>
                          {scene.characters.map((c, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              {c}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Illustration prompt */}
                    <div>
                      <Label className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1 block flex items-center gap-1.5">
                        <ImageIcon className="h-3.5 w-3.5 text-amber-500" aria-hidden="true" />
                        {labels.imagePromptField}
                      </Label>
                      <Textarea
                        value={scene.prompt_for_image || ""}
                        onChange={(e) => updateScene(i, { prompt_for_image: e.target.value })}
                        dir={isRTL ? "rtl" : "ltr"}
                        rows={2}
                        maxLength={600}
                        className="resize-none text-sm bg-amber-50/40 dark:bg-amber-950/20"
                      />
                    </div>

                    {/* Per-scene preview image */}
                    <div className={`flex items-center gap-3 ${isRTL ? "flex-row-reverse" : ""}`}>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={previewIndex !== null || !scene.prompt_for_image}
                        onClick={() => handlePreview(i)}
                        className="gap-1.5 text-purple-700 border-purple-200 hover:bg-purple-50 dark:hover:bg-purple-950/30"
                      >
                        {previewIndex === i ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                        ) : (
                          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                        )}
                        <span className="text-xs">
                          {previewIndex === i ? labels.previewGenerating : labels.previewBtn}
                        </span>
                      </Button>

                      {previewUrls[scene.id] && (
                        <img
                          src={previewUrls[scene.id]}
                          alt={scene.title || `${labels.sceneLabel} ${i + 1}`}
                          className="h-16 w-16 rounded-lg object-cover ring-1 ring-purple-200"
                          loading="lazy"
                        />
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Confirm button */}
      {hasScenes && (
        <div className={`mt-8 flex ${isRTL ? "justify-start" : "justify-end"}`}>
          <Button
            onClick={handleConfirm}
            disabled={planning || isGenerating}
            size="lg"
            className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white gap-2 rounded-xl h-12 px-8 font-bold shadow-md"
          >
            {isGenerating ? (
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
            )}
            <span>{labels.confirm}</span>
          </Button>
        </div>
      )}
    </div>
  );
}
