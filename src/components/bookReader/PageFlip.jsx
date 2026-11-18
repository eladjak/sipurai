import React from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useI18n } from "@/components/i18n/i18nProvider";

/**
 * PageFlip - Animated page transition component with 3D flip effect.
 * Wraps page content and animates transitions between pages.
 *
 * Props:
 *   pageKey    — unique key for the current page (triggers animation)
 *   direction  — animation direction (+1 forward, -1 backward)
 *   isRTL      — whether the layout is right-to-left
 *   onPrev     — callback for previous page (shows left touch button)
 *   onNext     — callback for next page (shows right touch button)
 *   canGoPrev  — whether previous navigation is available
 *   canGoNext  — whether next navigation is available
 *   children   — page content
 */
const flipVariants = {
  enter: (direction) => ({
    rotateY: direction > 0 ? 90 : -90,
    opacity: 0,
    scale: 0.95
  }),
  center: {
    rotateY: 0,
    opacity: 1,
    scale: 1,
    transition: {
      rotateY: { type: "spring", stiffness: 200, damping: 30 },
      opacity: { duration: 0.2 },
      scale: { duration: 0.2 }
    }
  },
  exit: (direction) => ({
    rotateY: direction < 0 ? 90 : -90,
    opacity: 0,
    scale: 0.95,
    transition: {
      rotateY: { type: "spring", stiffness: 200, damping: 30 },
      opacity: { duration: 0.2 },
      scale: { duration: 0.2 }
    }
  })
};

const PageFlip = React.memo(function PageFlip({
  pageKey,
  direction,
  isRTL,
  onPrev,
  onNext,
  canGoPrev = true,
  canGoNext = true,
  children
}) {
  const { t } = useI18n();
  const reduceMotion = useReducedMotion();

  // RTL flips direction
  const effectiveDirection = isRTL ? -direction : direction;

  // In RTL: "previous" is on the right, "next" is on the left
  const prevOnRight = isRTL;

  return (
    <div className="relative" style={{ perspective: "1200px" }}>
      <AnimatePresence mode="wait" custom={effectiveDirection}>
        <motion.div
          key={pageKey}
          custom={effectiveDirection}
          variants={reduceMotion ? undefined : flipVariants}
          initial={reduceMotion ? false : "enter"}
          animate="center"
          exit={reduceMotion ? undefined : "exit"}
          style={{ transformStyle: "preserve-3d" }}
        >
          {children}
        </motion.div>
      </AnimatePresence>

      {/* Touch-target navigation buttons overlaid on the page edges */}
      {(onPrev || onNext) && (
        <>
          {/* Left edge button */}
          <button
            type="button"
            onClick={prevOnRight ? onNext : onPrev}
            disabled={prevOnRight ? !canGoNext : !canGoPrev}
            aria-label={prevOnRight ? t("bookView.navigation.next") : t("bookView.navigation.previous")}
            className={[
              "absolute top-1/2 -translate-y-1/2 -left-5",
              "flex items-center justify-center",
              "min-w-[44px] min-h-[44px] w-11 h-11",
              "rounded-full bg-white/80 dark:bg-gray-800/80 shadow-md",
              "text-gray-700 dark:text-gray-200",
              "transition-opacity duration-150 hover:bg-white dark:hover:bg-gray-700",
              "disabled:opacity-30 disabled:pointer-events-none",
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-purple-500",
              "z-10"
            ].join(" ")}
          >
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </button>

          {/* Right edge button */}
          <button
            type="button"
            onClick={prevOnRight ? onPrev : onNext}
            disabled={prevOnRight ? !canGoPrev : !canGoNext}
            aria-label={prevOnRight ? t("bookView.navigation.previous") : t("bookView.navigation.next")}
            className={[
              "absolute top-1/2 -translate-y-1/2 -right-5",
              "flex items-center justify-center",
              "min-w-[44px] min-h-[44px] w-11 h-11",
              "rounded-full bg-white/80 dark:bg-gray-800/80 shadow-md",
              "text-gray-700 dark:text-gray-200",
              "transition-opacity duration-150 hover:bg-white dark:hover:bg-gray-700",
              "disabled:opacity-30 disabled:pointer-events-none",
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-purple-500",
              "z-10"
            ].join(" ")}
          >
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </button>
        </>
      )}
    </div>
  );
});

export default PageFlip;
