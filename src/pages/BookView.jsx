import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Book } from "@/entities/Book";
import { isUnifiedBookEditor } from "@/lib/flags";
import { Page } from "@/entities/Page";
import { PublicBook, PublicPage } from "@/entities/PublicBook";
import { createPageUrl } from "@/utils";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useI18n } from "@/components/i18n/i18nProvider";
import {
  ArrowLeft,
  ArrowRight,
  Home,
  Download,
  Maximize,
  Minimize,
  Moon,
  Sun,
  ZoomIn,
  ZoomOut,
  Loader2,
  PenTool,
  Printer,
  BookOpen,
  Share2,
  Plus,
  LogIn,
  Volume2,
  VolumeX
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import "@/styles/story-reader.css";
import "@/styles/sp-fonts.css";
import ReaderIllustration from "@/components/bookReader/ReaderIllustration";
import PageFlip from "@/components/bookReader/PageFlip";
import GenerationWaiting from "@/components/bookReader/GenerationWaiting";
import GiftEditionCTA from "@/components/bookReader/GiftEditionCTA";
import { exportBookToPDF } from "@/utils/pdfExporter";
import useGamification from "@/hooks/useGamification";
import { updateMeta, resetMeta } from "@/lib/seo";
import { useAuth } from "@/lib/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import { readablePages, summarizeBook, viewState, isResumable } from "@/lib/bookProgress";
import { isRunLive } from "@/lib/generationLock";
import { generateBookIncremental } from "@/lib/bookGeneration";
import { reserveBookSlot, clearActiveBookKey, QuotaError } from "@/lib/bookQuota";
import { buildRecipe } from "@/lib/bookRecipe";
import { InvokeLLM, GenerateImage } from "@/integrations/Core";
import { editionLabels } from "@/screens/print-edition/labels";
import { printEditionUrl } from "@/lib/printEdition/model";
import { OrderBookButton } from "@/components/checkout/OrderBookButton";

function claimAutomaticRecovery(key) {
  try {
    if (localStorage.getItem(key) !== null) return false;
    localStorage.setItem(key, "1");
    return true;
  } catch {
    return false;
  }
}

export default function BookView() {
  const { user } = useCurrentUser();
  const [searchParams] = useSearchParams();
  const bookId = searchParams.get("id");
  return <BookReader key={JSON.stringify([bookId, user?.id])} bookId={bookId} user={user} />;
}

function BookReader({ bookId, user }) {
  const { t, language: i18nLanguage, isRTL: i18nIsRTL } = useI18n();
  const { navigateToLogin } = useAuth();
  const [book, setBook] = useState(null);
  const [isOwner, setIsOwner] = useState(false);
  // Every page row the book has, including skeleton rows a run has not filled
  // in yet. `pages` below is what the reader may actually show — see
  // src/lib/bookProgress.js. Keeping both means the reader can say "3 of 10"
  // instead of silently pretending three was the plan.
  const [allPages, setAllPages] = useState([]);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [resuming, setResuming] = useState(null);
  const resumeInFlight = useRef(false);
  const isResuming = resuming !== null;
  const [resumeError, setResumeError] = useState(null);
  const [legacyConfirmation, setLegacyConfirmation] = useState(false);
  const [failedArt, setFailedArt] = useState(/** @type {Record<string, boolean>} */ ({}));
  // Re-read on a timer while a run is heartbeating, so pages appear as they land.
  const [liveTick, setLiveTick] = useState(0);
  const [loading, setLoading] = useState(true);
  const [direction, setDirection] = useState(1);
  const [currentLanguage, setCurrentLanguage] = useState(i18nLanguage);

  // Enhanced reader state
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [nightMode, setNightMode] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [pdfProgress, setPdfProgress] = useState(0);
  // Wave-14: Optional background music toggle
  const [musicOn, setMusicOn] = useState(false);
  const [musicError, setMusicError] = useState(false);
  const musicRef = useRef(null);

  const { toast } = useToast();
  const containerRef = useRef(null);
  const touchStartRef = useRef(null);
  const bookReadAwardedRef = useRef(false);

  const gamification = useGamification();

  const isRTL = currentLanguage === "hebrew" || currentLanguage === "yiddish";
  const isHebrewBook = currentLanguage === "hebrew" || currentLanguage === "yiddish";
  const isGuest = !user;

  useEffect(() => {
    if (!bookId) {
      setLoading(false);
    }
  }, [bookId]);

  useEffect(() => {
    if (!bookId) return;

    // `liveTick` re-runs this while a generation run is alive. A refresh must
    // not throw the reader back into a full-page spinner mid-story, so only the
    // first pass shows one.
    const isRefresh = liveTick > 0;
    let current = true;

    const loadBook = async () => {
      try {
        if (!isRefresh) setLoading(true);
        const lang = user?.language || i18nLanguage || "english";
        setCurrentLanguage(lang);

        // Owner reads the full book (RLS scopes the base tables to the owner).
        // Guests / non-owners cannot read the base books/pages tables (they
        // carry child PII and anon has no grant) — fall back to the sanitized,
        // PII-free public views (public_books / public_pages), which only return
        // rows where is_public = true. See entities/PublicBook.js + migration
        // 2026-05-25-public-pii-safe-views.sql.
        // Resolved independently on purpose. These used to share one try/catch
        // over a Promise.all, so a failure fetching PAGES sent the BOOK to the
        // public-view fallback too — and public_books only returns is_public
        // rows, so a private book the owner had every right to see resolved to
        // null and rendered as "book not found". A book that loads must be
        // shown even when its pages cannot be.
        let bookData = null;
        let pagesData = [];

        try {
          bookData = user?.id ? await Book.get(bookId) : null;
          if (bookData?.created_by !== user?.id) bookData = null;
        } catch {
          bookData = null;
        }
        const ownerLoaded = Boolean(bookData);
        if (!bookData) {
          try {
            bookData = await PublicBook.get(bookId);
          } catch {
            bookData = null;
          }
        }

        try {
          if (bookData) {
            pagesData = await (ownerLoaded ? Page : PublicPage).filter({ book_id: bookId }, "page_number");
          }
        } catch {
          pagesData = [];
        }
        pagesData = Array.isArray(pagesData) ? pagesData : [];

        if (!current) return;
        setBook(bookData);
        setIsOwner(ownerLoaded);
        setAllPages(pagesData);

        // Restoring the saved position is a first-load concern. On a refresh
        // during generation the reader must stay exactly where the parent is —
        // yanking them to a remembered page while they read would be worse
        // than any loading state.
        if (!isRefresh) {
          const readable = readablePages(pagesData);
          const savedPage = localStorage.getItem(`book_${bookId}_page`);
          if (savedPage) {
            const pageIdx = parseInt(savedPage, 10);
            if (pageIdx >= 0 && pageIdx < readable.length) {
              setCurrentPageIndex(pageIdx);
            }
          }
        }

        if (bookData?.language) {
          setCurrentLanguage(bookData.language);
        }

        if (bookData) {
          updateMeta({
            title: bookData.title,
            description: bookData.description || t("bookView.defaultDescription"),
            image: bookData.cover_image,
            type: 'article',
          });
        }
      } catch {
        if (current) toast({
          variant: "destructive",
          description: t('bookView.loadError'),
        });
      } finally {
        if (current) setLoading(false);
      }
    };

    loadBook();
    return () => { current = false; };
  }, [bookId, liveTick, user?.id]);

  // Pages a reader may be shown, in order. Skeleton rows written to persist the
  // outline are excluded until they have words.
  const pages = useMemo(() => readablePages(allPages), [allPages]);
  const currentPage = pages[currentPageIndex];
  const isCoverPage = currentPage?.page_number === 0;
  const coverImage = book?.cover_image || (isCoverPage ? currentPage?.image_url : null);
  const progress = summarizeBook(book, allPages);
  const brokenPageNumbers = Object.keys(failedArt).filter(key => key !== 'cover').map(Number);
  const fullyIllustrated = book?.status !== 'partial' && progress.isComplete && !progress.missingImage.length &&
    !Object.keys(failedArt).length && !!book?.cover_image;
  const missingArtCount = new Set([...progress.missingImage, ...brokenPageNumbers]).size +
    (failedArt.cover || (book && !book.cover_image) ? 1 : 0);
  function recordArtFailure(key, failed) {
    setFailedArt(previous => {
      if (!!previous[key] === failed) return previous;
      const next = { ...previous };
      if (failed) next[key] = true;
      else delete next[key];
      return next;
    });
  }
  const runLive = isRunLive(bookId) || isResuming;
  const state = viewState(book, allPages, runLive);
  const canResume = isOwner && (isResumable(book, allPages) || !fullyIllustrated);

  const generationMessage = resuming === "automatic-checking" ? t("spxReader.automaticChecking")
    : resuming === "automatic" ? t("spxReader.automaticDrawing")
    : runLive && progress.isComplete ? t("spxWizard.waiting.artComing")
    : runLive ? t("spxWizard.waiting.storyComing")
    : progress.isComplete && missingArtCount === 1 ? t("spxReader.oneMissingIllustration")
    : progress.isComplete && missingArtCount > 1 ? t("spxReader.missingIllustrations", { count: missingArtCount })
    : t("spxReader.generationPaused");

  // While something is building this book, re-read it every few seconds so each
  // page appears as it lands. The poll stops the moment the run stops
  // heartbeating — a closed tab therefore leaves a still reader offering to
  // continue, not one spinning forever against nothing.
  useEffect(() => {
    if (!bookId || !runLive || fullyIllustrated) return undefined;
    const timer = setInterval(() => setLiveTick((n) => n + 1), 4000);
    return () => clearInterval(timer);
  }, [bookId, runLive, fullyIllustrated]);

  /**
   * The characters a book was built with, as stored on the row. `jsonb` returns
   * whatever was written, so this never assumes it got an array.
   */
  const asCharacterList = (value) => {
    if (Array.isArray(value)) return value.filter((c) => c && c.name);
    if (typeof value === "string") {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed.filter((c) => c && c.name) : [];
      } catch {
        return [];
      }
    }
    return [];
  };

  /**
   * Finish an interrupted book from the reader.
   *
   * The prompts are rebuilt from the persisted row, and the generator only does
   * what is missing — so this never rewrites a page the parent has already read
   * and recovers the original rhyme, scenes and artwork from the private checkpoint.
   */
  const handleResume = async (confirmLegacy = false, automatic = false) => {
    if (!canResume || !book?.id || resumeInFlight.current) return;
    if (automatic && (!Book.generationStore || book.is_public !== false || !user?.id)) return;
    resumeInFlight.current = true;
    setResuming(automatic ? "automatic-checking" : "manual");
    setResumeError(null);
    try {
      if (!Book.generationStore) await reserveBookSlot(book.id);
      const result = await generateBookIncremental({
        entities: { Book, Page },
        ai: { InvokeLLM, GenerateImage },
        recipe: buildRecipe({
          bookData: book,
          // The entity layer maps `selected_characters` → `selectedCharacters`
          // on read (src/lib/supabaseEntity.js), so the camel name is the one
          // that exists here. Both are accepted in case a row arrives raw.
          characters: asCharacterList(book.selectedCharacters ?? book.selected_characters),
          pageCount: progress.total || undefined,
        }),
        bookId: book.id,
        ...(automatic ? { automaticRecoveryOwnerId: user.id } : {
          allowLegacyReservation: confirmLegacy === true,
          repairPages: brokenPageNumbers,
          repairCover: !!failedArt.cover || !book.cover_image,
        }),
        onEvent: (event) => {
          if (automatic && event.type === "resumed") setResuming("automatic");
          if (event.type === 'cover') {
            recordArtFailure('cover', false);
            setLiveTick((n) => n + 1);
          }
          if (event.type === "page-text" || event.type === "page-image") {
            if (event.type === 'page-image') recordArtFailure(event.index, false);
            setLiveTick((n) => n + 1);
          }
        },
      });
      if (automatic && result.status !== "complete") setResumeError(t("spxReader.automaticStopped"));
      setLegacyConfirmation(false);
    } catch (err) {
      if (automatic) {
        if (!['automatic_recovery_unavailable', 'provenance_missing', 'lease_busy', 'book_not_owned'].includes(err?.code)) {
          setResumeError(t("spxReader.automaticStopped"));
        }
        return;
      }
      if (err?.code === 'provenance_missing') {
        setLegacyConfirmation(true);
        setResumeError(t('spxReader.legacyAllowance'));
        return;
      }
      if (err?.code === 'legacy_count_unknown') {
        setLegacyConfirmation(false);
        setResumeError(t('spxReader.unknownPageCount'));
        return;
      }
      setResumeError(err instanceof QuotaError ? err.message : ['lease_busy', 'lease_lost'].includes(err?.code)
        ? t('spxWizard.leaseBusy') : t('bookView.resumeFailed'));
    } finally {
      if (!automatic) clearActiveBookKey();
      resumeInFlight.current = false;
      setResuming(null);
      setLiveTick((n) => n + 1);
    }
  };

  useEffect(() => {
    if (import.meta.env.VITE_READER_AUTO_RECOVERY !== "true" || loading || !canResume || runLive ||
        !Book.generationStore || !user?.id || book?.created_by !== user.id || book.is_public !== false ||
        !Number.isInteger(book.total_pages) || book.total_pages < 1 || pages.length !== book.total_pages ||
        pages.some((page, index) => page.page_number !== index) ||
        (!progress.missingImage.length && book.cover_image?.trim())) return;
    const key = `book_${book.id}_automatic_recovery_attempted`;
    let cancelled = false;
    function start() {
      if (cancelled || resumeInFlight.current || isRunLive(book.id)) return;
      if (claimAutomaticRecovery(key)) void handleResume(false, true);
    }
    // Serialize the durable browser marker across tabs when available. The
    // database fence still protects the run across browsers and devices.
    if (navigator.locks) void navigator.locks.request(key, start).catch(() => {});
    else start();
    return () => { cancelled = true; };
  }, [book, canResume, loading, pages, progress.missingImage.length, runLive, user?.id]);

  // Pages arrive while the reader is open, and a resume can only ever add them
  // — but a book read from a stale cache could still leave the index past the
  // end. Clamp rather than render `undefined` as a blank page.
  useEffect(() => {
    if (pages.length > 0 && currentPageIndex > pages.length - 1) {
      setCurrentPageIndex(pages.length - 1);
    }
  }, [pages.length, currentPageIndex]);

  useEffect(() => {
    return () => resetMeta();
  }, []);

  useEffect(() => {
    if (bookId && pages.length > 0) {
      localStorage.setItem(`book_${bookId}_page`, String(currentPageIndex));
    }
  }, [bookId, currentPageIndex, pages.length]);

  useEffect(() => {
    if (
      !isGuest && fullyIllustrated &&
      pages.length > 1 &&
      currentPageIndex === pages.length - 1 &&
      !bookReadAwardedRef.current
    ) {
      bookReadAwardedRef.current = true;
      gamification.awardXP("book_read");

    }
  }, [currentPageIndex, pages.length, fullyIllustrated, isGuest]);

  const goToNextPage = useCallback(() => {
    if (currentPageIndex < pages.length - 1) {
      setDirection(1);
      setCurrentPageIndex((prev) => Math.min(prev + 1, pages.length - 1));
    }
  }, [currentPageIndex, pages.length]);

  const goToPreviousPage = useCallback(() => {
    if (currentPageIndex > 0) {
      setDirection(-1);
      setCurrentPageIndex((prev) => Math.max(0, prev - 1));
    }
  }, [currentPageIndex]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.closest?.("input, textarea, select, [contenteditable=true]")) return;

      switch (e.key) {
        case "ArrowRight":
          isRTL ? goToPreviousPage() : goToNextPage();
          break;
        case "ArrowLeft":
          isRTL ? goToNextPage() : goToPreviousPage();
          break;
        case "Escape":
          if (isFullscreen) toggleFullscreen();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [goToNextPage, goToPreviousPage, isRTL, isFullscreen]);

  const handleTouchStart = (e) => {
    touchStartRef.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e) => {
    if (touchStartRef.current === null) return;
    const diff = touchStartRef.current - e.changedTouches[0].clientX;
    const threshold = 50;

    if (Math.abs(diff) > threshold) {
      if (diff > 0) {
        isRTL ? goToPreviousPage() : goToNextPage();
      } else {
        isRTL ? goToNextPage() : goToPreviousPage();
      }
    }
    touchStartRef.current = null;
  };

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const zoomIn = () => setZoomLevel((prev) => Math.min(prev + 0.25, 2));
  const zoomOut = () => setZoomLevel((prev) => Math.max(prev - 0.25, 0.75));

  const handleExportPDF = async () => {
    if (!book || pages.length === 0) return;
    try {
      setIsExportingPDF(true);
      setPdfProgress(0);
      await exportBookToPDF(book, pages, {
        format: "a4",
        onProgress: (progress) => setPdfProgress(progress)
      });
      toast({
        title: t('bookView.downloadComplete'),
        description: t('bookView.downloadCompleteDesc'),
        className: "bg-green-100 text-green-900 dark:bg-green-900/50 dark:text-green-100"
      });
    } catch {
      toast({
        variant: "destructive",
        description: t('bookView.pdfExportError')
      });
    } finally {
      setIsExportingPDF(false);
      setPdfProgress(0);
    }
  };

  // Map art styles to child-friendly font families
  const getBookFontFamily = () => {
    const style = book?.art_style;
    // For Hebrew books, use Fredoka (playful, supports Hebrew) for all styles
    // For English, vary by art style
    if (isHebrewBook) {
      return "'SP Rubik', Rubik, sans-serif";
    }
    switch (style) {
      case "storybook":
      case "vintage":
        return "'Fredoka', Georgia, serif";
      case "comic":
      case "popArt":
        return "'Fredoka', 'Comic Sans MS', cursive";
      case "minimalist":
        return "'Nunito', sans-serif";
      default:
        return "'Fredoka', 'Nunito', sans-serif";
    }
  };

  // Night mode color helpers — consistent throughout
  const nightBg       = nightMode ? "bg-gray-950" : "bg-[#eee3cd] dark:bg-gray-900";
  const nightCard     = nightMode ? "bg-gray-900 text-amber-50" : "bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200";
  const nightHeader   = nightMode ? "bg-gray-900/95 border-gray-800" : "bg-white/95 dark:bg-gray-900/95 border-gray-200 dark:border-gray-700";
  const nightToolbar  = nightMode ? "text-amber-100 hover:bg-gray-800" : "";

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" role="status" aria-live="polite">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-700 mx-auto" aria-hidden="true" />
          <p className="mt-4 text-gray-600 dark:text-gray-300">
            {t('bookView.loading')}
          </p>
        </div>
      </div>
    );
  }

  // A book that exists but has no readable page yet is NOT "not found". Creation
  // writes the book row, then its outline, then each page — so there is a real
  // window in which a real book has nothing to show. Telling the owner it does
  // not exist sends them looking for their own mistake.
  //
  // Two states, and the difference between them is whether anything is working
  // on it right now — which the status column cannot answer, because a closed
  // tab leaves `generating` behind forever. `viewState` answers it from the run
  // heartbeat instead.
  if (book && pages.length === 0 && (state === "starting" || state === "empty")) {
    const starting = state === "starting";
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center p-8 text-center bg-gray-50 dark:bg-gray-900" dir={isRTL ? "rtl" : "ltr"}>
        <h1 className="mb-4 text-xl font-bold text-gray-900 dark:text-white">{book.title}</h1>
        <div className="mb-6">
          <GenerationWaiting
            t={t}
            message={starting ? t("spxWizard.waiting.firstWords") : t("bookView.building.stopped")}
            active={starting}
          />
        </div>

        {resumeError && (
          <p className="text-sm text-red-600 dark:text-red-400 mb-4 max-w-md">{resumeError}</p>
        )}

        <div className="flex flex-wrap gap-3 justify-center">
          {canResume && !starting && (
            <Button
              onClick={() => handleResume(legacyConfirmation)}
              disabled={isResuming}
              className="gap-2 bg-purple-600 hover:bg-purple-700 text-white"
            >
              {isResuming
                ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                : <PenTool className="h-4 w-4" aria-hidden="true" />}
              {legacyConfirmation ? t("spxReader.confirmAllowance") : t("bookView.building.continue")}
            </Button>
          )}
          <Link to={createPageUrl("Library")}>
            <Button variant={canResume && !starting ? "outline" : "default"} className="gap-2">
              {isRTL ? <ArrowRight className="h-4 w-4" /> : <ArrowLeft className="h-4 w-4" />}
              {t('bookView.backToLibrary')}
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // No book found after loading — genuinely missing or not visible to this user
  if (!book) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center p-8 text-center bg-gray-50 dark:bg-gray-900" dir={isRTL ? "rtl" : "ltr"}>
        <BookOpen className="h-16 w-16 text-gray-300 dark:text-gray-600 mb-4" />
        <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
          {t('bookView.noBook.title')}
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mb-6">
          {t('bookView.noBook.description')}
        </p>
        <Link to={createPageUrl("Library")}>
          <Button className="gap-2 bg-purple-600 hover:bg-purple-700 text-white">
            {isRTL ? <ArrowRight className="h-4 w-4" /> : <ArrowLeft className="h-4 w-4" />}
            {t('bookView.backToLibrary')}
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      data-night={nightMode}
      className={`family-reader min-h-dvh flex flex-col ${nightBg} transition-colors duration-300`}
      dir={isRTL ? "rtl" : "ltr"}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Guest sign-in banner */}
      {isGuest && book && (
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-4 py-2 flex items-center justify-between gap-3 text-sm">
          <span className={isRTL ? "text-right" : ""}>
            {t('reader.guestBanner')}
          </span>
          <button
            onClick={() => navigateToLogin()}
            className="shrink-0 flex items-center gap-1.5 bg-white text-purple-700 hover:bg-purple-50 transition-colors px-3 py-1 rounded-full font-medium"
          >
            <LogIn className="h-3.5 w-3.5" aria-hidden="true" />
            {t('bookView.signIn')}
          </button>
        </div>
      )}

      {progress.isReadable && !fullyIllustrated && (
        <div className={`px-4 py-3 flex flex-wrap items-center justify-between gap-3 ${runLive
          ? "bg-purple-50 dark:bg-purple-950/40 text-purple-900 dark:text-purple-100"
          : "bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-100"}`}>
          <GenerationWaiting t={t} message={generationMessage} counts={progress} compact active={runLive} />

          {canResume && !runLive && (
            <button
              type="button"
              onClick={() => handleResume(legacyConfirmation)}
              className="min-h-11 flex items-center gap-2 rounded-full bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800"
            >
              <PenTool className="h-4 w-4" aria-hidden="true" />
              {legacyConfirmation ? t('spxReader.confirmAllowance') : progress.isComplete
                ? t("bookView.building.retryArt")
                : t("bookView.building.continue")}
            </button>
          )}
        </div>
      )}

      {resumeError && (
        <div className="px-4 py-2 text-sm bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-200" role="alert">
          {resumeError}
        </div>
      )}

      {/* Gradient header matching app design */}
      <header className={`sticky top-0 z-30 backdrop-blur-sm border-b transition-colors duration-300 ${nightHeader} shadow-sm`}>
        {/* Subtle gradient strip at very top */}
        {!nightMode && (
          <div className="h-0.5 bg-gradient-to-r from-purple-500 via-indigo-500 to-violet-500" />
        )}
        <div className="reader-toolbar max-w-7xl mx-auto px-3 py-2 flex flex-wrap justify-between items-center gap-2">
          {/* Left: back + title */}
          <div className={`flex items-center gap-2 min-w-0 ${isRTL ? "flex-row-reverse" : ""}`}>
            <Link to={createPageUrl("Library")}>
              <Button
                variant="ghost"
                size="icon"
                className={`rounded-xl ${nightToolbar}`}
                aria-label={t('bookView.backToLibrary')}
              >
                {isRTL ? <ArrowRight className="h-5 w-5" /> : <ArrowLeft className="h-5 w-5" />}
              </Button>
            </Link>
            {book && (
              <div className={`min-w-0 ${isRTL ? "text-right" : ""}`}>
                <h1 className={`text-base font-semibold truncate leading-tight ${nightMode ? "text-amber-50" : "text-gray-900 dark:text-white"}`}>
                  {book.title}
                </h1>
                {pages.length > 0 && (
                  <select className="reader-page-picker" aria-label={t("reader.jumpToPage")} value={currentPageIndex} onChange={event => {
                    const index = Number(event.target.value);
                    setDirection(index > currentPageIndex ? 1 : -1);
                    setCurrentPageIndex(index);
                  }}>
                    {pages.map((page, index) => <option key={page.id ?? page.page_number} value={index}>
                      {page.page_number === 0 ? t("demoBookViewer.cover") : t("bookView.pageAlt", { number: index + 1 })}
                    </option>)}
                  </select>
                )}
              </div>
            )}
          </div>

          {/* Right: controls */}
          <div className="reader-tools flex flex-wrap items-center gap-0.5">
            {/* Zoom out */}
            <Button
              variant="ghost"
              size="icon"
              onClick={zoomOut}
              disabled={zoomLevel <= 0.75}
              className={`rounded-xl ${nightToolbar}`}
              aria-label={t('reader.zoomOut')}
            >
              <ZoomOut className="h-4 w-4" />
            </Button>

            {/* Zoom in */}
            <Button
              variant="ghost"
              size="icon"
              onClick={zoomIn}
              disabled={zoomLevel >= 2}
              className={`rounded-xl ${nightToolbar}`}
              aria-label={t('reader.zoomIn')}
            >
              <ZoomIn className="h-4 w-4" />
            </Button>

            {/* Night mode */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setNightMode(!nightMode)}
              className={`rounded-xl ${nightToolbar}`}
              aria-label={t('bookView.nightMode')}
            >
              {nightMode
                ? <Sun className="h-4 w-4 text-amber-400" />
                : <Moon className="h-4 w-4" />
              }
            </Button>

            {/* Fullscreen */}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleFullscreen}
              className={`rounded-xl hidden sm:flex ${nightToolbar}`}
              aria-label={t('bookView.fullscreen')}
            >
              {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
            </Button>

            {/* PDF Export */}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleExportPDF}
              disabled={isExportingPDF}
              className={`rounded-xl ${nightToolbar}`}
              aria-label={t('reader.pdfDownload')}
              title={t('reader.pdfTitle')}
            >
              {isExportingPDF
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Download className="h-4 w-4" />
              }
            </Button>

            {/* Print — Wave-13 */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => window.print()}
              className={`rounded-xl hidden sm:flex ${nightToolbar}`}
              aria-label={t('reader.print')}
              title={t('reader.print')}
            >
              <span className="text-base" aria-hidden="true">🖨️</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              className={`min-h-11 rounded-xl px-3 ${musicOn ? "border-amber-300 bg-amber-100 text-gray-900 hover:bg-amber-200 hover:text-gray-900" : nightMode ? "border-gray-600 bg-gray-900 text-amber-100 hover:bg-gray-800 hover:text-amber-50" : ""}`}
              aria-pressed={musicOn}
              onClick={() => {
                const audio = musicRef.current;
                if (!audio) return;
                if (!audio.paused) {
                  audio.pause();
                  return;
                }
                setMusicError(false);
                audio.volume = 0.25;
                void audio.play().catch(error => {
                  if (error?.name !== 'AbortError') setMusicError(true);
                });
              }}
            >
              {musicOn ? <Volume2 aria-hidden="true" /> : <VolumeX aria-hidden="true" />}
              {t('reader.music')}
            </Button>
            <audio
              ref={musicRef}
              src="https://cdn.pixabay.com/audio/2022/05/27/audio_1808fbf07a.mp3"
              preload="none"
              loop
              onPlaying={() => { setMusicOn(true); setMusicError(false); }}
              onPause={() => setMusicOn(false)}
              onError={() => { setMusicOn(false); setMusicError(true); }}
              hidden
            />
            {musicError && <p className="w-full text-sm" role="status">{t('reader.musicUnavailable')}</p>}

            {/* Edit — owner only */}
            {book && !isGuest && book.created_by === user?.id && (
              <Link to={`${createPageUrl("BookCreation")}?id=${book.id}`}>
                <Button
                  variant="outline"
                  size="sm"
                  className={`${isUnifiedBookEditor() ? "flex min-h-11" : "hidden md:flex"} items-center gap-2 rounded-xl border-purple-200 text-purple-700 hover:bg-purple-50 dark:border-purple-700 dark:text-purple-300`}
                >
                  <PenTool className="h-4 w-4" />
                  {t('bookView.editAdvanced')}
                </Button>
              </Link>
            )}

            {/* Printed-book order: only when the feature flag is on and the book is finished */}
            {isOwner && !book.printEdition && book.print_size !== 'landscape-210x170' && fullyIllustrated && <OrderBookButton bookId={book.id} />}
          </div>
        </div>

        {isOwner && (
          <div className="mx-auto flex max-w-7xl px-4">
            <Link className={`inline-flex min-h-11 items-center gap-2 rounded-xl px-2 text-sm font-semibold hover:underline focus-visible:outline focus-visible:outline-2 ${nightMode ? "text-purple-200" : "text-purple-700"}`} to={isUnifiedBookEditor() ? `${createPageUrl("BookCreation")}?id=${encodeURIComponent(book.id)}&tab=print` : printEditionUrl(book.id)}>
              <Printer aria-hidden="true" className="h-4 w-4" />{editionLabels(i18nIsRTL).title}
            </Link>
          </div>
        )}

        {/* PDF progress bar */}
        {isExportingPDF && (
          <div className="px-3 pb-1 max-w-7xl mx-auto">
            <div
              className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={pdfProgress}
              aria-label={t('bookView.exportingPdf') || 'Exporting PDF'}
            >
              <div
                className="bg-gradient-to-r from-purple-500 to-indigo-500 h-1 rounded-full transition-all duration-300"
                style={{ width: `${pdfProgress}%` }}
                aria-hidden="true"
              />
            </div>
          </div>
        )}
      </header>

      {/* Reading progress bar */}
      <div
        className="h-1 bg-gray-200 dark:bg-gray-700"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={pages.length > 1 ? pages.length - 1 : 0}
        aria-valuenow={currentPageIndex}
        aria-label={t('bookView.readingProgress') || 'Reading progress'}
      >
        <motion.div
          className="h-1 bg-gradient-to-r from-purple-500 to-indigo-500"
          initial={false}
          animate={{
            width: pages.length > 1
              ? `${(currentPageIndex / (pages.length - 1)) * 100}%`
              : "0%"
          }}
          transition={{ duration: 0.3 }}
          aria-hidden="true"
        />
      </div>

      {/* Book content */}
      <main className="flex-1 flex flex-col">
        {book && pages.length > 0 ? (
          <div className="flex-1 flex flex-col">
            {/* Book viewer */}
            <div className={`flex-1 flex flex-col items-center justify-start p-4 md:justify-center md:p-8 ${nightBg}`}>
              <div
                className="reader-desk w-full max-w-4xl"
                style={/** @type {React.CSSProperties} */ ({ "--reading-scale": zoomLevel })}
              >
                <PageFlip
                  pageKey={currentPageIndex}
                  direction={direction}
                  isRTL={isRTL}
                  onPrev={goToPreviousPage}
                  onNext={goToNextPage}
                  canGoPrev={currentPageIndex > 0}
                  canGoNext={currentPageIndex < pages.length - 1}
                >
                  <div className={`${nightCard} rounded-2xl shadow-xl overflow-hidden ring-1 ${nightMode ? "ring-gray-700" : "ring-black/5 dark:ring-white/10"} transition-colors duration-300`}>
                    {isCoverPage ? (
                      /* Cover page */
                      <div className="reader-cover relative">
                        {coverImage ? (
                          <ReaderIllustration onAvailability={failed => recordArtFailure("cover", failed)} key={coverImage}
                            src={coverImage}
                            alt={book.title}
                            className="reader-cover-art object-contain"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-purple-500 via-violet-600 to-indigo-600 flex items-center justify-center">
                            <div className={`text-center p-8 ${isRTL ? "text-right" : ""}`}>
                              <div className="text-6xl mb-4">📖</div>
                              <h2
                                className="text-3xl md:text-4xl font-bold text-white mb-4 drop-shadow-sm"
                                style={{ fontFamily: getBookFontFamily() }}
                              >
                                {book.title}
                              </h2>
                              {book.child_name && (
                                <p className="text-xl text-white/80">
                                  {t('bookView.storyFor', { name: book.child_name })}
                                </p>
                              )}
                            </div>
                          </div>
                        )}
                        {/* Cover overlay with title when image exists */}
                        {coverImage && (
                          <div className="reader-cover-title text-center p-4">
                            <h2
                              className={`text-xl md:text-2xl font-bold text-white drop-shadow-sm ${isRTL ? "text-right" : ""}`}
                              style={{ fontFamily: getBookFontFamily() }}
                            >
                              {book.title}
                            </h2>
                          </div>
                        )}
                        {currentPage?.text_content && currentPage.text_content.trim() !== book.title && (
                          <div className="reader-intro" dir="auto"><p className="reader-prose" style={{ fontFamily: getBookFontFamily() }}>{currentPage.text_content}</p></div>
                        )}
                      </div>
                    ) : (
                      <figure className="reader-leaf" data-layout={currentPage?.layout_type} dir={isHebrewBook || book.language === "yiddish" ? "rtl" : "ltr"}>
                        <div className="reader-art">
                          {currentPage?.image_url ? (
                            <ReaderIllustration onAvailability={failed => recordArtFailure(currentPage.page_number, failed)} key={currentPage.image_url} className="reader-page-art" src={currentPage.image_url} alt={t('bookView.pageAlt', { number: currentPageIndex + 1 })} />
                          ) : (
                            <p className="reader-art-pending"><BookOpen aria-hidden="true" />{t('bookView.noIllustration')}</p>
                          )}
                        </div>
                        <span className="reader-folio" aria-hidden="true">{currentPageIndex + 1}</span>
                        <figcaption>{currentPage?.text_content && <p className="reader-prose" style={{ fontFamily: getBookFontFamily() }}>{currentPage.text_content}</p>}</figcaption>
                      </figure>
                    )}
                  </div>
                </PageFlip>
              </div>
            </div>

            {/* "The End" celebration section */}
            <AnimatePresence>
              {fullyIllustrated && currentPageIndex === pages.length - 1 && pages.length > 1 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                  className={`px-4 pt-6 pb-2 text-center ${nightBg} transition-colors duration-300`}
                >
                  <div className={`max-w-2xl mx-auto rounded-2xl p-6 shadow-lg ring-1 ${
                    nightMode
                      ? "bg-gray-900 ring-gray-700"
                      : "bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 ring-purple-100 dark:ring-purple-800/30"
                  }`}>
                    <img className="reader-ending-art" src="/images/spx/characters/child_self.webp" alt="" />
                    <h3 className={`text-2xl font-bold mb-1 ${nightMode ? "text-amber-100" : "text-purple-700 dark:text-purple-300"}`}>
                      {t('bookView.finishedBook')}
                    </h3>
                    <p className={`text-sm mb-5 ${nightMode ? "text-gray-400" : "text-gray-500 dark:text-gray-400"}`}>
                      {t('reader.finished')}
                    </p>
                    <div className={`flex flex-wrap justify-center gap-3 ${isRTL ? "flex-row-reverse" : ""}`}>
                      <Button
                        variant="outline"
                        onClick={() => {
                          bookReadAwardedRef.current = false;
                          setCurrentPageIndex(0);
                          setDirection(-1);
                        }}
                        className="flex items-center gap-2 rounded-xl"
                      >
                        <BookOpen className="h-4 w-4" />
                        {t('bookView.readAgain')}
                      </Button>

                      {isGuest ? (
                        <Button
                          onClick={() => navigateToLogin()}
                          className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 flex items-center gap-2 rounded-xl shadow-md"
                        >
                          <LogIn className="h-4 w-4" />
                          {t('bookView.signInToCreate')}
                        </Button>
                      ) : (
                        <>
                          <Link to={createPageUrl("Community")}>
                            <Button variant="outline" className="flex items-center gap-2 rounded-xl">
                              <Share2 className="h-4 w-4" />
                              {t('bookView.share')}
                            </Button>
                          </Link>

                          <Link to={createPageUrl("BookWizard")}>
                            <Button className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 flex items-center gap-2 rounded-xl shadow-md">
                              <Plus className="h-4 w-4" />
                              {t('bookView.createNewBook')}
                            </Button>
                          </Link>
                        </>
                      )}
                    </div>

                    {/* Gift-edition demand gate (measurement only, no payment) */}
                    <GiftEditionCTA book={book} isGuest={isGuest} nightMode={nightMode} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

          </div>
        ) : (
          /* No book state */
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-center max-w-sm">
              <div className="text-6xl mb-4">📚</div>
              <h2 className={`text-2xl font-bold mb-4 ${nightMode ? "text-amber-50" : "text-gray-900 dark:text-white"}`}>
                {t('bookView.noBook.title')}
              </h2>
              <p className={`mb-6 ${nightMode ? "text-gray-400" : "text-gray-600 dark:text-gray-300"}`}>
                {t('bookView.noBook.description')}
              </p>
              <Link to={createPageUrl("Library")}>
                <Button className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 rounded-xl shadow-md">
                  <Home className={`h-4 w-4 ${isRTL ? "ml-2" : "mr-2"}`} />
                  {t('bookView.noBook.goToLibrary')}
                </Button>
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
