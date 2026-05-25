import { RotateCw } from "lucide-react";

/**
 * Visual indicator for auto-save status.
 * Shows saving spinner, saved checkmark, or error indicator.
 */
export default function AutoSaveIndicator({ status, lastSaved, isRTL, t }) {
  if (status === "saving") {
    return (
      <div className={`flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 ${isRTL ? "flex-row-reverse" : ""}`}>
        <RotateCw className="w-3 h-3 animate-spin" />
        <span>{t("book.autoSaving")}</span>
      </div>
    );
  }

  if (status === "saved" && lastSaved) {
    return (
      <div className={`flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400 ${isRTL ? "flex-row-reverse" : ""}`}>
        <div className="w-2 h-2 bg-green-500 rounded-full" />
        <span>{t("book.autoSaved")}</span>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className={`flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400 ${isRTL ? "flex-row-reverse" : ""}`}>
        <div className="w-2 h-2 bg-red-500 rounded-full" />
        <span>{t("book.autoSaveError")}</span>
      </div>
    );
  }

  return null;
}
