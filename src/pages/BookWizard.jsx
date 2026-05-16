import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Book } from "@/entities/Book";
import { Page } from "@/entities/Page";
import { Follow } from "@/entities/Follow";
import { Notification } from "@/entities/Notification";
import { createPageUrl } from "@/utils";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, BookOpen, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { InvokeLLM, GenerateImage } from "@/integrations/Core";
import { generateStoryBible, imagePromptFor } from "@/lib/storyBible";
import { moderateInput, buildSafetyPromptPrefix, sanitizeAIOutput } from "@/utils/content-moderation";
import { checkAgeAppropriateLanguage } from "@/utils/content-moderation";
import useGamification from "@/hooks/useGamification";
import { useI18n } from "@/components/i18n/i18nProvider";
import confetti from "canvas-confetti";
import { trackEvent } from "@/lib/analytics";
import { captureError } from "@/lib/errorTracking";

import WizardProgress from "@/components/wizard/WizardProgress";
import TopicStep from "@/components/wizard/TopicStep";
import CharacterPicker from "@/components/shared/CharacterPicker";
import PreviewEditStep from "@/components/wizard/PreviewEditStep";
import SaveStep from "@/components/wizard/SaveStep";
import StoryStructure from "@/components/storyBuilder/StoryStructure";
import LoadingOverlay from "@/components/shared/LoadingOverlay";
import FriendlyError from "@/components/shared/FriendlyError";

const LAYOUT_TYPES = ["standard", "image_top", "image_full", "text_overlay", "two_column"];

// --- Draft auto-save helpers ---
const DRAFT_PREFIX = "sipurai_draft_";
const MAX_DRAFTS = 3;

function getDraftKeys() {
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(DRAFT_PREFIX)) {
      keys.push(key);
    }
  }
  // Sort by saved timestamp (newest first)
  keys.sort((a, b) => {
    try {
      const aData = JSON.parse(localStorage.getItem(a) || "{}");
      const bData = JSON.parse(localStorage.getItem(b) || "{}");
      return (bData._savedAt || 0) - (aData._savedAt || 0);
    } catch {
      return 0;
    }
  });
  return keys;
}

function getLatestDraft() {
  const keys = getDraftKeys();
  if (keys.length === 0) return null;
  try {
    const data = JSON.parse(localStorage.getItem(keys[0]) || "null");
    if (data) data._draftKey = keys[0];
    return data;
  } catch {
    return null;
  }
}

function pruneOldDrafts() {
  const keys = getDraftKeys();
  // Remove drafts beyond the MAX_DRAFTS limit (oldest first)
  while (keys.length > MAX_DRAFTS) {
    const oldest = keys.pop();
    localStorage.removeItem(oldest);
  }
}

function clearDraft(key) {
  if (key) {
    localStorage.removeItem(key);
  }
}

function clearAllDrafts() {
  const keys = getDraftKeys();
  keys.forEach((k) => localStorage.removeItem(k));
}

