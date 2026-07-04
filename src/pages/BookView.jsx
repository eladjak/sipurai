import React, { useState, useEffect, useCallback, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Book } from "@/entities/Book";
import { Page } from "@/entities/Page";
import { PublicBook, PublicPage } from "@/entities/PublicBook";
import { createPageUrl } from "@/utils";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useI18n } from "@/components/i18n/i18nProvider";
import {
  ArrowLeft,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
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
  BookOpen,
  Share2,
  Plus,
  LogIn,
  Volume2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import PageFlip from "@/components/bookReader/PageFlip";
import TTSControls, { getStoredTTSEngine } from "@/components/bookReader/TTSControls";
import GiftEditionCTA from "@/components/bookReader/GiftEditionCTA";
import { useTTS } from "@/hooks/useTTS";
import { exportBookToPDF } from "@/utils/pdfExporter";
import useGamification from "@/hooks/useGamification";
import { updateMeta, resetMeta } from "@/lib/seo";
import { useAuth } from "@/lib/AuthContext";
import { motion, AnimatePresence } from "framer-motion";

// canvas-confetti loaded on-demand (keeps BookView out of the confetti chunk on initial load)
let _confettiMod = null;
const loadConfetti = () => {
  if (!_confettiMod) _confettiMod = import("canvas-confetti").then((m) => m.default);
  return _confettiMod;
};

export default function BookView() {
  const { t, language: i18nLanguage, isRTL: i18nIsRTL } = useI18n();
  const { user } = useCurrentUser();
  const { navigateToLogin } = useAuth();
  const [searchParams] = useSearchParams();
  const [book, setBook] = useState(null);
  const [pages, setPages] = useState([]);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
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
  const musicRef = useRef(null);

  const { toast } = useToast();
  const containerRef = useRef(null);
  const touchStartRef = useRef(null);
  const bookReadAwardedRef = useRef(false);

  const gamification = useGamification();
  const bookId = searchParams.get("id");

  const isRTL = currentLanguage === "hebrew" || currentLanguage === "yiddish";
  const isHebrew = currentLanguage === "hebrew";
  const isHebrewBook = currentLanguage === "hebrew" || currentLanguage === "yiddish";
  const isGuest = !user;

  const tts = useTTS({ language: currentLanguage, engine: getStoredTTSEngine() });

  useEffect(() => {
    if (!bookId) {
      setLoading(false);
    }
  }, [bookId]);

  useEffect(() => {
    if (!bookId) return;

    const loadBook = async () => {
      try {
        setLoading(true);
        const lang = user?.language || i18nLanguage || "english";
        setCurrentLanguage(lang);

        // Owner reads the full book (RLS scopes the base tables to the owner).
        // Guests / non-owners cannot read the base books/pages tables (they
        // carry child PII and anon has no grant) — fall back to the sanitized,
        // PII-free public views (public_books / public_pages), which only return
        // rows where is_public = true. See entities/PublicBook.js + migration
        // 2026-05-25-public-pii-safe-views.sql.
        let bookData;
        let pagesData;
        try {
          [bookData, pagesData] = await Promise.all([
            Book.get(bookId),
            Page.filter({ book_id: bookId }, "page_number")
          ]);
        } catch {
          [bookData, pagesData] = await Promise.all([
            PublicBook.get(bookId),
            PublicPage.filter({ book_id: bookId }, "page_number")
          ]);
        }

        setBook(bookData);
        setPages(pagesData);

        const savedPage = localStorage.getItem(`book_${bookId}_page`);
        if (savedPage) {
          const pageIdx = parseInt(savedPage, 10);
          if (pageIdx >= 0 && pageIdx < pagesData.length) {
            setCurrentPageIndex(pageIdx);
          }
        }

        if (bookData.language) {
          setCurrentLanguage(bookData.language);
        }

        updateMeta({
          title: bookData.title,
          description: bookData.description || t("bookView.defaultDescription"),
          image: bookData.cover_image,
          type: 'article',
        });
      } catch {
        toast({
          variant: "destructive",
          description: t('bookView.loadError'),
        });
      } finally {
        setLoading(false);
      }
    };

    loadBook();
  }, [bookId]);

  useEffect(() => {
    return () => resetMeta();
  }, []);

  useEffect(() => {
    if (bookId && pages.length > 0) {
      localStorage.setItem(`book_${bookId}_page`, String(currentPageIndex));
    }
  }, [bookId, currentPageIndex, pages.length]);

  useEffect(() => {
    tts.stop();
  }, [currentPageIndex]);

  // Wave-12: Auto-play TTS when user toggles "auto-narrate" via localStorage flag.
  // Stays opt-in (UI control wires this); page change triggers next chunk.
  useEffect(() => {
    let cancelled = false;
    const autoNarrate = (() => {
      try { return window.localStorage?.getItem("sipurai_tts_auto") === "1"; }
      catch { return false; }
    })();
    if (!autoNarrate) return;
    const text = currentPageIndex === 0
      ? `${book?.title || ""}. ${book?.description || ""}`
      : pages[currentPageIndex]?.text_content;
    if (!text) return;
    const timer = setTimeout(() => {
      if (!cancelled) tts.speak(text);
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [currentPageIndex, book?.title, book?.description, pages, tts]);

  useEffect(() => {
    if (
      !isGuest &&
      pages.length > 1 &&
      currentPageIndex === pages.length - 1 &&
      !bookReadAwardedRef.current
    ) {
      bookReadAwardedRef.current = true;
      gamification.awardXP("book_read");

      const duration = 2500;
      const end = Date.now() + duration;
      loadConfetti().then((confetti) => {
        const celebrate = () => {
          confetti({
            particleCount: 4,
            angle: 60,
            spread: 60,
            origin: { x: 0, y: 0.7 },
            colors: ["#9333ea", "#f59e0b", "#10b981", "#6366f1"]
          });
          confetti({
            particleCount: 4,
            angle: 120,
            spread: 60,
            origin: { x: 1, y: 0.7 },
            colors: ["#9333ea", "#f59e0b", "#10b981", "#6366f1"]
          });
          if (Date.now() < end) {
            requestAnimationFrame(celebrate);
          }
        };
        celebrate();
      });
    }
  }, [currentPageIndex, pages.length, isGuest]);

  const currentPage = pages[currentPageIndex];

  const goToNextPage = useCallback(() => {
    if (currentPageIndex < pages.length - 1) {
      setDirection(1);
      setCurrentPageIndex((prev) => prev + 1);
    }
  }, [currentPageIndex, pages.length]);

  const goToPreviousPage = useCallback(() => {
    if (currentPageIndex > 0) {
      setDirection(-1);
      setCurrentPageIndex((prev) => prev - 1);
    }
  }, [currentPageIndex]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;

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

  const handleTTSPlay = () => {
    const text = currentPage?.text_content;
    if (text) tts.speak(text);
  };

  // Page layout helper
  const getPageLayoutStyle = (layoutType) => {
    switch (layoutType) {
      case "text_top": return "flex-col";
      case "text_bottom": return "flex-col-reverse";
      case "text_left": return "flex-row";
      case "text_right": return "flex-row-reverse";
      case "standard": return "flex-col";
      case "image_top": return "flex-col-reverse";
      case "image_full": return "relative";
      case "text_overlay": return "relative";
      case "two_column": return "flex-row";
      default: return "flex-col";
    }
  };

  // Map art styles to child-friendly font families
  const getBookFontFamily = () => {
    const style = book?.art_style;
    // For Hebrew books, use Fredoka (playful, supports Hebrew) for all styles
    // For English, vary by art style
    if (isHebrewBook) {
      return "'Fredoka', 'Nunito', sans-serif";
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

  // Render text with word highlighting for TTS + child-friendly fonts
  const renderHighlightedText = (text, extraClass = "") => {
    if (!text) return null;

    const bookFontStyle = { fontFamily: getBookFontFamily() };

    if (!tts.isSpeaking || tts.currentWordIndex < 0) {
      return (
        <p
          className={`text-xl md:text-2xl leading-loose ${isRTL ? "text-right" : ""} ${extraClass}`}
          style={bookFontStyle}
        >
          {text}
        </p>
      );
    }

    const words = text.split(/(\s+)/);
    let wordIdx = 0;

    return (
      <p
        className={`text-xl md:text-2xl leading-loose ${isRTL ? "text-right" : ""} ${extraClass}`}
        style={bookFontStyle}
      >
        {words.map((segment, i) => {
          if (/^\s+$/.test(segment)) return segment;

          const isHighlighted = wordIdx === tts.currentWordIndex;
          wordIdx++;

          return (
            <span
              key={i}
              className={isHighlighted
                ? "bg-yellow-200 dark:bg-yellow-700 rounded px-0.5 transition-colors duration-100"
                : "transition-colors duration-100"
              }
            >
              {segment}
            </span>
          );
        })}
      </p>
    );
  };

  // Night mode color helpers — consistent throughout
  const nightBg       = nightMode ? "bg-gray-950" : "bg-gray-100 dark:bg-gray-900";
  const nightCard     = nightMode ? "bg-gray-900 text-amber-50" : "bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200";
  const nightHeader   = nightMode ? "bg-gray-900/95 border-gray-800" : "bg-white/95 dark:bg-gray-900/95 border-gray-200 dark:border-gray-700";
  const nightNav      = nightMode ? "bg-gray-900 border-gray-800" : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700";
  const nightToolbar  = nightMode ? "text-amber-100 hover:bg-gray-800" : "";

  // Whether TTS should show — cover page included now
  const hasTTSContent = !!currentPage?.text_content || currentPageIndex === 0;
  const ttsText = currentPageIndex === 0
    ? book?.title
    : currentPage?.text_content;

  const handleTTSPlayCover = () => {
    if (ttsText) tts.speak(ttsText);
  };

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

  // No book found after loading — show error state
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
      className={`min-h-dvh flex flex-col ${nightBg} transition-colors duration-300`}
      dir={isRTL ? "rtl" : "ltr"}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Guest sign-in banner */}
      {isGuest && book && (
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-4 py-2 flex items-center justify-between gap-3 text-sm">
          <span className={isRTL ? "text-right" : ""}>
            {t('bookView.guestBanner')}
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

      {/* Gradient header matching app design */}
      <header className={`sticky top-0 z-30 backdrop-blur-sm border-b transition-colors duration-300 ${nightHeader} shadow-sm`}>
        {/* Subtle gradient strip at very top */}
        {!nightMode && (
          <div className="h-0.5 bg-gradient-to-r from-purple-500 via-indigo-500 to-violet-500" />
        )}
        <div className="max-w-7xl mx-auto px-3 py-2 flex justify-between items-center gap-2">
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
                  <p className={`text-xs ${nightMode ? "text-gray-400" : "text-purple-600 dark:text-purple-400"}`}>
                    {t('bookView.pageOf', { current: currentPageIndex, total: pages.length })}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Right: controls */}
          <div className={`flex items-center gap-0.5 shrink-0 ${isRTL ? "flex-row-reverse" : ""}`}>
            {/* TTS Controls — show on ALL pages including cover */}
            {(currentPageIndex === 0 ? book?.title : currentPage?.text_content) && (
              <TTSControls
                isSpeaking={tts.isSpeaking}
                isPaused={tts.isPaused}
                rate={tts.rate}
                onPlay={currentPageIndex === 0 ? handleTTSPlayCover : handleTTSPlay}
                onPause={tts.pause}
                onResume={tts.resume}
                onStop={tts.stop}
                onRateChange={tts.setRate}
                isRTL={isRTL}
                isHebrew={isHebrew}
              />
            )}

            {/* Zoom out */}
            <Button
              variant="ghost"
              size="icon"
              onClick={zoomOut}
              disabled={zoomLevel <= 0.75}
              className={`rounded-xl hidden sm:flex ${nightToolbar}`}
              aria-label="Zoom out"
            >
              <ZoomOut className="h-4 w-4" />
            </Button>

            {/* Zoom in */}
            <Button
              variant="ghost"
              size="icon"
              onClick={zoomIn}
              disabled={zoomLevel >= 2}
              className={`rounded-xl hidden sm:flex ${nightToolbar}`}
              aria-label="Zoom in"
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
              aria-label={t('bookView.downloadPdf')}
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
              aria-label="הדפס"
              title="הדפס"
            >
              <span className="text-base" aria-hidden="true">🖨️</span>
            </Button>

            {/* Background music toggle — Wave-14 */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                const next = !musicOn;
                setMusicOn(next);
                const el = musicRef.current;
                if (!el) return;
                if (next) {
                  el.volume = 0.25;
                  el.loop = true;
                  el.play().catch(() => { /* user gesture required, will retry on next click */ });
                } else {
                  el.pause();
                }
              }}
              className={`rounded-xl hidden sm:flex ${nightToolbar}`}
              aria-label={musicOn ? "כבה מוזיקת רקע" : "הפעל מוזיקת רקע"}
              title={musicOn ? "כבה מוזיקת רקע" : "הפעל מוזיקת רקע"}
            >
              <span className="text-base" aria-hidden="true">{musicOn ? "🎵" : "🔈"}</span>
            </Button>

            {/* Hidden audio element — uses a free royalty-free lullaby track from public domain CDN */}
            <audio
              ref={musicRef}
              src="https://cdn.pixabay.com/audio/2022/05/27/audio_1808fbf07a.mp3"
              preload="none"
              style={{ display: "none" }}
            />

            {/* Edit — owner only */}
            {book && !isGuest && book.created_by === user?.id && (
              <Link to={`${createPageUrl("BookCreation")}?id=${book.id}`}>
                <Button
                  variant="outline"
                  size="sm"
                  className={`hidden md:flex items-center gap-2 rounded-xl border-purple-200 text-purple-700 hover:bg-purple-50 dark:border-purple-700 dark:text-purple-300`}
                >
                  <PenTool className="h-4 w-4" />
                  {t('bookView.editAdvanced')}
                </Button>
              </Link>
            )}
          </div>
        </div>

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
            <div className={`flex-1 flex flex-col items-center justify-center p-4 md:p-8 ${nightBg}`}>
              <div
                className="w-full max-w-4xl"
                style={{ transform: `scale(${zoomLevel})`, transformOrigin: "top center", transition: "transform 0.2s ease" }}
              >
                <PageFlip
                  pageKey={currentPageIndex}
                  direction={direction}
                  isRTL={isRTL}
                >
                  <div className={`${nightCard} rounded-2xl shadow-xl overflow-hidden ring-1 ${nightMode ? "ring-gray-700" : "ring-black/5 dark:ring-white/10"} transition-colors duration-300`}>
                    {currentPageIndex === 0 ? (
                      /* Cover page */
                      <div className="aspect-video md:aspect-[3/2] relative overflow-hidden">
                        {book.cover_image ? (
                          <img
                            src={book.cover_image}
                            alt={book.title}
                            className="w-full h-full object-cover"
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
                        {book.cover_image && (
                          <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/60 to-transparent">
                            <h2
                              className={`text-xl md:text-2xl font-bold text-white drop-shadow-sm ${isRTL ? "text-right" : ""}`}
                              style={{ fontFamily: getBookFontFamily() }}
                            >
                              {book.title}
                            </h2>
                          </div>
                        )}
                      </div>
                    ) : (
                      /* Regular page */
                      <div className={`min-h-[60vh] flex ${getPageLayoutStyle(currentPage?.layout_type)}`}>
                        {currentPage?.layout_type === "image_full" ? (
                          <>
                            {currentPage?.image_url ? (
                              <img
                                src={currentPage.image_url}
                                alt={t('bookView.pageAlt', { number: currentPageIndex })}
                                className="absolute inset-0 w-full h-full object-cover cursor-zoom-in"
                                onClick={zoomIn}
                              />
                            ) : null}
                            <div className="absolute bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-black/75 via-black/40 to-transparent">
                              <div className="text-white">
                                {renderHighlightedText(currentPage?.text_content)}
                              </div>
                            </div>
                          </>
                        ) : currentPage?.layout_type === "text_overlay" ? (
                          <>
                            {currentPage?.image_url ? (
                              <img
                                src={currentPage.image_url}
                                alt={t('bookView.pageAlt', { number: currentPageIndex })}
                                className="absolute inset-0 w-full h-full object-cover cursor-zoom-in"
                                onClick={zoomIn}
                              />
                            ) : null}
                            <div className={`absolute inset-x-4 bottom-4 top-auto p-5 rounded-2xl bg-white/90 dark:bg-gray-900/90 backdrop-blur-md shadow-xl ${isRTL ? "text-right" : ""}`}>
                              {renderHighlightedText(currentPage?.text_content)}
                            </div>
                          </>
                        ) : (
                          /* Standard, image_top, two_column */
                          <>
                            <div className={`p-6 md:p-8 flex-1 flex items-center ${isRTL ? "justify-end" : ""}`}>
                              <div className={`max-w-prose ${isRTL ? "text-right w-full" : ""}`}>
                                {renderHighlightedText(currentPage?.text_content)}
                              </div>
                            </div>

                            <div className={`flex-1 ${nightMode ? "bg-gray-800" : "bg-gray-50 dark:bg-gray-700"}`}>
                              {currentPage?.image_url ? (
                                <img
                                  src={currentPage.image_url}
                                  alt={t('bookView.pageAlt', { number: currentPageIndex })}
                                  className="w-full h-full object-cover cursor-zoom-in"
                                  onClick={zoomIn}
                                />
                              ) : (
                                <div className="w-full h-full min-h-[200px] flex items-center justify-center bg-gradient-to-br from-purple-50 via-indigo-50 to-violet-50 dark:from-purple-900/20 dark:via-indigo-900/20 dark:to-violet-900/20">
                                  <div className="text-center p-6">
                                    <div className="text-5xl mb-3 opacity-50">🎨</div>
                                    <p className="text-gray-400 text-sm">
                                      {t('bookView.noIllustration')}
                                    </p>
                                  </div>
                                </div>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </PageFlip>
              </div>
            </div>

            {/* "The End" celebration section */}
            <AnimatePresence>
              {currentPageIndex === pages.length - 1 && pages.length > 1 && (
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
                    <div className="text-4xl mb-2">🎉</div>
                    <h3 className={`text-2xl font-bold mb-1 ${nightMode ? "text-amber-100" : "text-purple-700 dark:text-purple-300"}`}>
                      {t('bookView.finishedBook')}
                    </h3>
                    <p className={`text-sm mb-5 ${nightMode ? "text-gray-400" : "text-gray-500 dark:text-gray-400"}`}>
                      {isGuest
                        ? t('bookView.finishedGuestPrompt')
                        : t('bookView.finishedXpEarned')
                      }
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

            {/* Navigation controls */}
            <div className={`p-3 md:p-4 border-t ${nightNav} transition-colors duration-300`}>
              <div className={`max-w-4xl mx-auto flex justify-between items-center gap-2 ${isRTL ? "flex-row-reverse" : ""}`}>
                <Button
                  variant="outline"
                  onClick={goToPreviousPage}
                  disabled={currentPageIndex === 0}
                  className={`flex items-center gap-2 rounded-xl ${nightMode ? "border-gray-700 text-amber-50 hover:bg-gray-800" : ""}`}
                  aria-label={t('bookView.previous')}
                >
                  {isRTL ? (
                    <>
                      {t('bookView.previous')}
                      <ChevronRight className="h-4 w-4" aria-hidden="true" />
                    </>
                  ) : (
                    <>
                      <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                      {t('bookView.previous')}
                    </>
                  )}
                </Button>

                {/* Page counter dots */}
                <div className="flex items-center gap-1.5 overflow-hidden">
                  {pages.length <= 12 ? (
                    pages.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          setDirection(idx > currentPageIndex ? 1 : -1);
                          setCurrentPageIndex(idx);
                        }}
                        aria-label={`${t('bookView.pageOf', { current: idx, total: pages.length })}`}
                        className={`rounded-full transition-all duration-200 focus-visible:outline-2 focus-visible:outline-purple-500 ${
                          idx === currentPageIndex
                            ? "w-5 h-2 bg-purple-600"
                            : `w-2 h-2 ${nightMode ? "bg-gray-600 hover:bg-gray-500" : "bg-gray-300 dark:bg-gray-600 hover:bg-purple-400"}`
                        }`}
                      />
                    ))
                  ) : (
                    <span className={`text-sm tabular-nums ${nightMode ? "text-gray-400" : "text-gray-500 dark:text-gray-400"}`}>
                      {t('bookView.pageOf', { current: currentPageIndex + 1, total: pages.length })}
                    </span>
                  )}
                </div>

                <Button
                  onClick={goToNextPage}
                  disabled={currentPageIndex === pages.length - 1}
                  className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 flex items-center gap-2 rounded-xl shadow-sm"
                  aria-label={t('bookView.next')}
                >
                  {isRTL ? (
                    <>
                      <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                      {t('bookView.next')}
                    </>
                  ) : (
                    <>
                      {t('bookView.next')}
                      <ChevronRight className="h-4 w-4" aria-hidden="true" />
                    </>
                  )}
                </Button>
              </div>
            </div>
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
