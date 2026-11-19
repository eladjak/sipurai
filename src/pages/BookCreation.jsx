import { isUnifiedBookEditor } from "@/lib/flags";
import { imageAspectForBook } from "@/lib/printSpec";

import { lazy, Suspense, useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useI18n } from "@/components/i18n/i18nProvider";
import useGamification from "@/hooks/useGamification";
import { Book } from "@/entities/Book";
import { Page } from "@/entities/Page";
import { readablePages } from "@/lib/bookProgress";
import { GenerateImage, InvokeLLM } from "@/integrations/Core";
import { buildSafetyPromptPrefix, sanitizeAIOutput } from "@/utils/content-moderation";
import { canCreateBook, recordBookCreation } from "@/utils/bookRateLimit";
import { reserveBookSlot, QuotaError } from "@/lib/bookQuota";
import { createPageUrl } from "@/utils";
import { Edit, Eye, Printer, Share2, ArrowLeft, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Collaboration } from "@/entities/Collaboration";
import { User } from "@/entities/User";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { captureError } from "@/lib/errorTracking";

// Extracted components
import GenerationSteps from "../components/bookCreation/GenerationSteps";
import BookEditorTab from "../components/bookCreation/BookEditorTab";
import BookStylingTab from "../components/bookCreation/BookStylingTab";
import ShareOptions from "../components/bookCreation/ShareOptions";
import DraftView from "../components/bookCreation/DraftView";
import AutoSaveIndicator from "../components/bookCreation/AutoSaveIndicator";

// Hooks
import { useAutoSave, loadAutoSaved } from "@/hooks/useAutoSave";

// Translations
import { getBookTranslation } from "@/utils/book-translations";

const PrintEdition = lazy(() => import("./PrintEdition"));
export default function BookCreation() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, isLoading: authLoading } = useCurrentUser();
  const bookId = searchParams.get("id");
  return <OwnerBookEditor
    key={JSON.stringify([user?.id, bookId])}
    bookId={bookId}
    ownerId={user?.id}
    authLoading={authLoading}
    searchParams={searchParams}
    setSearchParams={setSearchParams}
  />;
}

