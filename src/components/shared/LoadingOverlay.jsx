import { motion } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * LoadingOverlay - A child-friendly loading indicator with skeleton screens.
 * Can be used as full-page or overlay mode.
 *
 * @param {string} message - Loading message to display
 * @param {boolean} isRTL - Right-to-left layout
 * @param {boolean} overlay - If true, renders as a fixed overlay
 */
export default function LoadingOverlay({ message, isRTL, overlay = false }) {
  const content = (
    <div
      className="flex flex-col items-center justify-center p-8"
      dir={isRTL ? "rtl" : "ltr"}
      role="status"
      aria-live="polite"
      aria-label={message}
    >
      {/* Animated book icon */}
      <motion.div
        className="mb-6"
        animate={{
          scale: [1, 1.1, 1],
          rotate: [0, 5, -5, 0]
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      >
        <div className="w-20 h-20 bg-gradient-to-br from-purple-400 to-blue-500 rounded-2xl flex items-center justify-center shadow-lg">
          <span className="text-4xl" aria-hidden="true">📖</span>
        </div>
      </motion.div>

      {/* Message */}
      <motion.p
        className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-6 text-center"
        animate={{ opacity: [1, 0.5, 1] }}
        transition={{ duration: 1.5, repeat: Infinity }}
      >
        {message}
      </motion.p>

      {/* Skeleton cards for visual interest */}
      <div className="w-full max-w-sm space-y-3">
        <Skeleton className="h-6 w-3/4 mx-auto" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-2/3" />
      </div>

      {/* Bouncing dots */}
      <div className="flex gap-2 mt-6">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="w-3 h-3 bg-purple-500 rounded-full"
            animate={{ y: [0, -10, 0] }}
            transition={{
              duration: 0.6,
              repeat: Infinity,
              delay: i * 0.2
            }}
            aria-hidden="true"
          />
        ))}
      </div>
    </div>
  );

  if (overlay) {
    return (
      <motion.div
        className="fixed inset-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm z-50 flex items-center justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {content}
      </motion.div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      {content}
    </div>
  );
}
