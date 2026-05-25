import { Button } from "@/components/ui/button";

/**
 * Page navigation controls: previous, current page indicator, next.
 * Supports RTL layout for Hebrew/Yiddish.
 */
export default function PageNavigation({
  currentPageIndex,
  totalPages,
  onPrevPage,
  onNextPage,
  isRTL,
  t
}) {
  return (
    <div className={`flex justify-between items-center mt-4 ${isRTL ? "flex-row-reverse" : ""}`}>
      <Button
        variant="outline"
        onClick={onPrevPage}
        disabled={currentPageIndex === 0}
        className="min-w-[120px]"
        aria-label={t("book.prevPage")}
      >
        {t("book.prevPage")}
      </Button>

      <span
        className="flex items-center text-sm text-gray-500 dark:text-gray-400 font-medium"
        aria-live="polite"
      >
        {t("book.pageOf", { current: currentPageIndex + 1, total: totalPages })}
      </span>

      <Button
        variant="outline"
        onClick={onNextPage}
        disabled={currentPageIndex === totalPages - 1}
        className="min-w-[120px]"
        aria-label={t("book.nextPage")}
      >
        {t("book.nextPage")}
      </Button>
    </div>
  );
}
