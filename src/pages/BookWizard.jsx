import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Book } from "@/entities/Book";
import { Page } from "@/entities/Page";
import { createPageUrl } from "@/utils";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { InvokeLLM, GenerateImage } from "@/integrations/Core";
import { generateBookIncremental } from "@/lib/bookGeneration";
import { buildRecipe, pageCountFor } from "@/lib/bookRecipe";
import { hebrewTitleInstruction } from "@/lib/storyManuscript";
import { BOOK_STATUS } from "@/lib/bookProgress";
import { generateStoryBible } from "@/lib/storyBible";
import { moderateInput, buildSafetyPromptPrefix, sanitizeAIOutput } from "@/utils/content-moderation";
import { checkAgeAppropriateLanguage, checkContentSafety } from "@/utils/content-moderation";
import useGamification from "@/hooks/useGamification";
import { useI18n } from "@/components/i18n/i18nProvider";
import { trackEvent } from "@/lib/analytics";
import { captureError } from "@/lib/errorTracking";

import GenerationWaiting from "@/components/bookReader/GenerationWaiting";
import WizardProgress from "@/components/wizard/WizardProgress";
import TopicStep, { getSelectedTopicLabel } from "@/components/wizard/TopicStep";
import CharacterPicker from "@/components/shared/CharacterPicker";
import PreviewEditStep from "@/components/wizard/PreviewEditStep";
import PrintSizeStep from "@/components/wizard/PrintSizeStep";
import PrintPreferences from "@/screens/print-edition/PrintPreferences";
import { initialEditionFields } from "@/lib/printEdition/model";
import SaveStep from "@/components/wizard/SaveStep";
import StoryStructure from "@/components/storyBuilder/StoryStructure";
import FriendlyError from "@/components/shared/FriendlyError";
import QuotaLimitCard from "@/components/shared/QuotaLimitCard";
import { reserveBookSlot, clearActiveBookKey, newBookKey, QuotaError } from "@/lib/bookQuota";


// Preserve edits made before an asynchronous outline returns.
export function fillEmptyOutlineFields(previous, outline) {
  return {
    title: previous.title?.trim() ? previous.title : outline.title,
    description: previous.description?.trim() ? previous.description : outline.description,
    moral: previous.moral?.trim() ? previous.moral : outline.moral,
  };
}

// --- Draft auto-save helpers ---
const DRAFT_PREFIX = "sipurai_draft_";
const IDEA_FIELDS = ["title", "description", "moral"];
export function draftOwnerPrefix(ownerId) {
  const encoded = encodeURIComponent(ownerId);
  return `${DRAFT_PREFIX}v2_${encoded.length}_${encoded}_`;
}

export function getDraftKeys(ownerId) {
  if (!ownerId) return [];
  const ownerPrefix = draftOwnerPrefix(ownerId);
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(ownerPrefix)) {
      keys.push(key);
    }
  }
  // Sort by saved timestamp (newest first)
  keys.sort((a, b) => (readDraft(b)?._savedAt || 0) - (readDraft(a)?._savedAt || 0));
  return keys;
}

function readDraft(key) {
  try {
    const draft = JSON.parse(localStorage.getItem(key) || "null");
    return Number.isFinite(draft?._savedAt) ? draft : null;
  } catch {
    return null;
  }
}

function getLatestDraft(ownerId) {
  try {
    for (const key of getDraftKeys(ownerId)) {
      const draft = readDraft(key);
      if (draft) return { ...draft, _draftKey: key };
    }
  } catch {
    // The wizard is still usable when browser storage is unavailable.
  }
  return null;
}

function clearDraft(key) {
  if (key) {
    localStorage.removeItem(key);
  }
}

function clearAllDrafts(ownerId) {
  const keys = getDraftKeys(ownerId);
  keys.forEach((k) => localStorage.removeItem(k));
}

export default function BookWizard() {
  const { user } = useCurrentUser();
  return <BookWizardSession key={user?.id || "anonymous"} />;
}

