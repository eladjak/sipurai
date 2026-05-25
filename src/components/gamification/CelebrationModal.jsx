import { useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Award, Star, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/i18n/i18nProvider";
// canvas-confetti is loaded on-demand to keep the initial JS bundle smaller.
// It's only used when a celebration modal is shown (rare event).
let confettiPromise = null;
const loadConfetti = () => {
  if (!confettiPromise) {
    confettiPromise = import("canvas-confetti").then((m) => m.default);
  }
  return confettiPromise;
};

/**
 * CelebrationModal - Shows level-up and badge unlock celebrations
 * with confetti animation.
 */
export default function CelebrationModal({
  celebration,
  onDismiss,
  isRTL = false
}) {
  const { t, language } = useI18n();
  const hasFireRef = useRef(false);
  const modalRef = useRef(null);

  const isHebrew = language === "hebrew";
  const isYiddish = language === "yiddish";

  // Focus trap: keep focus inside modal while open
  const handleKeyDown = useCallback((e) => {
    if (!modalRef.current) return;

    if (e.key === "Escape") {
      onDismiss();
      return;
    }

    if (e.key !== "Tab") return;

    const focusable = modalRef.current.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstFocusable = focusable[0];
    const lastFocusable = focusable[focusable.length - 1];

    if (e.shiftKey) {
      if (document.activeElement === firstFocusable) {
        e.preventDefault();
        lastFocusable?.focus();
      }
    } else {
      if (document.activeElement === lastFocusable) {
        e.preventDefault();
        firstFocusable?.focus();
      }
    }
  }, [onDismiss]);

  useEffect(() => {
    if (!celebration) return;
    document.addEventListener("keydown", handleKeyDown);
    // Move focus into modal
    const timer = setTimeout(() => {
      const firstBtn = modalRef.current?.querySelector("button");
      firstBtn?.focus();
    }, 100);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      clearTimeout(timer);
    };
  }, [celebration, handleKeyDown]);

  useEffect(() => {
    if (!celebration || hasFireRef.current) return;
    hasFireRef.current = true;

    // Fire confetti — load the library dynamically so it stays out of the main bundle
    const duration = 2000;
    const end = Date.now() + duration;

    loadConfetti().then((confetti) => {
      const frame = () => {
        confetti({
          particleCount: 3,
          angle: 60,
          spread: 55,
          origin: { x: 0, y: 0.6 },
          colors: ["#9333ea", "#6366f1", "#f59e0b", "#10b981"]
        });
        confetti({
          particleCount: 3,
          angle: 120,
          spread: 55,
          origin: { x: 1, y: 0.6 },
          colors: ["#9333ea", "#6366f1", "#f59e0b", "#10b981"]
        });

        if (Date.now() < end) {
          requestAnimationFrame(frame);
        }
      };
      frame();
    });

    return () => {
      hasFireRef.current = false;
    };
  }, [celebration]);

  if (!celebration) return null;

  const isLevelUp = celebration.type === "level_up";
  const isBadge = celebration.type === "badge";

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onDismiss}
      >
        <motion.div
          ref={modalRef}
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 max-w-sm mx-4 text-center relative overflow-hidden"
          initial={{ scale: 0.5, opacity: 0, y: 50 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.5, opacity: 0, y: 50 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          onClick={(e) => e.stopPropagation()}
          dir={isRTL ? "rtl" : "ltr"}
          role="dialog"
          aria-modal="true"
          aria-label={t("celebration.title")}
        >
          {/* Decorative gradient top */}
          <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-purple-500 via-amber-400 to-indigo-500" />

          {/* Close button — positioned based on direction */}
          <button
            onClick={onDismiss}
            className={`absolute top-3 ${isRTL ? "left-3" : "right-3"} text-gray-400 hover:text-gray-600 dark:hover:text-gray-300`}
            aria-label={t("celebration.close")}
          >
            <X className="h-5 w-5" />
          </button>

          {/* Level Up Content */}
          {isLevelUp && (
            <>
              <motion.div
                className="mx-auto w-20 h-20 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center mb-4 shadow-lg"
                initial={{ rotate: -180, scale: 0 }}
                animate={{ rotate: 0, scale: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.2 }}
              >
                <Trophy className="h-10 w-10 text-white" />
              </motion.div>

              <motion.h2
                className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-amber-500 bg-clip-text text-transparent mb-2"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                {t("celebration.levelUp")}
              </motion.h2>

              <motion.div
                className="text-5xl font-bold text-purple-600 dark:text-purple-400 mb-2"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, delay: 0.4 }}
              >
                {celebration.newLevel}
              </motion.div>

              <p className="text-gray-500 dark:text-gray-400 mb-6">
                {t("celebration.levelAdvance", { oldLevel: celebration.oldLevel, newLevel: celebration.newLevel })}
              </p>
            </>
          )}

          {/* Badge Unlock Content */}
          {isBadge && celebration.badge && (
            <>
              <motion.div
                className="mx-auto w-20 h-20 rounded-full bg-gradient-to-br from-purple-400 to-indigo-600 flex items-center justify-center mb-4 shadow-lg"
                initial={{ rotate: -180, scale: 0 }}
                animate={{ rotate: 0, scale: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.2 }}
              >
                <Award className="h-10 w-10 text-white" />
              </motion.div>

              <motion.h2
                className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-indigo-500 bg-clip-text text-transparent mb-2"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                {t("celebration.newBadge")}
              </motion.h2>

              <motion.p
                className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-1"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.4 }}
              >
                {isYiddish
                  ? (celebration.badge.nameYi || celebration.badge.nameHe || celebration.badge.nameEn)
                  : isHebrew
                    ? celebration.badge.nameHe
                    : celebration.badge.nameEn}
              </motion.p>

              <p className="text-gray-500 dark:text-gray-400 mb-2">
                {isYiddish
                  ? (celebration.badge.descYi || celebration.badge.descHe || celebration.badge.descEn)
                  : isHebrew
                    ? celebration.badge.descHe
                    : celebration.badge.descEn}
              </p>

              {celebration.badge.xpReward > 0 && (
                <motion.div
                  className="inline-flex items-center gap-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-3 py-1 rounded-full text-sm font-medium mb-4"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.5 }}
                >
                  <Star className="h-4 w-4" />
                  +{celebration.badge.xpReward} XP
                </motion.div>
              )}
            </>
          )}

          <Button
            onClick={onDismiss}
            className="mt-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
          >
            {t("celebration.awesome")}
          </Button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