function OwnerBookEditor({ bookId, ownerId, authLoading, searchParams, setSearchParams }) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { language: uiLanguage, isRTL } = useI18n();
  const gamification = useGamification();
  const unifiedEditor = isUnifiedBookEditor();
  const editorCopy = getBookTranslation(uiLanguage);

  // Core state
  const [isLoading, setIsLoading] = useState(true);
  const [book, setBook] = useState(null);
  const [pages, setPages] = useState([]);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingStep, setGeneratingStep] = useState(0);
  const [unavailable, setUnavailable] = useState(false);
  const [collaborators, setCollaborators] = useState([]);
  const [legacyTab, setLegacyTab] = useState("editor");
  // Story tool translations follow the book language. The tab controls
  // follow the shell language when the unified editor is enabled.
  const currentLanguage = book?.language || "english";
  const t = getBookTranslation(currentLanguage);
  const editorTabs = [
    { id: "editor", icon: Edit, label: unifiedEditor ? editorCopy("book.unifiedTab.editor") : t("book.tab.editor") },
    { id: "preview", icon: Eye, label: unifiedEditor ? editorCopy("book.unifiedTab.preview") : t("book.tab.preview") },
    { id: "print", icon: Printer, label: editorCopy("book.unifiedTab.print") },
    { id: "share", icon: Share2, label: unifiedEditor ? editorCopy("book.unifiedTab.share") : t("book.tab.share") },
  ];
  const requestedTab = searchParams.get("tab");
  const queryTab = editorTabs.find(tab => tab.id === requestedTab)?.id ?? "editor";
  const activeTab = unifiedEditor ? queryTab : legacyTab;
  const [printOpened, setPrintOpened] = useState(activeTab === "print");

  useEffect(() => {
    if (activeTab === "print") setPrintOpened(true);
  }, [activeTab]);

  function changeTab(tab) {
    if (!editorTabs.some(item => item.id === tab) || (!unifiedEditor && tab === "print")) return;
    if (!unifiedEditor) {
      setLegacyTab(tab);
      return;
    }
    const params = new URLSearchParams(searchParams);
    if (tab === "editor") params.delete("tab");
    else params.set("tab", tab);
    setSearchParams(params, { preventScrollReset: true });
  }

  // Rhyming state
  const [useRhyming, setUseRhyming] = useState(false);
  const [rhymeSettings, setRhymeSettings] = useState({
    pattern: "aabb",
    meter: "iambic",
    complexity: "simple"
  });

  // Text styles — default to David for Hebrew, Arial otherwise
  const defaultFontFamily = (() => {
    try {
      const lang = localStorage.getItem("language") || "english";
      return lang === "hebrew" || lang === "yiddish" ? "David" : "Arial";
    } catch {
      return "Arial";
    }
  })();
  const [textStyles, setTextStyles] = useState({
    fontSize: 18,
    fontFamily: defaultFontFamily,
    color: "#000000",
    showNikud: true,
    fontWeight: "normal",
    alignment: "right",
    lineHeight: 1.5
  });

  // Interactive elements
  const [interactiveElements, setInteractiveElements] = useState([]);

  // Character consistency
  const [characterConsistency, setCharacterConsistency] = useState({
    mainCharacter: {},
    secondaryCharacters: [],
    settings: [],
    style: "consistent"
  });

  // Current page editing state
  const [currentPageText, setCurrentPageText] = useState("");
  const [currentPageImagePrompt, setCurrentPageImagePrompt] = useState("");
  const [currentPageLayout, setCurrentPageLayout] = useState("text_top");

  // Pre-generation wizard phase: "draft" (DraftView) → "scenePlan" (ScenePlanStep) → generation
  const [wizardPhase, setWizardPhase] = useState("draft");
  const [scenePlan, setScenePlan] = useState([]);

  // Auto-save: track editable state
  const autoSaveData = {
    currentPageIndex,
    currentPageText,
    currentPageImagePrompt,
    currentPageLayout,
    textStyles,
    useRhyming,
    rhymeSettings,
    characterConsistency
  };

  const { status: autoSaveStatus, lastSaved, forceSave } = useAutoSave(
    bookId ? `book_${bookId}` : null,
    autoSaveData,
    {
      enabled: !!book && book.status === "complete",
      delayMs: 3000,
      onSaveToDb: async (data) => {
        // Persist current page text to DB on force save
        if (pages.length > 0 && data.currentPageIndex >= 0 && data.currentPageIndex < pages.length) {
          const pageId = pages[data.currentPageIndex].id;
          await Page.update(pageId, { text_content: data.currentPageText });
        }
      }
    }
  );

  // Load book data
  useEffect(() => {
    if (!bookId) {
      navigate(createPageUrl("Library"));
      return;
    }
    if (authLoading) return;
    if (!ownerId) {
      setUnavailable(true);
      setIsLoading(false);
      return;
    }
    let current = true;
    void loadBookData(() => current);
    return () => { current = false; };
  }, [bookId, ownerId, authLoading]);

  // Sync current page fields when page changes
  useEffect(() => {
    if (pages.length > 0 && currentPageIndex >= 0 && currentPageIndex < pages.length) {
      const currentPage = pages[currentPageIndex];
      setCurrentPageText(currentPage.text_content || "");
      setCurrentPageImagePrompt(currentPage.image_prompt || "");
      setCurrentPageLayout(currentPage.layout_type || "text_top");
    }
  }, [pages, currentPageIndex]);

  const loadBookData = async (isCurrent) => {
    try {
      setIsLoading(true);

      const bookData = await Book.get(bookId);
      if (!isCurrent()) return;
      if (bookData?.id !== bookId || bookData?.created_by !== ownerId) {
        setUnavailable(true);
        setIsLoading(false);
        return;
      }
      setBook(bookData);

      // Skeleton rows exist to persist the outline while a book is still
      // being written; they carry no text, so there is nothing here to edit.
      const pagesData = readablePages(await Page.filter({ book_id: bookId }, "page_number"));
      if (!isCurrent()) return;
      setPages(pagesData);

      // Initialize character consistency
      setCharacterConsistency({
        mainCharacter: {
          name: bookData.child_name,
          age: bookData.child_age,
          description:
            bookData.child_gender === "boy"
              ? "Boy with short hair"
              : bookData.child_gender === "girl"
                ? "Girl with long hair"
                : "Child with medium-length hair",
          interests: bookData.interests || ""
        },
        secondaryCharacters: bookData.family_members
          ? bookData.family_members.split(",").map((member) => ({
              name: member.trim(),
              description: ""
            }))
          : [],
        settings: [],
        style: bookData.art_style || "disney"
      });

      // Load collaborators
      const collaborationsData = await Collaboration.filter({
        book_id: bookId,
        status: "accepted"
      });
      if (!isCurrent()) return;
      if (collaborationsData.length > 0) {
        const collaboratorsList = await Promise.all(
          collaborationsData.map(async (collab) => {
            try {
              const user = await User.get(collab.collaborator_id);
              return { ...collab, user };
            } catch (error) {
              return { ...collab, user: { full_name: collab.collaborator_email } };
            }
          })
        );
        if (!isCurrent()) return;
        setCollaborators(collaboratorsList);
      }

      // Attempt to restore auto-saved state
      const saved = loadAutoSaved(`book_${bookId}`);
      if (saved.data && bookData.status === "complete") {
        if (saved.data.textStyles) setTextStyles(saved.data.textStyles);
        if (saved.data.useRhyming !== undefined) setUseRhyming(saved.data.useRhyming);
        if (saved.data.rhymeSettings) setRhymeSettings(saved.data.rhymeSettings);
        if (saved.data.characterConsistency) setCharacterConsistency(saved.data.characterConsistency);
      }

      setIsLoading(false);
    } catch (error) {
      if (!isCurrent()) return;
      toast({
        variant: "destructive",
        description: t("book.loadError")
      });
      navigate(createPageUrl("Library"));
    }
  };

  // --- AI Generation Logic ---

  const generateBook = async (plan = scenePlan) => {
    if (isGenerating) return;

    // --- Rate limit check ---
    try {
      const currentUser = await User.me();
      const rateCheck = canCreateBook(currentUser.email);
      if (!rateCheck.allowed) {
        toast({
          variant: "destructive",
          description: t("book.rateLimit", { limit: rateCheck.limit }),
        });
        return;
      }
    } catch {
      // If we can't determine the user, allow creation to proceed
    }

    try {
      await reserveBookSlot(bookId);
    } catch (qe) {
      if (qe instanceof QuotaError) {
        toast({ variant: "destructive", description: qe.message });
        return;
      }
      throw qe;
    }

    try {
      setIsGenerating(true);
      setGeneratingStep(1);

      await Book.update(bookId, { status: "generating" });

      const outlinePrompt = getStoryOutlinePrompt(plan);
      setGeneratingStep(2);

      const outlineResult = await InvokeLLM({
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
      });

      if (outlineResult.title && (!book.title || book.title === "")) {
        const sanitizedOutlineTitle = sanitizeAIOutput(outlineResult.title);
        await Book.update(bookId, { title: sanitizedOutlineTitle });
        setBook((prev) => ({ ...prev, title: sanitizedOutlineTitle }));
      }

      setGeneratingStep(3);

      const newPages = [];
      let imageSuccessCount = 0;
      const imageFailureInfo = [];

      for (let i = 0; i < outlineResult.outline.length; i++) {
        const pageOutline = outlineResult.outline[i];

        const pageTextPrompt = getPageTextPrompt(pageOutline.description, i);
        const pageTextResult = await InvokeLLM({
          prompt: pageTextPrompt,
          response_json_schema: {
            type: "object",
            properties: {
              text_content: { type: "string" },
              image_prompt: { type: "string" }
            }
          }
        });

        // Sanitize AI text output before saving
        const sanitizedTextContent = sanitizeAIOutput(pageTextResult.text_content || "");

        const imagePrompt = getEnhancedImagePrompt(pageTextResult.image_prompt, i);
        let imageUrl = "";
        let imageFailed = false;

        try {
          const imageResult = await GenerateImage({ prompt: imagePrompt, aspectRatio: imageAspectForBook(book) });
          imageUrl = imageResult?.url || "";
          if (imageUrl) {
            imageSuccessCount++;
          } else {
            imageFailed = true;
            captureError(new Error(`[BookCreation] GenerateImage returned no URL for page ${i}`));
          }
        } catch (imgErr) {
          imageFailed = true;
          captureError(imgErr instanceof Error ? imgErr : new Error(String(imgErr?.message || imgErr)), { page: i, context: "BookCreation image generation" });
        }

        const pageData = {
          book_id: bookId,
          page_number: i,
          text_content: sanitizedTextContent,
          image_url: imageUrl,
          image_prompt: imagePrompt,
          image_failed: imageFailed ? true : undefined,
          layout_type: getLayoutForPageNumber(i)
        };

        const createdPage = await Page.create(pageData);
        newPages.push(createdPage);

        if (imageFailed) {
          imageFailureInfo.push({ pageId: createdPage.id, imagePrompt });
        }

        setGeneratingStep(3 + Math.floor(((i + 1) * 7) / outlineResult.outline.length));
      }

      await Book.update(bookId, { status: "complete" });
      setGeneratingStep(10);

      setPages(newPages);
      setBook((prev) => ({ ...prev, status: "complete" }));

      // Record successful book creation for rate limiting
      try {
        const currentUser = await User.me();
        recordBookCreation(currentUser.email);
      } catch {
        // Non-critical — ignore if user fetch fails
      }

      if (imageFailureInfo.length > 0) {
        toast({
          variant: "destructive",
          description: t("book.imagePartial", { success: imageSuccessCount, total: newPages.length, failed: imageFailureInfo.length }),
        });
      } else {
        toast({
          description: t("book.bookGenerated"),
          className: "bg-green-100 text-green-900 dark:bg-green-900/50 dark:text-green-100"
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        description: t("book.bookGenerateError")
      });
      await Book.update(bookId, { status: "draft" });
    } finally {
      setIsGenerating(false);
    }
  };

  const getStoryOutlinePrompt = () => {
    const { title, child_name, child_age, genre, age_range, tone, moral, length, interests, family_members } = book;
    let pageCount = 10;
    if (length === "short") pageCount = 6;
    if (length === "long") pageCount = 15;

    // Use stored age range from onboarding if book doesn't have one
    const resolvedAgeRange = age_range || localStorage.getItem("preferredAgeRange") || "5-10";
    const safetyPrefix = buildSafetyPromptPrefix(resolvedAgeRange);

    return `${safetyPrefix}Create a detailed outline for a personalized children's book with the following details:
      - Title: ${title || "Generate a catchy title"}
      - Main character: ${child_name}, age ${child_age}
      - Genre: ${genre}
      - Target age range: ${resolvedAgeRange}
      - Tone: ${tone}
      - Moral or lesson: ${moral || "Should include a positive message appropriate for children"}
      - Child's interests: ${interests || "general children's interests"}
      - Family members to include: ${family_members || ""}
      ${useRhyming ? `- The story should be written in rhyming format with pattern: ${rhymeSettings.pattern}, meter: ${rhymeSettings.meter}, complexity: ${rhymeSettings.complexity}` : ""}

      The outline should include exactly ${pageCount} pages (including a title page).
      For each page, provide a brief description of what happens in the story at that point.
      The story should have a clear beginning, middle, and end.
      Make sure the story is engaging, age-appropriate, and has a positive message.

      Return the result as JSON with:
      1. A title (if not provided)
      2. An array of page outlines with page_number and description
    `;
  };

  const getPageTextPrompt = (pageDescription, pageNumber) => {
    const { child_name, child_age, genre, age_range, art_style } = book;
    // Use stored age range from onboarding if book doesn't have one
    const resolvedAgeRange = age_range || localStorage.getItem("preferredAgeRange") || "5-10";
    const safetyPrefix = buildSafetyPromptPrefix(resolvedAgeRange);

    return `${safetyPrefix}Write the text content for page ${pageNumber} of a children's story based on this description: "${pageDescription}"

    Story details:
    - Main character: ${child_name}, age ${child_age}
    - Genre: ${genre}
    - Target age range: ${resolvedAgeRange}
    - Art style: ${art_style}
    ${useRhyming ? `- The text should be written in rhyming format with pattern: ${rhymeSettings.pattern}, meter: ${rhymeSettings.meter}, complexity: ${rhymeSettings.complexity}` : ""}

    ${pageNumber === 0 ? "This is the title page/introduction. Keep it brief and engaging." : ""}

    Also create a detailed image generation prompt that would illustrate this page perfectly.
    The image should match the art style and clearly depict the scene described.
    The description should be detailed enough to generate a consistent character appearance throughout the book.

    Return the result as JSON with:
    1. text_content: The actual text that will appear on the page
    2. image_prompt: A detailed prompt for image generation
    `;
  };

  const getEnhancedImagePrompt = (basePrompt, pageNumber) => {
    const { child_name, child_gender, art_style } = book;
    const { mainCharacter, secondaryCharacters, style } = characterConsistency;

    const characterDescription = `The main character ${child_name} is a ${
      mainCharacter.description ||
      (child_gender === "boy" ? "young boy" : child_gender === "girl" ? "young girl" : "young child")
    }`;

    const secondaryDescriptions =
      secondaryCharacters.length > 0
        ? "Secondary characters: " +
          secondaryCharacters.map((char) => `${char.name} (${char.description || "family member"})`).join(", ")
        : "";

    const styleGuide = `Illustration style: ${art_style || style || "disney"}, consistent character appearances throughout the story, high quality children's book illustration`;

    return `${basePrompt}\n\n${characterDescription}. ${secondaryDescriptions}\n\n${styleGuide}\n\nBright, vibrant colors, child-friendly, appealing to children in the age range ${book.age_range}, emotive and expressive. IMPORTANT: The image must be completely child-safe, age-appropriate, non-violent, and non-scary.`;
  };

  const getLayoutForPageNumber = (pageNumber) => {
    const layouts = ["text_top", "text_bottom", "text_left", "text_right"];
    return layouts[pageNumber % layouts.length];
  };

  // --- Page Edit Actions ---

  const updatePageText = useCallback(async () => {
    if (currentPageIndex < 0 || currentPageIndex >= pages.length) return;

    try {
      const pageId = pages[currentPageIndex].id;
      await Page.update(pageId, { text_content: currentPageText });

      const updatedPages = [...pages];
      updatedPages[currentPageIndex] = {
        ...updatedPages[currentPageIndex],
        text_content: currentPageText
      };
      setPages(updatedPages);

      // Award XP for explicitly saving a page edit
      gamification.awardXP("page_edited");

      toast({
        description: t("book.textUpdated"),
        className: "bg-green-100 text-green-900 dark:bg-green-900/50 dark:text-green-100"
      });
    } catch (error) {
      toast({ variant: "destructive", description: t("book.textUpdateError") });
    }
  }, [currentPageIndex, currentPageText, pages, t, toast, gamification]);

  const updatePageImage = useCallback(async () => {
    if (currentPageIndex < 0 || currentPageIndex >= pages.length || !currentPageImagePrompt) return;

    try {
      setIsGenerating(true);

      const enhancedPrompt = getEnhancedImagePrompt(currentPageImagePrompt, currentPageIndex);
      const imageResult = await GenerateImage({ prompt: enhancedPrompt, aspectRatio: imageAspectForBook(book) });

      const pageId = pages[currentPageIndex].id;
      await Page.update(pageId, {
        image_url: imageResult.url,
        image_prompt: enhancedPrompt
      });

      const updatedPages = [...pages];
      updatedPages[currentPageIndex] = {
        ...updatedPages[currentPageIndex],
        image_url: imageResult.url,
        image_prompt: enhancedPrompt
      };
      setPages(updatedPages);

      toast({
        description: t("book.imageUpdated"),
        className: "bg-green-100 text-green-900 dark:bg-green-900/50 dark:text-green-100"
      });
    } catch (error) {
      toast({ variant: "destructive", description: t("book.imageUpdateError") });
    } finally {
      setIsGenerating(false);
    }
  }, [currentPageIndex, currentPageImagePrompt, pages, t, toast, book, characterConsistency]);

  const updatePageLayout = useCallback(
    async (newLayout) => {
      if (currentPageIndex < 0 || currentPageIndex >= pages.length) return;

      try {
        const pageId = pages[currentPageIndex].id;
        await Page.update(pageId, { layout_type: newLayout });

        const updatedPages = [...pages];
        updatedPages[currentPageIndex] = {
          ...updatedPages[currentPageIndex],
          layout_type: newLayout
        };
        setPages(updatedPages);
        setCurrentPageLayout(newLayout);

        toast({
          description: t("book.layoutUpdated"),
          className: "bg-green-100 text-green-900 dark:bg-green-900/50 dark:text-green-100"
        });
      } catch (error) {
        toast({ variant: "destructive", description: t("book.layoutUpdateError") });
      }
    },
    [currentPageIndex, pages, t, toast]
  );

  const addNikudToText = useCallback(async () => {
    if (!currentPageText) return;

    try {
      const result = await InvokeLLM({
        prompt: `Add correct Hebrew nikud (vocalization) to the following text. Only return the text with added nikud. Text: "${currentPageText}"`,
        response_json_schema: {
          type: "object",
          properties: { text_with_nikud: { type: "string" } }
        }
      });

      if (result.text_with_nikud) {
        setCurrentPageText(sanitizeAIOutput(result.text_with_nikud));
        toast({
          description: t("book.nikudAdded"),
          className: "bg-green-100 text-green-900 dark:bg-green-900/50 dark:text-green-100"
        });
      }
    } catch (error) {
      toast({ variant: "destructive", description: t("book.nikudError") });
    }
  }, [currentPageText, t, toast]);

  const convertToRhyme = useCallback(async () => {
    if (!currentPageText) return;

    try {
      setIsGenerating(true);

      const result = await InvokeLLM({
        prompt: `Convert the following text to a rhyming format in the same language.
        Use rhyme pattern: ${rhymeSettings.pattern},
        meter: ${rhymeSettings.meter},
        complexity: ${rhymeSettings.complexity}.
        Maintain the same meaning and tone. Text: "${currentPageText}"`,
        response_json_schema: {
          type: "object",
          properties: { rhyming_text: { type: "string" } }
        }
      });

      if (result.rhyming_text) {
        setCurrentPageText(sanitizeAIOutput(result.rhyming_text));
        toast({
          description: t("book.rhymeSuccess"),
          className: "bg-green-100 text-green-900 dark:bg-green-900/50 dark:text-green-100"
        });
      }
    } catch (error) {
      toast({ variant: "destructive", description: t("book.rhymeError") });
    } finally {
      setIsGenerating(false);
    }
  }, [currentPageText, rhymeSettings, t, toast]);

  // --- Render States ---

  // Loading - skeleton layout matching the book editor structure
  if (isLoading || authLoading) {
    return (
      <div className="max-w-5xl mx-auto py-6 px-4" aria-busy="true" role="status">
        {/* Header skeleton */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-md" />
            <div className="space-y-1">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
          <Skeleton className="h-5 w-24" />
        </div>

        {/* Tabs skeleton */}
        <div className="flex gap-2 mb-6">
          <Skeleton className="h-9 w-24 rounded-md" />
          <Skeleton className="h-9 w-24 rounded-md" />
          <Skeleton className="h-9 w-32 rounded-md" />
        </div>

        {/* Main content skeleton: page nav + editor */}
        <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-6">
          {/* Page thumbnails column */}
          <div className="flex md:flex-col gap-2 overflow-x-auto md:overflow-visible">
            {Array(5).fill(0).map((_, i) => (
              <Skeleton key={i} className="h-20 w-14 flex-shrink-0 rounded-md" />
            ))}
          </div>

          {/* Editor area */}
          <div className="space-y-4">
            <Card>
              <CardContent className="p-4">
                <Skeleton className="aspect-[4/3] w-full rounded-md mb-4" />
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-5/6 mb-2" />
                <Skeleton className="h-4 w-4/6" />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 space-y-3">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-24 w-full rounded-md" />
                <div className="flex gap-2 justify-end">
                  <Skeleton className="h-9 w-28 rounded-md" />
                  <Skeleton className="h-9 w-28 rounded-md" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
        <span className="sr-only">{t("book.creatingMessage")}</span>
      </div>
    );
  }

  if (unavailable) {
    return (
      <div className="mx-auto max-w-lg space-y-4 px-4 py-10 text-center" dir={isRTL ? "rtl" : "ltr"}>
        <p role="alert">{editorCopy("book.editorUnavailable")}</p>
        <Button variant="outline" className="min-h-11" onClick={() => navigate(createPageUrl("Library"))}>
          {editorCopy("book.backToLibrary")}
        </Button>
      </div>
    );
  }

  // Generating
  if (isGenerating && book?.status !== "complete") {
    return (
      <div className="max-w-4xl mx-auto py-8" dir={isRTL ? "rtl" : "ltr"}>
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            {t("book.creatingTitle")}
          </h1>
          <p className="text-gray-600 dark:text-gray-400">{t("book.creatingMessage")}</p>
        </div>
        <GenerationSteps currentStep={generatingStep} />
      </div>
    );
  }

  // Draft (pre-generation)
  if (book?.status !== "complete") {
    return (
      <DraftView
        book={book}
        characterConsistency={characterConsistency}
        setCharacterConsistency={setCharacterConsistency}
        useRhyming={useRhyming}
        setUseRhyming={setUseRhyming}
        rhymeSettings={rhymeSettings}
        setRhymeSettings={setRhymeSettings}
        isGenerating={isGenerating}
        onGenerate={generateBook}
        onNavigateBack={() => navigate(createPageUrl("Library"))}
        isRTL={isRTL}
        t={t}
      />
    );
  }

  // Complete book editor
  return (
    <div className="max-w-7xl mx-auto py-4" dir={isRTL ? "rtl" : "ltr"}>
      {/* Gradient Header Banner */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative overflow-hidden rounded-2xl mb-6 shadow-lg"
      >
        <div className="bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 px-6 py-5">
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(ellipse_at_20%_50%,white_0%,transparent_70%)]" />
          <div className={`relative flex items-center justify-between gap-4 ${isRTL ? "flex-row-reverse" : ""}`}>
            {/* Left: back + title */}
            <div className={`flex items-center gap-3 ${isRTL ? "flex-row-reverse" : ""}`}>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate(createPageUrl("Library"))}
                className="text-white/80 hover:text-white hover:bg-white/15 rounded-xl"
                aria-label={t("book.backToLibrary")}
              >
                <ArrowLeft className={`h-5 w-5 ${isRTL ? "rotate-180" : ""}`} aria-hidden="true" />
              </Button>
              <div>
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-yellow-300" aria-hidden="true" />
                  <h1 className="text-xl font-bold text-white font-heading">
                    {book.title || t("book.createTitle")}
                  </h1>
                </div>
                <p className="text-white/60 text-sm mt-0.5">{t("book.editingLabel")}</p>
              </div>
            </div>

            {/* Right: auto-save indicator */}
            <div className="shrink-0">
              <AutoSaveIndicator
                status={autoSaveStatus}
                lastSaved={lastSaved}
                isRTL={isRTL}
                t={t}
              />
            </div>
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.1 }}
      >
        <Tabs
          value={activeTab}
          onValueChange={changeTab}
          activationMode={unifiedEditor ? "manual" : "automatic"}
          className="mb-6 min-w-0"
          dir={isRTL ? "rtl" : "ltr"}
        >
          <TabsList
            aria-label={editorCopy("book.editingLabel")}
            className={unifiedEditor
              ? "flex h-auto w-full max-w-full justify-start gap-1 overflow-x-auto rounded-2xl border border-purple-100 bg-white p-1.5 shadow-sm dark:border-purple-800/30 dark:bg-gray-800 sm:w-fit"
              : "gap-1 rounded-2xl border border-purple-100 bg-white p-1.5 shadow-md dark:border-purple-800/30 dark:bg-gray-800"}
          >
            {editorTabs.filter(tab => unifiedEditor || tab.id !== "print").map(({ id, icon: Icon, label }) => (
              <TabsTrigger
                key={id}
                value={id}
                className={unifiedEditor
                  ? "min-h-11 shrink-0 gap-1.5 rounded-xl px-3 text-sm focus-visible:ring-inset data-[state=active]:bg-purple-700 data-[state=active]:text-white data-[state=active]:underline data-[state=active]:decoration-2 data-[state=active]:underline-offset-4 sm:gap-2 sm:px-5"
                  : "gap-2 rounded-xl px-5 py-2.5 text-sm text-gray-600 dark:text-gray-400 data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-500 data-[state=active]:to-purple-600 data-[state=active]:text-white data-[state=active]:shadow-md"}
              >
                <Icon className={unifiedEditor ? "hidden h-4 w-4 shrink-0 sm:block" : "h-4 w-4 shrink-0"} aria-hidden="true" />
                {label}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Tab 1: Editor */}
          <TabsContent value="editor" className="space-y-6">
            <BookEditorTab
              book={book}
              bookId={bookId}
              pages={pages}
              currentPageIndex={currentPageIndex}
              currentPageText={currentPageText}
              currentPageImagePrompt={currentPageImagePrompt}
              currentPageLayout={currentPageLayout}
              textStyles={textStyles}
              interactiveElements={interactiveElements}
              useRhyming={useRhyming}
              isGenerating={isGenerating}
              isRTL={isRTL}
              t={t}
              onPageIndexChange={setCurrentPageIndex}
              onTextChange={setCurrentPageText}
              onSaveText={updatePageText}
              onAddNikud={addNikudToText}
              onConvertToRhyme={convertToRhyme}
              onImagePromptChange={setCurrentPageImagePrompt}
              onRegenerateImage={updatePageImage}
              onLayoutChange={updatePageLayout}
            />

            {/* Styling section below editor */}
            <BookStylingTab
              textStyles={textStyles}
              setTextStyles={setTextStyles}
              bookLanguage={book.language}
              useRhyming={useRhyming}
              setUseRhyming={setUseRhyming}
              rhymeSettings={rhymeSettings}
              setRhymeSettings={setRhymeSettings}
              onConvertToRhyme={convertToRhyme}
              isGenerating={isGenerating}
              isRTL={isRTL}
              t={t}
              toast={toast}
            />
          </TabsContent>

          {/* Tab 2: Preview — gradient border frame */}
          <TabsContent value="preview">
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
              className="p-1 rounded-2xl shadow-xl mb-6"
              style={{
                background: "linear-gradient(135deg, #7c3aed, #6366f1, #4f46e5)"
              }}
            >
              <div className={`rounded-[14px] bg-gray-50 dark:bg-gray-900 ${unifiedEditor ? "p-1 sm:p-4" : "p-4"}`}>
                <iframe
                  src={`${createPageUrl("BookView")}?id=${encodeURIComponent(bookId)}`}
                  className="w-full h-[70vh] rounded-xl border-0 bg-white shadow-inner overflow-hidden"
                  title={t("book.previewTitle")}
                />
              </div>
            </motion.div>
          </TabsContent>

          {unifiedEditor && (activeTab === "print" || printOpened) && (
            <TabsContent value="print" forceMount hidden={activeTab !== "print"} className="min-w-0">
              <Suspense fallback={<p className="py-6" role="status">{editorCopy("book.loadingPrint")}</p>}>
                <PrintEdition key={bookId} />
              </Suspense>
            </TabsContent>
          )}

          {/* Tab 3: Share & Export */}
          <TabsContent value="share">
            <ShareOptions book={book} bookId={bookId} />
          </TabsContent>
        </Tabs>
      </motion.div>
    </div>
  );
}