function BookWizardSession() {
  const reduceMotion = useReducedMotion();
  const navigate = useNavigate();
  const { toast } = useToast();
  const gamification = useGamification();
  const { t, language: uiLanguage, isRTL } = useI18n();
  const { user: currentUserData } = useCurrentUser();
  const ownerId = currentUserData?.id || null;
  const ownerRef = useRef(ownerId);
  ownerRef.current = ownerId;
  const pendingIdeaRef = useRef(null);
  const incomingIdeaLoadedRef = useRef(false);

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
  const [importedIdeaFields, setImportedIdeaFields] = useState([]);

  // Step 2: Characters
  const [selectedCharacters, setSelectedCharacters] = useState([]);

  // Step 2.5: Story Structure (scene-by-scene spine)
  // Each scene: { id, role, title, description, characters: string[], illustration_prompt }
  const [scenes, setScenes] = useState([]);

  // Creation progress
  const [creationProgress, setCreationProgress] = useState(null);
  // Track image generation failures for retry

  // Celebration state after book creation
  const [celebrationBook, setCelebrationBook] = useState(null); // { id, title, cover_image }
  const [showCelebration, setShowCelebration] = useState(false);
  const celebrationTimerRef = useRef(null);
  // Guards the one-way handover to the reader. Generation continues in this tab
  // after the navigation, so this must not fire twice per run.
  const handedOffRef = useRef(false);
  const quotaKeyRef = useRef(null);
  const [quotaBlock, setQuotaBlock] = useState(null);
  // The title the outline call settled on, which is what actually gets saved.
  const createdTitleRef = useRef("");

  // Step 3: Book data (preview/edit)
  const [initialBookData] = useState(() => ({
    title: "",
    description: "",
    moral: "",
    art_style: "disney",
    length: "medium",
    genre: "adventure",
    age_range: currentUserData?.preferred_age_range || "5-7",
    language: "english",
    child_name: "",
    child_age: 5,
    child_gender: "neutral",
    tone: "exciting",
    interests: "",
    family_members: "",
    status: "draft",
    cover_image: "",
    print_size: "square-220",
    printEdition: null
  }));
  const [bookData, setBookData] = useState(initialBookData);

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
  const [pendingDraft, setPendingDraft] = useState(null);
  const skipNextAutosaveRef = useRef(false);
  const [hasIncomingIdea, setHasIncomingIdea] = useState(false);

  // Save draft to localStorage.
  const saveDraft = useCallback((attemptId = quotaKeyRef.current) => {
    // Don't save while creating or if book is already being generated
    if (isCreating || !ownerId) return;

    const draftData = {
      currentStep,
      selectedTopic,
      customIdea,
      importedIdeaFields,
      selectedCharacters,
      scenes,
      bookData,
      generatedOutline,
      useRhyming,
      rhymeSettings,
      _attemptId: attemptId || null,
      _savedAt: Date.now(),
    };

    const ownerPrefix = draftOwnerPrefix(ownerId);
    const key = activeDraftKey?.startsWith(ownerPrefix) ? activeDraftKey : `${ownerPrefix}${Date.now()}_${newBookKey()}`;
    try {
      localStorage.setItem(key, JSON.stringify(draftData));
      if (activeDraftKey !== key) setActiveDraftKey(key);
      return true;
    } catch {
      return false;
    }
  }, [currentStep, selectedTopic, customIdea, importedIdeaFields, selectedCharacters, scenes, bookData, generatedOutline, useRhyming, rhymeSettings, isCreating, activeDraftKey, ownerId]);

  // Import only once the account is known. Keep the handoff until the new draft is saved.
  useEffect(() => {
    if (!ownerId || incomingIdeaLoadedRef.current) return;
    incomingIdeaLoadedRef.current = true;
    const draft = getLatestDraft(ownerId);
    if (draft?._savedAt && Date.now() - draft._savedAt < 7 * 24 * 60 * 60 * 1000) {
      setPendingDraft(draft);
    }

    try {
      const raw = sessionStorage.getItem("sipurai_pending_idea");
      const pending = JSON.parse(raw);
      if (pending?.ownerId !== ownerId) return;
      const { title, description, moral } = pending;
      const ideaText = [title, description].filter(value => typeof value === "string" && value.trim()).join(" — ");
      if (!ideaText) return;

      pendingIdeaRef.current = raw;
      setHasIncomingIdea(true);
      setSelectedTopic("custom");
      setCustomIdea(ideaText);
      const metadata = {
        title: typeof title === "string" ? title : "",
        description: typeof description === "string" ? description : "",
        moral: typeof moral === "string" ? moral : "",
      };
      setImportedIdeaFields(IDEA_FIELDS.filter(field => metadata[field].trim()));
      setBookData(prev => ({ ...prev, ...metadata }));
      toast({
        title: t("wizard.idea.prefilled"),
        className: "bg-purple-100 text-purple-900 dark:bg-purple-900/50 dark:text-purple-100",
      });
    } catch {
      // A blocked or malformed handoff does not prevent opening the wizard.
    }
  }, [ownerId, t, toast]);

  // Persist committed edits so leaving the page immediately cannot drop them.
  useEffect(() => {
    if (isLoading || isCreating || (!selectedTopic && !customIdea && !bookData.title)) return;
    if (skipNextAutosaveRef.current) {
      skipNextAutosaveRef.current = false;
      return;
    }
    if (!saveDraft() || !pendingIdeaRef.current) return;
    try {
      if (sessionStorage.getItem("sipurai_pending_idea") === pendingIdeaRef.current) {
        sessionStorage.removeItem("sipurai_pending_idea");
      }
      pendingIdeaRef.current = null;
    } catch {
      // The draft remains saved even if session storage cannot be changed.
    }
  }, [selectedTopic, customIdea, bookData.title, saveDraft, isLoading, isCreating]);

  const restorePendingDraft = () => {
    const draft = pendingDraft;
    if (!draft || ownerRef.current !== ownerId) return;
    setCurrentStep(Number.isInteger(draft.currentStep) && draft.currentStep >= 0 && draft.currentStep < steps.length ? draft.currentStep : 0);
    setSelectedTopic(draft.selectedTopic ?? null);
    setCustomIdea(typeof draft.customIdea === "string" ? draft.customIdea : "");
    const sourceFields = Array.isArray(draft.importedIdeaFields) ? draft.importedIdeaFields : [];
    setImportedIdeaFields(IDEA_FIELDS.filter(field => sourceFields.includes(field)));
    setSelectedCharacters(Array.isArray(draft.selectedCharacters) ? draft.selectedCharacters : []);
    setScenes(Array.isArray(draft.scenes) ? draft.scenes : []);
    setBookData({ ...initialBookData, language: currentLanguage, ...draft.bookData });
    setGeneratedOutline(draft.generatedOutline ?? null);
    setUseRhyming(draft.useRhyming === true);
    if (draft.rhymeSettings) setRhymeSettings((prev) => ({ ...prev, ...draft.rhymeSettings }));
    quotaKeyRef.current = draft._attemptId || null;
    setActiveDraftKey(draft._draftKey);
    setPendingDraft(null);
    setHasIncomingIdea(false);
    pendingIdeaRef.current = null;
  };

  const handleClearDraft = () => {
    quotaKeyRef.current = null;
    if (activeDraftKey) {
      clearDraft(activeDraftKey);
      skipNextAutosaveRef.current = true;
      setActiveDraftKey(null);
    } else {
      clearAllDrafts(ownerId);
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
    { id: "size", title: isRTL ? "גודל" : "Size" },
    { id: "save", title: t("wizard.steps.create") }
  ];

  // Load user language (book content language) from hook data
  // Keyed on the language STRING, not on the user object: the object is a new reference whenever
  // Clerk refreshes the user (or a test mock returns a fresh one per render), and re-running this
  // effect resets the story language the parent just picked, or loops forever when the source is unstable.
  const userLanguage = currentUserData?.language;
  useEffect(() => {
    const lang = userLanguage || localStorage.getItem("language") || "english";
    setCurrentLanguage(lang);
    setBookData((prev) => ({ ...prev, language: lang }));
    setIsLoading(false);
  }, [userLanguage]);

  // Navigation
  // 0: topic · 1: characters · 2: structure · 3: preview · 4: size · 5: save
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
      case 5: return true;
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

      // Prefer the book’s age range, then this family’s saved preference.
      const ageRange = bookData.age_range || currentUserData?.preferred_age_range || "5-10";
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
1. A catchy title for the story. ${currentLanguage === 'hebrew' ? hebrewTitleInstruction : ''}
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

        // SAFETY GATE (blocking): genuinely unsafe wording must never reach a child.
        const safety = checkContentSafety(`${sanitizedTitle} ${sanitizedDescription} ${sanitizedMoral}`);
        if (!safety.isClean) {
          toast({
            variant: "destructive",
            title: t("wizard.error.contentIssue"),
            description: t("wizard.error.contentNotAppropriate")
          });
          setIsGeneratingOutline(false);
          return false;
        }

        // STYLE HINTS (advisory, never blocking). checkAgeAppropriateLanguage
        // documents itself as "Does NOT block content, but returns flags and
        // suggestions" — it is a readability linter, not a safety check. Its
        // `isAppropriate` is simply `flags.length === 0`, so a hint like "keep
        // sentences under 15 words for ages 3-5" made it false.
        //
        // Until 2026-08-07 this was wired as a hard block, and it stopped the
        // wizard dead at the structure step for essentially every book: the
        // default age range is "5-10" (minAge 5), which enables the sentence-
        // length check, and an AI-written 2-3 sentence description almost always
        // contains a sentence over 15 words. The user got a toast saying their
        // story was inappropriate for children — for long sentences — and the
        // wizard silently refused to advance while the API had returned a
        // perfectly good story. Real blocking belongs to checkContentSafety
        // above; this stays advisory, as its own contract says.
        const ageCheck = checkAgeAppropriateLanguage(sanitizedDescription, ageRange);
        if (!ageCheck.isAppropriate) {
          console.info("[BookWizard] readability hints (non-blocking):", ageCheck.flags);
        }

        const sanitizedResult = { ...result, title: sanitizedTitle, description: sanitizedDescription, moral_lesson: sanitizedMoral };
        setGeneratedOutline(sanitizedResult);
        setBookData((prev) => ({
          ...prev,
          ...fillEmptyOutlineFields(prev, { title: sanitizedTitle, description: sanitizedDescription, moral: sanitizedMoral }),
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

  // Create the book with parallel page generation
  // Sprint 24: opt-in fast path. Set localStorage.sipurai_use_story_bible='1' to enable.
  // When enabled: ONE InvokeLLM call returns the full Story Bible (title + characters
  // + global_style + all page texts + image_prompts + tts_directions), then images run in
  // parallel using the page-level image_prompt that already inlines character continuity.
  // Saves N+2 round-trips (outline + cover + 1-per-page text) for a bigger book.
  const tryStoryBibleFastPath = async () => {
    try {
      const isHebrewBook = bookData.language === "hebrew";
      const ageRange = bookData.age_range || currentUserData?.preferred_age_range || "5-10";
      const safetyDirective = buildSafetyPromptPrefix(ageRange);
      const topicDescription = selectedTopic === "custom" && customIdea ? customIdea : selectedTopic;
      const characters = selectedCharacters.map((c) => ({
        name: c.name,
        role: c.role || "character",
        description: c.appearance || c.description || c.traits || c.name,
      }));

      const pageCount = pageCountFor(bookData.length);

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

  /**
   * Build a book — incrementally, and resumably.
   *
   * The wizard owns *what the story says*: every prompt below is the same
   * material the old one-shot version used. What it no longer owns is when
   * anything is written; that belongs to `generateBookIncremental`, which
   * persists each page the moment it exists and can never leave the row
   * claiming work is still happening. See src/lib/bookGeneration.js.
   *
   * The user-visible consequence, and the reason for the redesign: as soon as
   * page one has words, we hand the parent over to the reader and let the rest
   * of the book fill in behind them. Five seconds to something real beats a
   * minute of progress bar.
   *
   * @param {{resumeBookId?: string|null}} [opts] resume an interrupted book
   */
  const createBook = async ({ resumeBookId = null } = {}) => {
    let createdBookId = resumeBookId;
    handedOffRef.current = false;
    createdTitleRef.current = "";

    try {
      setIsCreating(true);
      setError(null);
      setCreationProgress({ label: t("wizard.progress.checkingContent"), waitingMessage: t("spxWizard.waiting.preparing"), percent: 5, step: "" });

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

      // Server-side quota: take a slot for this book before any AI call. The same key is reused
      // for retries of this creation, so a retry never costs a second book.
      const previousKey = resumeBookId || quotaKeyRef.current;
      const quotaKey = previousKey || newBookKey();
      quotaKeyRef.current = quotaKey;
      // Save before the first reservation; a refresh must keep this exact key.
      if (!saveDraft(quotaKey)) throw new Error(t('spxWizard.saveFailed'));
      try {
        if (previousKey && Book.generationStore) {
          const matches = await Book.filter({ id: quotaKey });
          resumeBookId = matches.some((book) => book.id === quotaKey && book.created_by === ownerId) ? quotaKey : null;
        }
        if (!resumeBookId || !Book.generationStore) {
          const reservation = await reserveBookSlot(quotaKey);
          if (Book.generationStore && reservation?.skipped) throw new Error(t('spxWizard.saveFailed'));
        }
      } catch (qe) {
        if (qe instanceof QuotaError) {
          setQuotaBlock(qe);
          setIsCreating(false);
          setCreationProgress(null);
          return;
        }
        throw qe;
      }

      const pageCount = pageCountFor(bookData.length);

      // Wave-8 opt-in fast path: ONE call returns every page's text upfront.
      // Only meaningful for a fresh book — a resume already has its plan in the
      // page rows and must not re-imagine pages the parent is reading.
      const useStoryBibleFastPath =
        !resumeBookId &&
        (typeof window !== "undefined") &&
        window.localStorage?.getItem("sipurai_use_story_bible") === "1";
      let storyBible = null;
      if (useStoryBibleFastPath) {
        storyBible = await tryStoryBibleFastPath();
        if (storyBible?.pages?.length && storyBible?.title) {
          if (import.meta.env.DEV) console.log("[BookWizard] Story Bible generated:", storyBible.title, "pages:", storyBible.pages.length);

        } else {
          storyBible = null;
        }
      }

      setCreationProgress({
        label: t("wizard.progress.creatingStory"),
        percent: 10,
        step: t("wizard.progress.step1of4")
      });

      // Every prompt the book is built from lives in buildRecipe, shared with
      // the reader so an interrupted book can be finished from there and still
      // read like the same book. See src/lib/bookRecipe.js.
      // Persist the cast on the book row. `books.selected_characters` (jsonb)
      // has existed all along and was never written to — which meant a book
      // carried no record of who was in it, and anything rebuilding its prompts
      // later (the reader's Continue button) had to invent the characters.
      // Only the fields the prompts actually read are stored.
      const persistedCharacters = selectedCharacters.map((c) => ({
        id: c.id,
        name: c.name,
        appearance: c.appearance || "",
        description: c.description || "",
        traits: c.traits || "",
      }));

      const { printEdition, ...storyFields } = bookData;
      const recipe = buildRecipe({
        bookData: { ...storyFields, ...initialEditionFields(printEdition), selectedCharacters: persistedCharacters },
        characters: selectedCharacters,
        scenes,
        topic: selectedTopic === "custom" && customIdea ? customIdea : selectedTopic,
        useRhyming,
        rhymeSettings,
        storyBible,
        pageCount,
        defaultAgeRange: currentUserData?.preferred_age_range || "5-10",
      });

      const result = await generateBookIncremental({
        entities: { Book, Page },
        ai: { InvokeLLM, GenerateImage },
        recipe,
        bookId: resumeBookId,
        newBookId: quotaKey,
        onEvent: (event) => {
          switch (event.type) {
            case "phase":
              setCreationProgress({
                label: t("wizard.progress.creatingStory"),
                waitingMessage: event.phase === "editing" ? t("spxWizard.waiting.editing") : t("spxWizard.waiting.outline"),
                percent: event.phase === "editing" ? 22 : 10,
                step: event.phase === "editing"
                  ? t("spxWizard.editing")
                  : t("wizard.progress.step1of4")
              });
              break;

            case "book-created":
            case "resumed":
              createdBookId = event.bookId;
              // The outline call renames the book, so the celebration screen and
              // the follower notification must quote the title the parent will
              // actually see — not the one they typed into the form.
              if (event.title) createdTitleRef.current = event.title;
              setCreationProgress({
                label: t("wizard.progress.savingBook"),
                waitingMessage: t("spxWizard.waiting.pages"),
                percent: 20,
                step: t("wizard.progress.step2of4")
              });
              break;

            case "plan-saved":
              setCreationProgress({
                label: t("wizard.progress.writingStory"),
                waitingMessage: t("spxWizard.waiting.pages"),
                percent: 25,
                step: t("wizard.progress.step3of4")
              });
              break;

            case "page-text":
              setCreationProgress({
                label: t("wizard.progress.writingStory"),
                waitingMessage: event.ready === event.total ? t("spxWizard.waiting.storyWritten") : t("spxWizard.waiting.writing"),
                percent: progressPercent(event),
                step: t("spxWizard.writingCount", { ready: event.ready, total: event.total }),
                counts: { ready: event.ready, illustrated: event.illustrated, total: event.total }
              });
              // The first readable page is the handover point: the parent goes
              // to the reader now and watches the rest arrive there, instead of
              // watching a progress bar here.
              if (event.ready >= 1) handOffToReader(event);
              break;

            case "page-image":
              setCreationProgress({
                label: t("wizard.progress.drawingIllustrations"),
                waitingMessage: t("spxWizard.waiting.drawing"),
                percent: progressPercent(event),
                step: t("spxWizard.drawingCount", { ready: event.illustrated, total: event.total }),
                counts: { ready: event.ready, illustrated: event.illustrated, total: event.total }
              });
              break;

            default:
              break;
          }
        },
      });

      createdBookId = result.bookId;

      if (result.status === BOOK_STATUS.FAILED) {
        // Nothing readable was produced. Say so plainly rather than dropping the
        // parent into a reader with an empty book.
        throw new Error(t("wizard.error.nothingGenerated") || "לא הצלחנו לכתוב אף עמוד. נסו שוב.");
      }

      // Everything below is a side effect of the book existing, not of it being
      // finished — a partial book is a real book and earns the same XP, the same
      // draft cleanup.
      handOffToReader({ bookId: result.bookId, ready: result.ready, total: result.total });
    } catch (err) {
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

      // The generator has already written a truthful status for whatever it
      // managed to build — `partial` if anything is readable, `failed` if not.
      // Nothing here needs to repair the row; it only has to offer the retry,
      // and a retry of a book that exists is a RESUME, so the parent never pays
      // twice for the pages they already have.
      const resumeId = createdBookId || err?.bookId || null;
      setError({
        title: t("wizard.error.createTitle"),
        message: friendlyMsg,
        onRetry: () => createBook({ resumeBookId: resumeId }),
        details: errMessage.substring(0, 500),
      });
    } finally {
      clearActiveBookKey();
      setIsCreating(false);
      setCreationProgress(null);
    }
  };

  /** Map a progress event onto the bar. Text is worth more than pictures because
   *  text is what makes a page readable at all. Never reaches 100 until settled. */
  const progressPercent = (event) => {
    const total = Math.max(1, event.total || 1);
    const text = (event.ready || 0) / total;
    const art = (event.illustrated || 0) / total;
    return Math.min(99, 25 + Math.round(text * 45 + art * 30));
  };

  /**
   * Hand the parent over to the reader as soon as there is something to read,
   * exactly once. Generation keeps running in this tab behind the navigation —
   * the reader polls and shows each page as it lands.
   */
  const handOffToReader = (event) => {
    if (handedOffRef.current || !event?.bookId) return;
    handedOffRef.current = true;

    // Preserve recoverable drafts; generation does not delete stored work.
    trackEvent('book_created', { book_id: event.bookId });
    gamification.awardXP("book_created").catch(() => {});
    gamification.incrementStat("totalBooks").catch(() => {});

    setCelebrationBook({
      id: event.bookId,
      title: titleForBook(),
      cover_image: "",
    });
    setShowCelebration(true);

    celebrationTimerRef.current = setTimeout(() => {
      navigateToBook(event.bookId);
    }, 2500);
  };

  const titleForBook = () => createdTitleRef.current || bookData.title;

  // Cleanup celebration timer on unmount
  useEffect(() => {
    return () => {
      if (celebrationTimerRef.current) {
        clearTimeout(celebrationTimerRef.current);
      }
    };
  }, []);

  const navigateToBook = (bookId) => {
    setShowCelebration(false);
    setCelebrationBook(null);
    navigate(`${createPageUrl("BookView")}?id=${encodeURIComponent(bookId)}`);
  };

  const updateBookField = (field, value) => {
    if (importedIdeaFields.includes(field)) {
      setImportedIdeaFields(previous => previous.filter(importedField => importedField !== field));
    }
    setBookData((prev) => ({ ...prev, [field]: value }));
  };

  const applySuggestedIdea = (idea) => {
    if (idea === customIdea) return;
    setCustomIdea(idea);
    setGeneratedOutline(null);
    if (!importedIdeaFields.length) return;
    setBookData(previous => {
      const next = { ...previous };
      for (const field of importedIdeaFields) next[field] = "";
      return next;
    });
    setImportedIdeaFields([]);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center" role="status" aria-live="polite" dir={isRTL ? "rtl" : "ltr"}>
        <p className="rounded-2xl bg-purple-50 px-8 py-6 text-lg font-semibold text-purple-900">{t("wizard.loading")}</p>
      </div>
    );
  }

  if (quotaBlock) {
    return <QuotaLimitCard error={quotaBlock} onBack={() => navigate(createPageUrl("Library"))} />;
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
  // Step order: 0 topic · 1 characters · 2 structure · 3 preview · 4 size · 5 save.
  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <TopicStep
            selectedTopic={selectedTopic}
            onSelectTopic={setSelectedTopic}
            customIdea={customIdea}
            onCustomIdeaChange={setCustomIdea}
            onApplySuggestedIdea={applySuggestedIdea}
            isRTL={isRTL}
            language={currentLanguage}
          />
        );
      case 1:
        return (
          <CharacterPicker
            selectedCharacters={selectedCharacters}
            onCharactersChange={setSelectedCharacters}
            ownerId={ownerId}
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
            ageRange={bookData.age_range || currentUserData?.preferred_age_range || "5-7"}
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
        return <>
          <PrintSizeStep artStyle={bookData.art_style} value={bookData.print_size || "square-220"} onChange={(value) => updateBookField("print_size", value)} length={bookData.length} isRTL={isRTL} />
          <PrintPreferences value={bookData.printEdition} onChange={(value) => updateBookField("printEdition", value)} isRTL={isRTL} compact />
        </>;
      case 5:
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

  // The manuscript can be opened while its illustrations are still being drawn.
  if (showCelebration && celebrationBook) {
    return (
      <main dir={isRTL ? "rtl" : "ltr"} className="fixed inset-0 z-50 grid place-items-center overflow-auto bg-[#f8f1e3] p-5 text-[#283c41]">
        <section className="w-full max-w-md overflow-hidden rounded-3xl bg-[#fffaf0] shadow-xl">
          <img src="/images/spx/hearth.webp" alt="" className="aspect-[5/3] w-full object-cover" />
          <div className="space-y-3 p-6 sm:p-8">
            <h1 className="text-3xl font-bold">{t('spxWizard.firstPages')}</h1>
            <p className="text-lg">{celebrationBook.title}</p>
            <Button
              className="min-h-12 rounded-full bg-[#284f51] px-6 text-white hover:bg-[#1d3f42]"
              onClick={() => {
                clearTimeout(celebrationTimerRef.current);
                navigateToBook(celebrationBook.id);
              }}
            >
              {t('wizard.celebration.readButton')}
            </Button>
            <p className="text-sm">{t('wizard.celebration.autoNavigate')}</p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <motion.div
      className="max-w-4xl mx-auto p-4 md:p-6 lg:p-8"
      dir={isRTL ? "rtl" : "ltr"}
      initial={reduceMotion ? false : { opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduceMotion ? undefined : { opacity: 0, y: -20 }}
    >
      {pendingDraft && <section className="mb-4 rounded-2xl border border-sp-line bg-sp-card p-4 text-sp-ink-900">
        <p role="status" className="font-semibold">{t("wizard.draft.found")}</p>
        <p className="mt-1 text-sm">{t("wizard.draft.foundDesc", { title: pendingDraft.bookData?.title || getSelectedTopicLabel(pendingDraft.selectedTopic, t) || t("wizard.draft.untitled") })}</p>
        <div className="mt-3 flex flex-wrap gap-2"><Button type="button" onClick={restorePendingDraft} className="min-h-11">{t("wizard.draft.restore")}</Button><Button type="button" variant="outline" onClick={() => setPendingDraft(null)} className="min-h-11">{hasIncomingIdea ? t("spxWizard.topic.keepIncoming") : t("spxWizard.fresh")}</Button></div>
      </section>}

      <header className="mb-4 flex min-h-24 items-center gap-4 overflow-hidden rounded-2xl border border-amber-100 bg-[#fffaf0] p-3 text-[#231942] shadow-sm sm:mb-6 sm:p-4">
        <img src="/images/spx/topics/adventure.webp" alt="" aria-hidden="true" className="h-20 w-20 shrink-0 rounded-xl object-cover sm:h-24 sm:w-24" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-purple-700">{t("wizard.title")}</p>
          <h1 className="mt-1 text-xl font-bold leading-tight sm:text-2xl">{steps[currentStep]?.title}</h1>
          <p className="mt-1 text-sm text-[#5b5478]" aria-live="polite">{t("spxWizard.step", { current: currentStep + 1, total: steps.length })}</p>
        </div>
      </header>

      <div className="hidden sm:block">
        <WizardProgress steps={steps} currentStep={currentStep} onStepClick={goToStep} isRTL={isRTL} />
      </div>

      {/* Step Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={reduceMotion ? false : { opacity: 0, x: isRTL ? -30 : 30 }}
          animate={{ opacity: 1, x: 0 }}
          exit={reduceMotion ? undefined : { opacity: 0, x: isRTL ? 30 : -30 }}
          transition={{ duration: 0.3 }}
          className="mb-6 min-h-[300px] relative bg-[#fffdf8] dark:bg-gray-800/50 rounded-2xl shadow-sm border border-amber-100 dark:border-gray-700/50 p-4 sm:p-6"
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
      <div className={`mt-6 flex items-center justify-between border-t border-gray-100 pt-4 dark:border-gray-700/50 ${currentStep === 0
        ? "sticky bottom-0 z-20 rounded-t-xl bg-[#fffdf8] px-2 pb-3 shadow-[0_-4px_20px_rgba(40,24,70,0.09)] dark:bg-slate-950"
        : ""}`}>
        <div className="flex items-center gap-2">
          <motion.div whileHover={!reduceMotion && currentStep > 0 ? { scale: 1.03 } : {}} whileTap={!reduceMotion && currentStep > 0 ? { scale: 0.97 } : {}}>
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
              className="text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 rounded-xl h-11 w-11 p-0"
              aria-label={t("wizard.draft.clear")}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </Button>
          )}
        </div>

        {currentStep < steps.length - 1 && (
          <motion.div
            whileHover={!reduceMotion && canGoNext() && !isGeneratingOutline ? { scale: 1.04, y: -1 } : {}}
            whileTap={!reduceMotion && canGoNext() && !isGeneratingOutline ? { scale: 0.97 } : {}}
          >
            <Button
              onClick={nextStep}
              disabled={!canGoNext() || isGeneratingOutline}
              className="relative overflow-hidden bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 flex items-center gap-2 rounded-xl h-11 px-6 font-bold shadow-md shadow-purple-200/50 border-0 disabled:opacity-50"
              aria-label={t("wizard.nav.next")}
            >
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/95 px-6 dark:bg-gray-900/95" dir={isRTL ? "rtl" : "ltr"}>
          <GenerationWaiting
            t={t}
            title={t("wizard.creatingBook")}
            message={creationProgress?.waitingMessage ?? t("spxWizard.waiting.preparing")}
            counts={creationProgress?.counts}
          />
        </div>
      )}

    </motion.div>
  );
}
