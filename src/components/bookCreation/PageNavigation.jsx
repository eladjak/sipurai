import { useId } from "react";
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
  onPageIndexChange,
  editorCopy,
  t
}) {
  const pickerId = useId();
  return (
    <div className="mt-4 flex flex-wrap items-end justify-between gap-2">
      <Button
        variant="outline"
        onClick={onPrevPage}
        disabled={currentPageIndex === 0}
        className="min-h-11"
        aria-label={t("book.prevPage")}
      >
        {t("book.prevPage")}
      </Button>

      <div className="grid min-w-0 gap-1">
        <label htmlFor={pickerId} className="text-sm font-medium">{editorCopy("book.editorChoosePage")}</label>
        <select
          className="min-h-11 min-w-0 max-w-full rounded-md border bg-background px-3 text-sm"
          id={pickerId}
          value={currentPageIndex}
          onChange={(event) => onPageIndexChange(Number(event.target.value))}
        >
          {Array.from({ length: totalPages }, (_, index) => (
            <option key={index} value={index}>{t("book.pageOf", { current: index + 1, total: totalPages })}</option>
          ))}
        </select>
      </div>

      <Button
        variant="outline"
        onClick={onNextPage}
        disabled={currentPageIndex === totalPages - 1}
        className="min-h-11"
        aria-label={t("book.nextPage")}
      >
        {t("book.nextPage")}
      </Button>
    </div>
  );
}