export default function BookWizard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const gamification = useGamification();
  const { t, language: uiLanguage, isRTL } = useI18n();
  const { user: currentUserData } = useCurrentUser();

  // Wizard state
  const [currentStep, setCurrentStep] = useState(0);
  // currentLanguage is the BOOK CONTENT language (used for AI prompts and bookData.language).
  // It is distinct from uiLanguage (the UI display language from useI18n).
  const [currentLanguage, setCurrentLanguage] = useState("english");
  const [isCreating, setIsCreating] = useState(false);
  const [isGeneratingOutline, setIsGeneratingOutline] = useState(false);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Step 1: Topic
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [customIdea, setCustomIdea] = useState("");

  // Step 2: Characters
  const [selectedCharacters, setSelectedCharacters] = useState([]);

  // Step 2.5: Story Structure (scene-by-scene spine)
  // Each scene: { id, role, title, description, characters: string[], illustration_prompt }
  const [scenes, setScenes] = useState([]);

  // Creation progress
  const [creationProgress, setCreationProgress] = useState(null);
  // Track image generation failures for retry
  const [imageFailures, setImageFailures] = useState([]);

  // Celebration state after book creation
  const [celebrationBook, setCelebrationBook] = useState(null); // { id, title, cover_image }
  const [showCelebration, setShowCelebration] = useState(false);
  const celebrationTimerRef = useRef(null);

  // Step 3: Book data (preview/edit)
  const [bookData, setBookData] = useState({
    title: "",
    description: "",
    moral: "",
    art_style: "disney",
    length: "medium",
    genre: "adventure",
    age_range: "5-7",
    language: "english",
    child_name: "",
    child_age: 5,
    child_gender: "neutral",
    tone: "exciting",
    interests: "",
    family_members: "",
    status: "draft",
    cover_image: ""
  });

  const [generatedOutline, setGeneratedOutline] = useState(null);

  // Rhyming settings
  const [useRhyming, setUseRhyming] = useState(false);
  const [rhymeSettings, setRhymeSettings] = useState({
    pattern: "aabb",
    meter: "free",
    complexity: "simple"
  });

  // Draft auto-save
  const [activeDraftKey, setActiveDraftKey] = useState(null);
  const draftTimerRef = useRef(null);

  // Save draft to localStorage (debounced)
  const saveDraft = useCallback(() => {
    // Don't save while creating or if book is already being generated
    if (isCreating) return;

    const draftData = {
      currentStep,
      selectedTopic,
      customIdea,
      selectedCharacters,
      scenes,
      bookData,
      generatedOutline,
      useRhyming,
      rhymeSettings,
      _savedAt: Date.now(),
    };

    const key = activeDraftKey || `${DRAFT_PREFIX}${Date.now()}`;
    try {
      localStorage.setItem(key, JSON.stringify(draftData));
      if (!activeDraftKey) {
        setActiveDraftKey(key);
      }
      pruneOldDrafts();
    } catch {
      // localStorage may be full — silently skip
    }
  }, [currentStep, selectedTopic, customIdea, selectedCharacters, scenes, bookData, generatedOutline, useRhyming, rhymeSettings, isCreating, activeDraftKey]);

  // Debounced auto-save on state changes (2 second delay)
  useEffect(() => {
    // Don't auto-save on initial load or while loading
    if (isLoading || isCreating) return;
    // Only save if user has made meaningful progress (selected a topic at minimum)
    if (!selectedTopic && !customIdea && !bookData.title) return;

    if (draftTimerRef.current) {
      clearTimeout(draftTimerRef.current);
    }
    draftTimerRef.current = setTimeout(() => {
      saveDraft();
    }, 2000);

    return () => {
      if (draftTimerRef.current) {
        clearTimeout(draftTimerRef.current);
      }
    };
  }, [currentStep, selectedTopic, customIdea, selectedCharacters, bookData, generatedOutline, saveDraft, isLoading, isCreating]);

  // Restore draft on mount
  useEffect(() => {
    const draft = getLatestDraft();
    if (draft && draft._savedAt) {
      // Only offer restore if draft is less than 7 days old
      const ageMs = Date.now() - draft._savedAt;
      const sevenDays = 7 * 24 * 60 * 60 * 1000;
      if (ageMs < sevenDays) {
        const draftTitle = draft.bookData?.title || draft.selectedTopic || t("wizard.draft.untitled");
        toast({
          title: t("wizard.draft.found"),
          description: t("wizard.draft.foundDesc", { title: draftTitle }),
          duration: 8000,
          action: (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                // Restore draft state
                if (draft.currentStep != null) setCurrentStep(draft.currentStep);
                if (draft.selectedTopic) setSelectedTopic(draft.selectedTopic);
                if (draft.customIdea) setCustomIdea(draft.customIdea);
                if (draft.selectedCharacters) setSelectedCharacters(draft.selectedCharacters);
                if (draft.scenes) setScenes(draft.scenes);
                if (draft.bookData) setBookData((prev) => ({ ...prev, ...draft.bookData }));
                if (draft.generatedOutline) setGeneratedOutline(draft.generatedOutline);
                if (draft.useRhyming != null) setUseRhyming(draft.useRhyming);
                if (draft.rhymeSettings) setRhymeSettings((prev) => ({ ...prev, ...draft.rhymeSettings }));
                setActiveDraftKey(draft._draftKey);
                toast({
                  title: t("wizard.draft.restored"),
                  className: "bg-green-100 text-green-900 dark:bg-green-900/50 dark:text-green-100",
                });
              }}
            >
              {t("wizard.draft.restore")}
            </Button>
          ),
        });
      }
    }
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClearDraft = () => {
    if (activeDraftKey) {
      clearDraft(activeDraftKey);
      setActiveDraftKey(null);
    } else {
      clearAllDrafts();
    }
    toast({
      title: t("wizard.draft.cleared"),
    });
  };

  // Step definitions using i18n.
  // The "structure" step lives between characters and preview so the user
  // can shape the scene-by-scene spine before reviewing/editing the book
  // metadata. Falls back to a literal label when the i18n key is missing.
  const structureLabelRaw = t("wizard.steps.structure");
  const structureLabel =
    !structureLabelRaw || structureLabelRaw === "wizard.steps.structure"
      ? (uiLanguage === "hebrew" ? "מבנה הסיפור" : uiLanguage === "yiddish" ? "סטרוקטור" : "Story Structure")
      : structureLabelRaw;
  const steps = [
    { id: "topic", title: t("wizard.steps.topic") },
    { id: "characters", title: t("wizard.steps.characters") },
    { id: "structure", title: structureLabel },
    { id: "preview", title: t("wizard.steps.preview") },
    { id: "save", title: t("wizard.steps.create") }
  ];

  // Load user language (book content language) from hook data
  useEffect(() => {
    const lang = currentUserData?.language || localStorage.getItem("language") || "english";
    setCurrentLanguage(lang);
    setBookData((prev) => ({ ...prev, language: lang }));
    setIsLoading(false);
  }, [currentUserData]);

  // Navigation
  // 0: topic · 1: characters · 2: structure · 3: preview · 4: save
  // The structure step is intentionally permissive — the AI may fail
  // and we don't want to trap the user; they can always advance with
  // an empty / partial spine, which the create flow will fall back from.
  const canGoNext = () => {
    switch (currentStep) {
      case 0: return selectedTopic === "custom" ? !!customIdea?.trim() : !!selectedTopic;
      case 1: return selectedCharacters.length > 0;
      case 2: return true; // structure is optional / editable on next step too
      case 3: return !!bookData.title;
      case 4: return true;
      default: return false;
    }
  };

  const goToStep = (stepIndex) => {
    if (stepIndex < currentStep) {
      setCurrentStep(stepIndex);
    }
  };

  const nextStep = async () => {
    if (currentStep >= steps.length - 1) return;

    // When moving from structure (2) to preview (3), generate the
    // book-level outline (title/description/moral) if not already done.
    // The structure step itself does NOT block — scenes already feed the
    // image pipeline downstream regardless of whether the outline call
    // succeeds.
    if (currentStep === 2 && !generatedOutline) {
      const success = await generateOutline();
      if (!success) return; // Don't advance if outline generation failed
    }

    setCurrentStep((prev) => prev + 1);
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  // Generate story outline from AI. Returns true on success, false on failure.
  const generateOutline = async () => {
    try {
      setIsGeneratingOutline(true);
      setError(null);

      const characterNames = selectedCharacters.map((c) => c.name).join(", ");
      const characterTraits = selectedCharacters
        .filter((c) => c.traits)
        .map((c) => `${c.name} (${c.traits})`)
        .join("; ");

      // Validate character names through content moderation
      for (const char of selectedCharacters) {
        const modResult = moderateInput(char.name, "name");
        if (modResult.blocked) {
          toast({
            variant: "destructive",
            title: t("wizard.error.inappropriateContent"),
            description: t("wizard.error.nameInappropriate")
          });
          setIsGeneratingOutline(false);
          return false;
        }
      }

      // Use bookData.age_range, fallback to preferredAgeRange from onboarding, then default
      const ageRange = bookData.age_range || localStorage.getItem("preferredAgeRange") || "5-10";
      const safetyPrefix = buildSafetyPromptPrefix(ageRange);
      // Use currentLanguage (book content language) for AI prompt instruction
      const langInstruction = currentLanguage === "hebrew"
        ? "יש ליצור את כל התוכן בעברית בלבד. "
        : currentLanguage === "yiddish"
        ? "שרייב דעם גאנצן אינהאלט אויף יידיש. "
        : "Create all content in English only. ";

      const topicDescription = selectedTopic === "custom" && customIdea
        ? customIdea
        : selectedTopic;

      const prompt = `${safetyPrefix}${langInstruction}Create a children's story idea about the topic "${topicDescription}" with characters: ${characterNames}. ${characterTraits ? `Character traits: ${characterTraits}.` : ""} Please provide:
1. A catchy title for the story
2. A brief description (2-3 sentences)
3. A moral lesson

The story should be age-appropriate for children ages ${ageRange}, fun, engaging, and educational.`;

      const result = await InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            title: { type: "string" },
            description: { type: "string" },
            moral_lesson: { type: "string" }
          },
          required: ["title", "description", "moral_lesson"]
        }
      });

      if (result) {
        // Sanitize AI output before using it
        const sanitizedTitle = sanitizeAIOutput(result.title || "");
        const sanitizedDescription = sanitizeAIOutput(result.description || "");
        const sanitizedMoral = sanitizeAIOutput(result.moral_lesson || "");

        // Run age-appropriate language check on generated content
        const ageCheck = checkAgeAppropriateLanguage(sanitizedDescription, ageRange);
        if (!ageCheck.isAppropriate) {
          // AI should not generate inappropriate content due to safety prefix,
          // but double-check just in case
          toast({
            variant: "destructive",
            title: t("wizard.error.contentIssue"),
            description: t("wizard.error.contentNotAppropriate")
          });
          setIsGeneratingOutline(false);
          return false;
        }

        const sanitizedResult = { ...result, title: sanitizedTitle, description: sanitizedDescription, moral_lesson: sanitizedMoral };
        setGeneratedOutline(sanitizedResult);
        setBookData((prev) => ({
          ...prev,
          title: sanitizedTitle || prev.title,
          description: sanitizedDescription || prev.description,
          moral: sanitizedMoral || prev.moral,
          genre: selectedTopic || prev.genre,
          child_name: selectedCharacters[0]?.name || prev.child_name,
          interests: selectedTopic,
          childNames: selectedCharacters.map((c) => c.name),
          selectedCharacters: selectedCharacters.map((c) => ({
            name: c.name,
            age: c.age || 5,
            gender: c.gender || "neutral",
            primary_image_url: c.avatar || null
          }))
        }));
        return true;
      }
      // InvokeLLM returned null/empty — show error
      setError({
        title: t("wizard.error.outlineTitle"),
        message: t("wizard.error.outlineMessage"),
        onRetry: generateOutline
      });
      return false;
    } catch {
      setError({
        title: t("wizard.error.outlineTitle"),
        message: t("wizard.error.outlineMessage"),
        onRetry: generateOutline
      });
      return false;
    } finally {
      setIsGeneratingOutline(false);
    }
  };

  // Retry failed images for an already-created book
  const retryFailedImages = async (bookId, failures) => {
    if (!failures || failures.length === 0) return;

    toast({
      title: t("wizard.toast.retryingImages"),
      description: t("wizard.toast.retryingImagesDesc", { count: failures.length })
    });

    const retryResults = await Promise.allSettled(
      failures.map(({ pageId, imagePrompt }) =>
        GenerateImage({ prompt: imagePrompt })
          .then((result) => ({ pageId, url: result?.url || "" }))
          .catch(() => ({ pageId, url: "" }))
      )
    );

    const stillFailed = [];
    await Promise.allSettled(
      retryResults.map(async (outcome, idx) => {
        if (outcome.status === "fulfilled" && outcome.value.url) {
          await Page.update(outcome.value.pageId, { image_url: outcome.value.url });
        } else {
          stillFailed.push(failures[idx]);
        }
      })
    );

    setImageFailures(stillFailed);

    if (stillFailed.length === 0) {
      toast({
        title: t("wizard.toast.allImagesGenerated"),
        className: "bg-green-100 text-green-900 dark:bg-green-900/50 dark:text-green-100"
      });
    } else {
      toast({
        variant: "destructive",
        title: t("wizard.toast.imagesFailed", { count: stillFailed.length }),
        description: t("wizard.toast.imagesFailedRetry")
      });
    }
  };

  // Create the book with parallel page generation
  // Sprint 24: opt-in fast path. Set localStorage.sipurai_use_story_bible='1' to enable.
  // When enabled: ONE InvokeLLM call returns the full Story Bible (title + characters
  // + global_style + all page texts + image_prompts + tts_directions), then images run in
  // parallel using the page-level image_prompt that already inlines character continuity.
  // Saves N+2 round-trips (outline + cover + 1-per-page text) for a bigger book.
  const tryStoryBibleFastPath = async () => {
    try {
      const isHebrewBook = bookData.language === "hebrew";
      const ageRange = bookData.age_range || localStorage.getItem("preferredAgeRange") || "5-10";
      const safetyDirective = buildSafetyPromptPrefix(ageRange);
      const topicDescription = selectedTopic === "custom" && customIdea ? customIdea : selectedTopic;
      const characters = selectedCharacters.map((c) => ({
        name: c.name,
        role: c.role || "character",
        description: c.appearance || c.description || c.traits || c.name,
      }));

      let pageCount = 10;
      if (bookData.length === "short") pageCount = 6;
      if (bookData.length === "long") pageCount = 15;

      setCreationProgress({ label: t("wizard.progress.creatingStory"), percent: 15, step: t("wizard.progress.step1of4") });

      const bible = await generateStoryBible({
        topic: bookData.title || topicDescription,
        characters,
        language: bookData.language || (isHebrewBook ? "hebrew" : "english"),
        ageRange,
        pageCount,
        style: `${bookData.art_style} children's picture book illustration, no text in image`,
        preset: bookData.tone === "dramatic" ? "dramatic-lite" : bookData.tone === "calm" ? "bedtime" : "playful",
        safetyDirective,
      });
      return bible;
    } catch (err) {
      captureError(err instanceof Error ? err : new Error(String(err?.message || err)), { context: "BookWizard storyBible fast-path" });
      return null;
    }
  };

  const createBook = async () => {
    try {
      setIsCreating(true);
      setError(null);
      setImageFailures([]);
      setCreationProgress({ label: t("wizard.progress.checkingContent"), percent: 5, step: "" });

      const useStoryBibleFastPath = (typeof window !== "undefined") && window.localStorage?.getItem("sipurai_use_story_bible") === "1";
      let storyBible = null; // Wave-8: when present, downstream flow re-uses bible.pages instead of LLM-generating page texts
      if (useStoryBibleFastPath) {
        storyBible = await tryStoryBibleFastPath();
        if (storyBible?.pages?.length && storyBible?.title) {
          if (import.meta.env.DEV) console.log("[BookWizard] Story Bible generated:", storyBible.title, "pages:", storyBible.pages.length);
          window.__sipurai_last_bible = storyBible;
        } else {
          storyBible = null;
        }
      }

      // Moderate title and description
      const titleCheck = moderateInput(bookData.title, "title");
      const descCheck = moderateInput(bookData.description, "description");

      if (titleCheck.blocked || descCheck.blocked) {
        toast({
          variant: "destructive",
          title: t("wizard.error.inappropriateContent"),
          description: t("wizard.error.titleDescInappropriate")
        });
        setIsCreating(false);
        setCreationProgress(null);
        return;
      }

      // Step 1: Generate story outline + cover image in parallel
      setCreationProgress({
        label: t("wizard.progress.creatingStory"),
        percent: 10,
        step: t("wizard.progress.step1of4")
      });

      let pageCount = 10;
      if (bookData.length === "short") pageCount = 6;
      if (bookData.length === "long") pageCount = 15;

      const characterNames = selectedCharacters.map((c) => c.name).join(", ");
      // Build character appearance descriptions for visual consistency across illustrations
      const characterAppearances = selectedCharacters
        .map((c) => {
          const parts = [c.name];
          if (c.appearance) parts.push(c.appearance);
          else if (c.description) parts.push(c.description);
          else if (c.traits) parts.push(c.traits);
          return parts.join(": ");
        })
        .join(". ");

      const topicDescription = selectedTopic === "custom" && customIdea ? customIdea : selectedTopic;
      // Use bookData.age_range, fallback to preferredAgeRange from onboarding, then default
      const ageRange = bookData.age_range || localStorage.getItem("preferredAgeRange") || "5-10";
      const safetyPrefix = buildSafetyPromptPrefix(ageRange);
      const langInstruction = bookData.language === "hebrew"
        ? "יש ליצור את כל התוכן בעברית בלבד. "
        : bookData.language === "yiddish"
        ? "שרייב דעם גאנצן אינהאלט אויף יידיש. "
        : "Create all content in English only. ";

      const outlinePrompt = `${safetyPrefix}${langInstruction}Create a detailed outline for a children's book:
- Title: ${bookData.title}
- Description: ${bookData.description}
- Topic: ${topicDescription}
- Characters: ${characterNames}
- Art style: ${bookData.art_style}
- Tone: ${bookData.tone || "exciting"}
- Moral: ${bookData.moral || "positive message"}
- Age range: ${ageRange}

Create exactly ${pageCount} pages (including a title page).
For each page, provide a brief description of what happens.
The story should have a clear beginning, middle, and end.`;

      const coverPrompt = `IMPORTANT: Do NOT include any text, letters, words, or writing in the illustration. Pure visual illustration only - no Hebrew letters, no English text, no numbers, no signs with text. Children's book cover art featuring characters ${characterNames} in a ${topicDescription} setting. ${characterAppearances ? `Character appearances: ${characterAppearances}.` : ""} Illustrated in ${bookData.art_style} style. Bright, colorful, child-friendly.`;

      const [outlineResult, coverResult] = await Promise.all([
        InvokeLLM({
          prompt: outlinePrompt,
          response_json_schema: {
            type: "object",
            properties: {
              title: { type: "string" },
              outline: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    page_number: { type: "number" },
                    description: { type: "string" }
                  }
                }
              }
            }
          }
        }),
        GenerateImage({ prompt: coverPrompt }).catch((err) => {
          console.error('[BookWizard] Cover image generation failed:', err?.message || err);
          captureError(err instanceof Error ? err : new Error(String(err?.message || err)), { context: "BookWizard cover image" });
          return null;
        })
      ]);

      const coverImage = coverResult?.url || "";

      // Step 2: Create book entity
      setCreationProgress({
        label: t("wizard.progress.savingBook"),
        percent: 25,
        step: t("wizard.progress.step2of4")
      });

      // Sanitize AI-generated title before saving
      const sanitizedTitle = sanitizeAIOutput(outlineResult?.title || bookData.title);

      const finalBookData = {
        ...bookData,
        title: sanitizedTitle,
        cover_image: coverImage,
        status: "generating",
        // Persist the user-curated scene structure on the Book so future
        // edits can resurface the spine. Tolerated as best-effort — entity
        // schemas that don't know about this field will ignore it.
        ...(Array.isArray(scenes) && scenes.length > 0 ? { scenes } : {})
      };

      const createdBook = await Book.create(finalBookData);

      // Step 3: Generate ALL page texts in parallel
      setCreationProgress({
        label: t("wizard.progress.writingStory"),
        percent: 35,
        step: t("wizard.progress.step3of4")
      });

      const isHebrewBook = bookData.language === "hebrew";
      const nikudInstruction = isHebrewBook
        ? "\nהוסף ניקוד מלא לכל הטקסט בעברית. כל מילה חייבת לכלול ניקוד."
        : "";

      const rhymingInstruction = useRhyming
        ? (rhymeSettings.pattern === "aabb"
          ? (isHebrewBook
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
- Write like a professional children's poet (Dr. Seuss / Shel Silverstein style)`)
          : rhymeSettings.pattern === "abab"
          ? (isHebrewBook
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
- Write like a professional children's poet (Dr. Seuss / Shel Silverstein style)`)
          : (isHebrewBook
            ? `\nכתוב את הסיפור בחרוזים מושלמים בתבנית ${rhymeSettings.pattern.toUpperCase()}.
כללים חשובים:
- כל החרוזים חייבים להיות מדויקים ולא מאולצים
- שמור על קצב עקבי של 6-8 מילים בשורה
- כתוב כמו משורר ילדים מקצועי`
            : `\nWrite the story in perfect rhyming format with pattern: ${rhymeSettings.pattern.toUpperCase()}.
Rules:
- All rhymes must be precise and natural, never forced
- Maintain consistent rhythm of 6-10 syllables per line
- Write like a professional children's poet`))
        : "";

      const outlinePages = outlineResult?.outline || [];

      // Wave-8: when Story Bible was generated upfront with matching page count,
      // bypass the per-page LLM call and reuse bible.pages directly. Saves ~10 calls/book.
      const bibleHasMatchingPages = storyBible?.pages?.length > 0;
      const pageTextPromises = bibleHasMatchingPages
        ? storyBible.pages.map((bp, i) => Promise.resolve({
            text_content: bp.text || outlinePages[i]?.description || "",
            ...(isHebrewBook && bp.text_with_nikud ? { text_with_nikud: bp.text_with_nikud } : {}),
            image_prompt: bp.image_prompt || `${bookData.art_style} illustration: ${(bp.text || "").slice(0, 100)}`,
          }))
        : outlinePages.map((pageOutline, i) => {
        const prompt = `${safetyPrefix}${langInstruction}Write the text content for page ${i} of a children's story based on this description: "${pageOutline.description}"

Story details:
- Title: ${finalBookData.title}
- Main characters: ${characterNames}
- Art style: ${bookData.art_style}
- Target age: ${ageRange}
${i === 0 ? "This is the title page/introduction. Keep it brief and engaging." : ""}
${rhymingInstruction}${nikudInstruction}

Also create a detailed image generation prompt for this page.

Return as JSON with:
1. text_content: The page text${isHebrewBook ? " (plain text without nikud)" : ""}
${isHebrewBook ? "2. text_with_nikud: The exact same page text with full nikud (vowel diacritics) on every word\n3. image_prompt: Detailed image generation prompt" : "2. image_prompt: Detailed image generation prompt"}`;

        return InvokeLLM({
          prompt,
          response_json_schema: {
            type: "object",
            properties: {
              text_content: { type: "string" },
              ...(isHebrewBook ? { text_with_nikud: { type: "string" } } : {}),
              image_prompt: { type: "string" }
            }
          }
        });
      });

      const pageTexts = await Promise.all(pageTextPromises);

      // Sanitize all AI-generated text content
      const sanitizedPageTexts = pageTexts.map((pt) => {
        const plainText = sanitizeAIOutput(pt?.text_content || "");
        const nikudText = pt?.text_with_nikud ? sanitizeAIOutput(pt.text_with_nikud) : "";
        // For Hebrew books, prefer nikud version if available
        const displayText = isHebrewBook && nikudText ? nikudText : plainText;
        return {
          ...pt,
          text_content: displayText,
          text_with_nikud: nikudText,
          image_prompt: pt?.image_prompt || ""
        };
      });

      // Step 4: Generate ALL illustrations in parallel
      // Use Promise.allSettled so one failure doesn't cancel the rest
      setCreationProgress({
        label: t("wizard.progress.drawingIllustrations"),
        percent: 60,
        step: t("wizard.progress.step4of4")
      });

      // Sprint 7.24: When the user has built a scene structure on step 2,
      // align scenes → pages so each page-level illustration prompt is
      // enriched with the canonical scene description AND the names of
      // characters the user marked as present in THAT scene. Pages that
      // sit beyond the scene count (e.g. cover + 10 pages but only 4
      // scenes) fall back to the original character-context behaviour.
      const hasScenes = Array.isArray(scenes) && scenes.length > 0;
      const charById = Object.fromEntries(selectedCharacters.map((c) => [c.id, c]));

      const imagePromises = sanitizedPageTexts.map((pageText, i) => {
        // Map page i → scene. Page 0 is typically a cover/title page; the
        // first body scene therefore maps to page 1. If we ever have
        // exactly scenes.length pages (no cover), still align by index.
        const sceneForPage = hasScenes
          ? scenes[Math.max(0, Math.min(scenes.length - 1, i === 0 ? 0 : i - 1))]
          : null;

        // Characters this scene "owns" — fall back to all selected.
        const sceneCharNames = sceneForPage?.characters?.length
          ? sceneForPage.characters
              .map((cid) => charById[cid]?.name)
              .filter(Boolean)
              .join(", ")
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
              .join(". ")
          : characterAppearances;

        // Prepend character appearance descriptions to every image prompt for visual consistency
        const characterContext = sceneAppearances
          ? `Characters: ${sceneAppearances}. `
          : "";
        const consistencyInstruction = `CRITICAL: Maintain EXACT visual consistency for all characters across every illustration: Same hair color, eye color, skin tone, clothing in every image. Same art style, color palette, and visual mood throughout. Characters must look IDENTICAL in every page - as if drawn by the same artist. Do NOT change character appearance between pages. `;
        const noTextInstruction = `IMPORTANT: Do NOT include any text, letters, words, or writing in the illustration. The image should contain ONLY visual elements - no Hebrew letters, no English text, no numbers, no signs with text. Pure illustration only. `;

        // Scene-aware composition: surface scene description + the user's
        // hand-edited illustration_prompt alongside the per-page prompt the
        // outline LLM produced. Page-level prompt wins as the most specific
        // beat; scene-level adds structural framing.
        const sceneFraming = sceneForPage
          ? `Scene role: ${sceneForPage.role}. Scene beat: ${sceneForPage.description || sceneForPage.title || ""}. ${sceneForPage.illustration_prompt ? `Scene visual: ${sceneForPage.illustration_prompt}. ` : ""}`
          : "";
        const sceneCharLine = sceneCharNames
          ? `Featuring: ${sceneCharNames}. `
          : "";

        const imagePrompt = `${consistencyInstruction}${noTextInstruction}${characterContext}${sceneCharLine}${sceneFraming}Scene: ${pageText.image_prompt}. Children's book illustration in ${bookData.art_style} style. Bright, colorful, age-appropriate for ${ageRange} year olds.`;
        return GenerateImage({ prompt: imagePrompt })
          .then((result) => ({
            url: result?.url || "",
            prompt: imagePrompt,
            scene_id: sceneForPage?.id || null
          }))
          .catch((err) => {
            captureError(err instanceof Error ? err : new Error(String(err?.message || err)), { context: "BookWizard image generation" });
            return { url: "", prompt: imagePrompt, failed: true, scene_id: sceneForPage?.id || null };
          });
      });

      const imageSettled = await Promise.allSettled(imagePromises);

      // Collect results, tracking failures with progress updates
      const imageResults = [];
      let successCount = 0;
      const pendingFailures = [];

      imageSettled.forEach((outcome, i) => {
        if (outcome.status === "fulfilled") {
          imageResults.push(outcome.value);
          if (!outcome.value.failed && outcome.value.url) {
            successCount++;
          } else {
            pendingFailures.push({ index: i, prompt: outcome.value.prompt });
          }
        } else {
          captureError(outcome.reason instanceof Error ? outcome.reason : new Error(String(outcome.reason)), { page: i, context: "BookWizard image promise" });
          imageResults.push({ url: "", prompt: sanitizedPageTexts[i]?.image_prompt || "", failed: true });
          pendingFailures.push({ index: i, prompt: sanitizedPageTexts[i]?.image_prompt || "" });
        }
        // Update progress as images complete
        const doneCount = i + 1;
        const imgPercent = 60 + Math.floor((doneCount / imageSettled.length) * 25);
        setCreationProgress((prev) => prev ? { ...prev, percent: imgPercent } : prev);
      });

      // Save all pages in parallel
      setCreationProgress({
        label: t("wizard.progress.savingPages"),
        percent: 85,
        step: ""
      });

      const pageCreatePromises = sanitizedPageTexts.map((pageText, i) => {
        const imageUrl = imageResults[i]?.url || "";
        // If image failed, set a placeholder message on the page record
        const imagePromptFinal = imageResults[i]?.failed
          ? `[Image generation failed] ${pageText.image_prompt}`
          : pageText.image_prompt;

        // scene_id is best-effort: present when the wizard's structure
        // step was used, null otherwise. Stored on Page so a future
        // page-edit surface can re-show the originating scene.
        const sceneId = imageResults[i]?.scene_id || null;

        return Page.create({
          book_id: createdBook.id,
          page_number: i,
          text_content: pageText.text_content,
          image_url: imageUrl,
          image_prompt: imagePromptFinal,
          ...(sceneId ? { scene_id: sceneId } : {}),
          layout_type: i === 0 ? "cover" : LAYOUT_TYPES[(i - 1) % LAYOUT_TYPES.length]
        });
      });

      const savedPages = await Promise.all(pageCreatePromises);

      // Map failures to page IDs for retry
      const failuresWithPageIds = pendingFailures.map(({ index, prompt }) => ({
        pageId: savedPages[index]?.id,
        imagePrompt: prompt
      })).filter((f) => f.pageId);

      // Mark book as complete
      await Book.update(createdBook.id, { status: "complete" });

      setCreationProgress({
        label: t("wizard.progress.bookReady"),
        percent: 100,
        step: ""
      });

      // Clear draft after successful creation
      if (activeDraftKey) {
        clearDraft(activeDraftKey);
        setActiveDraftKey(null);
      }

      // Track book creation event
      trackEvent('book_created', { book_id: createdBook.id });

      // Notify followers about the new book (fire-and-forget)
      if (currentUserData?.email) {
        Follow.filter({ following_email: currentUserData.email })
          .then((followers) => {
            if (followers.length > 0) {
              const authorName = currentUserData.full_name || 'Someone you follow';
              Promise.allSettled(
                followers.map((follower) =>
                  Notification.create({
                    user_email: follower.follower_email,
                    type: 'new_book',
                    title: 'new_book',
                    message: JSON.stringify({ authorName, bookTitle: finalBookData.title }),
                    link: `/BookView?id=${createdBook.id}`,
                    read: false,
                  })
                )
              );
            }
          })
          .catch(() => {}); // notification failures must never block book creation
      }

      // Award XP for book creation
      try {
        await gamification.awardXP("book_created");
        await gamification.incrementStat("totalBooks");
      } catch {
        // gamification is non-critical
      }

      // Show summary: how many images succeeded, and offer retry if any failed
      if (failuresWithPageIds.length > 0) {
        setImageFailures(failuresWithPageIds);
      }

      // Show celebration screen instead of navigating immediately
      setCelebrationBook({
        id: createdBook.id,
        title: finalBookData.title,
        cover_image: coverImage,
        failures: failuresWithPageIds
      });
      setShowCelebration(true);

      // Fire confetti!
      confetti({
        particleCount: 160,
        spread: 80,
        origin: { y: 0.6 },
        colors: ["#7c3aed", "#a855f7", "#ec4899", "#f59e0b", "#3b82f6", "#10b981"]
      });

      // Auto-navigate after 3 seconds
      celebrationTimerRef.current = setTimeout(() => {
        navigateToBook(createdBook.id, failuresWithPageIds);
      }, 3000);
    } catch (err) {
      // Wave-12: Surface real error so user can see WHY it stuck
      const errMessage = err?.message || String(err) || t("wizard.error.createMessage");
      const isTimeout = /timeout|timed out|aborted/i.test(errMessage);
      const isQuota = /quota|rate limit|429|credit/i.test(errMessage);
      const isAuth = /401|403|api.?key|unauthorized/i.test(errMessage);
      const friendlyMsg = isTimeout
        ? t("wizard.error.timeoutMessage") || "ייצור הסיפור לקח יותר מדי זמן. נסה שוב — אם זה ממשיך, ייתכן שיש עומס על שרתי ה-AI."
        : isQuota
        ? "מכסת ה-AI הגיעה. נסה שוב בעוד מספר דקות, או צור קשר אם הבעיה ממשיכה."
        : isAuth
        ? "תקלה באימות מול שרתי ה-AI. נסה שוב מאוחר יותר."
        : `${t("wizard.error.createMessage")}\n\n${errMessage.substring(0, 200)}`;
      captureError(err instanceof Error ? err : new Error(errMessage), { context: "BookWizard.createBook", bookData });
      setError({
        title: t("wizard.error.createTitle"),
        message: friendlyMsg,
        onRetry: createBook,
        details: errMessage.substring(0, 500),
      });
    } finally {
      setIsCreating(false);
      setCreationProgress(null);
    }
  };

  // Cleanup celebration timer on unmount
  useEffect(() => {
    return () => {
      if (celebrationTimerRef.current) {
        clearTimeout(celebrationTimerRef.current);
      }
    };
  }, []);

  const navigateToBook = (bookId, failures) => {
    setShowCelebration(false);
    setCelebrationBook(null);
    navigate(`${createPageUrl("BookView")}?id=${bookId}`);
    // Retry failed images after navigation (non-blocking)
    if (failures && failures.length > 0) {
      setTimeout(() => {
        retryFailedImages(bookId, failures);
      }, 2000);
    }
  };

  const updateBookField = (field, value) => {
    setBookData((prev) => ({ ...prev, [field]: value }));
  };

  // Loading state
  if (isLoading) {
    return (
      <LoadingOverlay
        message={t("wizard.loading")}
        isRTL={isRTL}
      />
    );
  }

  // Error state
  if (error && !isGeneratingOutline && !isCreating) {
    return (
      <div className="max-w-4xl mx-auto p-4 md:p-6 lg:p-8">
        <FriendlyError
          title={error.title}
          message={error.message}
          onRetry={error.onRetry}
          onGoBack={() => {
            setError(null);
            prevStep();
          }}
          isRTL={isRTL}
          language={currentLanguage}
        />
      </div>
    );
  }

  // Render current step content.
  // Step order: 0 topic · 1 characters · 2 structure · 3 preview · 4 save.
  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <TopicStep
            selectedTopic={selectedTopic}
            onSelectTopic={setSelectedTopic}
            customIdea={customIdea}
            onCustomIdeaChange={setCustomIdea}
            isRTL={isRTL}
            language={currentLanguage}
          />
        );
      case 1:
        return (
          <CharacterPicker
            selectedCharacters={selectedCharacters}
            onCharactersChange={setSelectedCharacters}
            isRTL={isRTL}
            language={currentLanguage}
          />
        );
      case 2:
        return (
          <StoryStructure
            scenes={scenes}
            onScenesChange={setScenes}
            topic={selectedTopic}
            customIdea={customIdea}
            selectedCharacters={selectedCharacters}
            language={currentLanguage}
            ageRange={bookData.age_range || localStorage.getItem("preferredAgeRange") || "5-7"}
            isRTL={isRTL}
          />
        );
      case 3:
        return (
          <PreviewEditStep
            bookData={bookData}
            onBookDataChange={updateBookField}
            generatedOutline={generatedOutline}
            isGeneratingOutline={isGeneratingOutline}
            onRegenerateOutline={generateOutline}
            isRTL={isRTL}
            language={currentLanguage}
            useRhyming={useRhyming}
            onUseRhymingChange={setUseRhyming}
            rhymeSettings={rhymeSettings}
            onRhymeSettingsChange={setRhymeSettings}
          />
        );
      case 4:
        return (
          <SaveStep
            bookData={bookData}
            selectedCharacters={selectedCharacters}
            selectedTopic={selectedTopic}
            isCreating={isCreating}
            onCreateBook={createBook}
            creationProgress={creationProgress}
            isRTL={isRTL}
            language={currentLanguage}
          />
        );
      default:
        return null;
    }
  };

  // Celebration screen — shown for 3 seconds after book creation
  if (showCelebration && celebrationBook) {
    const celebrationTitle = t("wizard.celebration.title");
    const readLabel = t("wizard.celebration.readButton");

    return (
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-purple-600 via-fuchsia-500 to-indigo-600"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        dir={isRTL ? "rtl" : "ltr"}
      >
        <motion.div
          className="flex flex-col items-center gap-6 p-8 max-w-sm w-full text-center"
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.1 }}
        >
          {/* Stars decoration */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
            className="absolute top-8 left-8 text-4xl opacity-50"
            aria-hidden="true"
          >
            ✨
          </motion.div>
          <motion.div
            animate={{ rotate: -360 }}
            transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
            className="absolute top-12 right-12 text-3xl opacity-40"
            aria-hidden="true"
          >
            🌟
          </motion.div>

          {/* Book cover */}
          {celebrationBook.cover_image ? (
            <motion.img
              src={celebrationBook.cover_image}
              alt={celebrationBook.title}
              className="w-40 h-52 object-cover rounded-2xl shadow-2xl border-4 border-white/30"
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
            />
          ) : (
            <motion.div
              className="w-40 h-52 rounded-2xl shadow-2xl bg-white/20 flex items-center justify-center border-4 border-white/30"
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <BookOpen className="h-16 w-16 text-white/70" aria-hidden="true" />
            </motion.div>
          )}

          {/* Title */}
          <motion.h1
            className="text-3xl md:text-4xl font-bold text-white drop-shadow-lg"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            {celebrationTitle}
          </motion.h1>

          {/* Book title */}
          {celebrationBook.title && (
            <motion.p
              className="text-lg text-white/90 font-medium"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              {celebrationBook.title}
            </motion.p>
          )}

          {/* CTA Button */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <Button
              onClick={() => {
                if (celebrationTimerRef.current) clearTimeout(celebrationTimerRef.current);
                navigateToBook(celebrationBook.id, celebrationBook.failures);
              }}
              className="bg-white text-purple-700 hover:bg-purple-50 font-bold text-lg px-8 py-4 h-auto rounded-full shadow-xl gap-2"
              aria-label={readLabel}
            >
              <Sparkles className="h-5 w-5" aria-hidden="true" />
              {readLabel}
            </Button>
          </motion.div>

          {/* Auto-navigate hint */}
          <motion.p
            className="text-sm text-white/60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
          >
            {t("wizard.celebration.autoNavigate")}
          </motion.p>
        </motion.div>
      </motion.div>
    );
  }

  return (
    <motion.div
      className="max-w-4xl mx-auto p-4 md:p-6 lg:p-8"
      dir={isRTL ? "rtl" : "ltr"}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
    >
      {/* Gradient Header with Background */}
      <motion.div
        className="relative overflow-hidden rounded-2xl mb-8 shadow-md"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="bg-gradient-to-r from-purple-600 via-indigo-500 to-blue-500 px-6 py-8 text-center">
          <div
            className="absolute inset-0 opacity-[0.06] bg-cover bg-center pointer-events-none"
            style={{ backgroundImage: "url('/images/book-wizard.jpg')" }}
          />
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_50%_0%,white_0%,transparent_70%)]" />
          <motion.div className="relative flex items-center justify-center gap-3 mb-2">
            <div className="p-2 bg-white/20 backdrop-blur-sm rounded-lg">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-white drop-shadow-sm">
              {t("wizard.title")}
            </h1>
          </motion.div>
          <motion.p
            className="text-white/80 text-lg relative"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            {t("wizard.subtitle")}
          </motion.p>
        </div>
      </motion.div>

      {/* Progress Indicator */}
      <WizardProgress
        steps={steps}
        currentStep={currentStep}
        onStepClick={goToStep}
        isRTL={isRTL}
      />

      {/* Step Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, x: isRTL ? -30 : 30 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: isRTL ? 30 : -30 }}
          transition={{ duration: 0.3 }}
          className="mb-8 min-h-[400px] relative bg-white dark:bg-gray-800/50 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700/50 p-6"
        >
          {renderStep()}

          {/* Outline generation loading overlay */}
          {isGeneratingOutline && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm rounded-2xl z-10"
              aria-live="polite"
              role="status"
            >
              <div className="flex flex-col items-center gap-4 text-center px-6">
                <div
                  className="w-12 h-12 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin"
                  aria-hidden="true"
                />
                <div>
                  <p className="text-lg font-semibold text-purple-700 dark:text-purple-300">
                    {t("wizard.generatingOutline")}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {t("wizard.generatingOutlineDesc")}
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Navigation Buttons */}
      <div className={`flex ${isRTL ? "flex-row-reverse" : "flex-row"} justify-between items-center mt-6 pt-4 border-t border-gray-100 dark:border-gray-700/50`}>
        <div className={`flex items-center gap-2 ${isRTL ? "flex-row-reverse" : ""}`}>
          <motion.div whileHover={currentStep > 0 ? { scale: 1.03 } : {}} whileTap={currentStep > 0 ? { scale: 0.97 } : {}}>
            <Button
              variant="outline"
              onClick={prevStep}
              disabled={currentStep === 0}
              className="flex items-center gap-2 rounded-xl border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 h-11 px-5 font-semibold disabled:opacity-40"
              aria-label={t("wizard.nav.back")}
            >
              {isRTL ? (
                <>
                  {t("wizard.nav.back")}
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </>
              ) : (
                <>
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                  {t("wizard.nav.back")}
                </>
              )}
            </Button>
          </motion.div>

          {activeDraftKey && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearDraft}
              className="text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 rounded-xl h-9 w-9 p-0"
              aria-label={t("wizard.draft.clear")}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </Button>
          )}
        </div>

        {currentStep < steps.length - 1 && (
          <motion.div
            whileHover={canGoNext() && !isGeneratingOutline ? { scale: 1.04, y: -1 } : {}}
            whileTap={canGoNext() && !isGeneratingOutline ? { scale: 0.97 } : {}}
          >
            <Button
              onClick={nextStep}
              disabled={!canGoNext() || isGeneratingOutline}
              className="relative overflow-hidden bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 flex items-center gap-2 rounded-xl h-11 px-6 font-bold shadow-md shadow-purple-200/50 border-0 disabled:opacity-50"
              aria-label={t("wizard.nav.next")}
            >
              {canGoNext() && !isGeneratingOutline && (
                <motion.div
                  className="absolute inset-0 bg-white/15 skew-x-12 pointer-events-none"
                  animate={{ x: ["-200%", "300%"] }}
                  transition={{ duration: 2, repeat: Infinity, repeatDelay: 2, ease: "easeInOut" }}
                  aria-hidden="true"
                />
              )}
              {isGeneratingOutline ? (
                <span className="relative z-10">{t("wizard.nav.generating")}</span>
              ) : isRTL ? (
                <>
                  <ChevronLeft className="h-4 w-4 relative z-10" aria-hidden="true" />
                  <span className="relative z-10">{t("wizard.nav.next")}</span>
                </>
              ) : (
                <>
                  <span className="relative z-10">{t("wizard.nav.next")}</span>
                  <ChevronRight className="h-4 w-4 relative z-10" aria-hidden="true" />
                </>
              )}
            </Button>
          </motion.div>
        )}
      </div>

      {/* Creating overlay */}
      {isCreating && (
        <LoadingOverlay
          message={t("wizard.creatingBook")}
          isRTL={isRTL}
          overlay
        />
      )}

    </motion.div>
  );
}
