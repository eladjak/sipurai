import CelebrationModal from "./CelebrationModal";
import XPToast from "./XPToast";

/**
 * GamificationOverlay - Renders the current celebration from the queue.
 * Place this component at the app root level.
 */
export default function GamificationOverlay({
  pendingCelebrations = [],
  onDismiss,
  isRTL = false,
  isHebrew = false,
  isYiddish = false
}) {
  if (pendingCelebrations.length === 0) return null;

  const current = pendingCelebrations[0];

  // XP toasts show as floating notifications
  if (current.type === "xp") {
    return (
      <XPToast
        celebration={current}
        onDismiss={onDismiss}
      />
    );
  }

  // Level-up and badge celebrations show as modals
  if (current.type === "level_up" || current.type === "badge") {
    return (
      <CelebrationModal
        celebration={current}
        onDismiss={onDismiss}
        isRTL={isRTL}
      />
    );
  }

  return null;
}
