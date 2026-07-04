import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, ChevronLeft, X, BookOpen, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { useI18n } from '@/components/i18n/i18nProvider';

const artStyleLabels = {
  watercolor: 'צבעי מים',
  pixar: 'פיקסר תלת-ממד',
  storybook: 'ספר סיפורים קלאסי',
};

const genreLabels = {
  fantasy: { he: 'פנטזיה', en: 'Fantasy' },
  'science-fiction': { he: 'מדע בדיוני', en: 'Sci-Fi' },
  adventure: { he: 'הרפתקאות', en: 'Adventure' },
};

const pageVariants = {
  enter: (direction) => ({
    x: direction > 0 ? 300 : -300,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction) => ({
    x: direction > 0 ? -300 : 300,
    opacity: 0,
  }),
};

const DemoBookViewer = ({ book, open, onClose }) => {
  const { t, isRTL, language } = useI18n();
  const [currentPage, setCurrentPage] = useState(-1); // -1 = cover
  const [direction, setDirection] = useState(0);

  const totalPages = book?.pages?.length || 0;

  const goToNext = useCallback(() => {
    if (currentPage < totalPages - 1) {
      setDirection(1);
      setCurrentPage((prev) => prev + 1);
    }
  }, [currentPage, totalPages]);

  const goToPrev = useCallback(() => {
    if (currentPage > -1) {
      setDirection(-1);
      setCurrentPage((prev) => prev - 1);
    }
  }, [currentPage]);

  const handleClose = useCallback(() => {
    setCurrentPage(-1);
    setDirection(0);
    onClose();
  }, [onClose]);

  if (!book) return null;

  const isOnCover = currentPage === -1;
  const isOnLastPage = currentPage === totalPages - 1;
  const page = !isOnCover ? book.pages[currentPage] : null;

  return (
    <Dialog open={open} onOpenChange={(val) => !val && handleClose()}>
      <DialogContent
        className="max-w-2xl w-[95vw] max-h-[90dvh] p-0 overflow-hidden bg-white dark:bg-gray-900 border-0 rounded-2xl"
        dir={isRTL ? "rtl" : "ltr"}
      >
        <DialogTitle className="sr-only">{language === 'en' ? book.title.en : book.title.he}</DialogTitle>

        {/* Top bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-800/80 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-purple-500" />
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 truncate max-w-[200px]">
              {language === 'en' ? book.title.en : book.title.he}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400">
              {isOnCover
                ? t('demoBookViewer.cover')
                : t('demoBookViewer.pageOf', { current: String(currentPage + 1), total: String(totalPages) })}
            </span>
            <button
              onClick={handleClose}
              className="rounded-full p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              aria-label={t('demoBookViewer.close')}
            >
              <X className="h-4 w-4 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Page content area */}
        <div className="relative overflow-hidden" style={{ minHeight: '400px' }}>
          <AnimatePresence mode="wait" custom={direction}>
            {isOnCover ? (
              <motion.div
                key="cover"
                custom={direction}
                variants={pageVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.2, ease: 'easeInOut' }}
                className="flex flex-col items-center justify-center p-8 text-center"
              >
                {/* Cover illustration area — real artwork when available,
                    gradient fallback otherwise. Title is a UI overlay (never
                    baked into the image). */}
                {book.cover_image ? (
                  <div className="w-full max-w-sm aspect-[3/4] rounded-2xl mb-6 shadow-xl relative overflow-hidden">
                    <img
                      src={book.cover_image}
                      alt={language === 'en' ? book.title.en : book.title.he}
                      className="absolute inset-0 w-full h-full object-cover"
                      loading="lazy"
                    />
                    <div className="absolute inset-x-0 top-0 pt-5 pb-10 px-4 bg-gradient-to-b from-black/55 via-black/25 to-transparent text-center">
                      <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-1 leading-tight drop-shadow">
                        {book.title.he}
                      </h2>
                      <p className="text-white/85 text-sm drop-shadow">{book.title.en}</p>
                    </div>
                  </div>
                ) : (
                  <div
                    className={`w-full max-w-sm aspect-[3/4] rounded-2xl bg-gradient-to-br ${book.cover_gradient} flex flex-col items-center justify-center p-8 mb-6 shadow-xl`}
                  >
                    <Sparkles className="h-12 w-12 text-white/80 mb-4" />
                    <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-2 leading-tight">
                      {book.title.he}
                    </h2>
                    <p className="text-white/80 text-sm">{book.title.en}</p>
                  </div>
                )}

                {/* Book metadata */}
                <div className="flex flex-wrap gap-2 justify-center mb-4">
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                    {(language === 'en' ? genreLabels[book.genre]?.en : genreLabels[book.genre]?.he) || book.genre}
                  </span>
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300">
                    {artStyleLabels[book.art_style] || book.art_style}
                  </span>
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                    {t('demoBookViewer.ageRange', { range: book.age_range })}
                  </span>
                </div>

                <p className="text-sm text-gray-500 dark:text-gray-400 italic mb-2">
                  "{book.moral}"
                </p>

                <Button
                  onClick={goToNext}
                  className="mt-4 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white"
                >
                  <BookOpen className="h-4 w-4" />
                  {t('demoBookViewer.startReading')}
                </Button>
              </motion.div>
            ) : (
              <motion.div
                key={`page-${currentPage}`}
                custom={direction}
                variants={pageVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.2, ease: 'easeInOut' }}
                className="flex flex-col p-6 sm:p-8"
              >
                {/* Page illustration — real artwork when available */}
                {page.image ? (
                  <div className="w-full aspect-[4/3] sm:aspect-[16/10] rounded-xl mb-6 relative overflow-hidden shadow-md">
                    <img
                      src={page.image}
                      alt={t('demoBookViewer.pageIllustration', { page: currentPage + 1 }) || `איור עמוד ${currentPage + 1}`}
                      className="absolute inset-0 w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>
                ) : (
                  <div
                    className={`w-full aspect-[16/9] rounded-xl bg-gradient-to-br ${book.cover_gradient} opacity-20 flex items-center justify-center mb-6 relative overflow-hidden`}
                  >
                    <div className="absolute inset-0 flex items-center justify-center p-4">
                      <p className="text-center text-xs text-gray-600 dark:text-gray-400 opacity-70 max-w-md leading-relaxed">
                        {page.imagePrompt}
                      </p>
                    </div>
                  </div>
                )}

                {/* Story text */}
                <div className="flex-1">
                  <p className="text-lg sm:text-xl leading-relaxed text-gray-800 dark:text-gray-200 font-medium">
                    {language === 'en' && page.textEn ? page.textEn : page.text}
                  </p>
                </div>

                {/* Page number */}
                <div className="flex justify-center mt-6">
                  <span className="text-xs text-gray-400 font-medium">
                    - {currentPage + 1} -
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Navigation bar */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-800/80">
          <Button
            variant="ghost"
            size="sm"
            onClick={goToNext}
            disabled={isOnLastPage}
            className="flex items-center gap-1"
          >
            <ChevronRight className="h-4 w-4" />
            {isOnLastPage ? t('demoBookViewer.end') : t('demoBookViewer.next')}
          </Button>

          {/* Progress dots */}
          <div className="flex gap-1.5 items-center">
            <button
              onClick={() => {
                setDirection(-1);
                setCurrentPage(-1);
              }}
              className={`w-2.5 h-2.5 rounded-full transition-colors ${
                isOnCover
                  ? 'bg-purple-500'
                  : 'bg-gray-300 dark:bg-gray-600 hover:bg-gray-400'
              }`}
              aria-label={t('demoBookViewer.coverAriaLabel')}
            />
            {book.pages.map((_, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setDirection(idx > currentPage ? 1 : -1);
                  setCurrentPage(idx);
                }}
                className={`w-2 h-2 rounded-full transition-colors ${
                  currentPage === idx
                    ? 'bg-purple-500'
                    : 'bg-gray-300 dark:bg-gray-600 hover:bg-gray-400'
                }`}
                aria-label={t('demoBookViewer.pageAriaLabel', { number: String(idx + 1) })}
              />
            ))}
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={goToPrev}
            disabled={isOnCover}
            className="flex items-center gap-1"
          >
            {isOnCover ? t('demoBookViewer.cover') : t('demoBookViewer.previous')}
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DemoBookViewer;
