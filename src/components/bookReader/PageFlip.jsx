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

/** @param {{ pageKey: number, direction: number, isRTL: boolean, onPrev: () => void, onNext: () => void, canGoPrev?: boolean, canGoNext?: boolean, children: React.ReactNode }} props */
function PageFlip({
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
  const canGoLeft = prevOnRight ? canGoNext : canGoPrev;
  const canGoRight = prevOnRight ? canGoPrev : canGoNext;

  return (
    <div className="relative" style={{ perspective: "1200px" }}>
      {reduceMotion ? <div key={pageKey}>{children}</div> : (
        <AnimatePresence mode="wait" custom={effectiveDirection}>
          <motion.div
            key={pageKey}
            custom={effectiveDirection}
            variants={flipVariants}
            initial="enter"
            animate="center"
            exit="exit"
            style={{ transformStyle: "preserve-3d" }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      )}

      {/* Touch-target navigation buttons overlaid on the page edges */}
      {(onPrev || onNext) && (
        <>
          {/* Left edge button */}
          <button
            type="button"
            onClick={canGoLeft ? (prevOnRight ? onNext : onPrev) : undefined}
            aria-disabled={!canGoLeft}
            aria-label={prevOnRight ? t("bookView.navigation.next") : t("bookView.navigation.previous")}
            title={prevOnRight ? t("bookView.navigation.next") : t("bookView.navigation.previous")}
            className={[
              "reader-turn reader-turn-left absolute top-1/2 -translate-y-1/2",
              "flex items-center justify-center",
              "rounded-full bg-[#2b1b43] shadow-md text-[#fff4df]",
              "motion-safe:transition-colors hover:bg-[#4b2f73]",
              "aria-disabled:opacity-30",
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-purple-500",
              "z-10"
            ].join(" ")}
          >
            <ChevronLeft className="h-7 w-7" aria-hidden="true" />
          </button>

          {/* Right edge button */}
          <button
            type="button"
            onClick={canGoRight ? (prevOnRight ? onPrev : onNext) : undefined}
            aria-disabled={!canGoRight}
            aria-label={prevOnRight ? t("bookView.navigation.previous") : t("bookView.navigation.next")}
            title={prevOnRight ? t("bookView.navigation.previous") : t("bookView.navigation.next")}
            className={[
              "reader-turn reader-turn-right absolute top-1/2 -translate-y-1/2",
              "flex items-center justify-center",
              "rounded-full bg-[#2b1b43] shadow-md text-[#fff4df]",
              "motion-safe:transition-colors hover:bg-[#4b2f73]",
              "aria-disabled:opacity-30",
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-purple-500",
              "z-10"
            ].join(" ")}
          >
            <ChevronRight className="h-7 w-7" aria-hidden="true" />
          </button>
        </>
      )}
    </div>
  );
}

export default React.memo(PageFlip);
