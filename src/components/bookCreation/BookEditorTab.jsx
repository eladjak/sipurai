import { ArrowLeft, BookOpen } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { createPageUrl } from "@/utils";
import PagePreview from "./PagePreview";
import PageNavigation from "./PageNavigation";
import PageTextEditor from "./PageTextEditor";
import PageImageEditor from "./PageImageEditor";
import PageLayoutEditor from "./PageLayoutEditor";

/**
 * Main editor tab content for the BookCreation page.
 * Combines page preview, navigation, text editor, image editor, and layout editor.
 */
export default function BookEditorTab({
  book,
  bookId,
  pages,
  currentPageIndex,
  currentPageText,
  currentPageImagePrompt,
  currentPageLayout,
  textStyles,
  interactiveElements,
  useRhyming,
  isGenerating,
  isRTL,
  t,
  onPageIndexChange,
  onTextChange,
  onSaveText,
  onConfirmTextSave,
  onKeepServerText,
  textDraft,
  hasTextDrafts,
  textSaveStatus,
  textConflict,
  serverText,
  promptDraft,
  editorCopy = t,
  onAddNikud,
  onConvertToRhyme,
  onImagePromptChange,
  onRegenerateImage,
  onLayoutChange
}) {
  const readerUrl = `${createPageUrl("BookView")}?id=${encodeURIComponent(bookId)}`;
  if (!pages.length) {
    return (
      <div className="rounded-3xl border border-[#d8c7aa] bg-[#fff8eb] p-6 text-center dark:border-slate-600 dark:bg-slate-800">
        <img src="/icons/moon-book-192.png" alt="" className="mx-auto size-20" />
        <p className="my-4">{editorCopy("book.editorNoPages")}</p>
        <Button asChild variant="outline" className="min-h-11">
          <Link to={createPageUrl("Library")}>{editorCopy("book.backToLibrary")}</Link>
        </Button>
      </div>
    );
  }
  return (
    <div className="grid min-w-0 items-start gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
      <div className="min-w-0 rounded-3xl border border-[#d8c7aa] bg-[#efe3ce] p-2.5 shadow-sm dark:border-slate-600 dark:bg-slate-800 sm:p-4">
        <div className="overflow-hidden rounded-2xl [filter:drop-shadow(0_4px_5px_#45311d22)] [&_[role=article]]:border-[#d5c1a1] [&_[role=article]]:bg-[#fff9ec] dark:[&_[role=article]]:border-slate-600 dark:[&_[role=article]]:bg-slate-800">
          <PagePreview
            currentPage={pages[currentPageIndex]}
            totalPages={pages.length}
            currentPageIndex={currentPageIndex}
            currentPageText={currentPageText}
            currentPageLayout={currentPageLayout}
            textStyles={textStyles}
            interactiveElements={interactiveElements}
            bookLanguage={book.language}
            t={t}
          />
        </div>

        <PageNavigation
          currentPageIndex={currentPageIndex}
          totalPages={pages.length}
          onPrevPage={() => onPageIndexChange(Math.max(0, currentPageIndex - 1))}
          onPageIndexChange={onPageIndexChange}
          editorCopy={editorCopy}
          onNextPage={() => onPageIndexChange(Math.min(pages.length - 1, currentPageIndex + 1))}
          t={t}
        />
      </div>

      <div className="min-w-0 space-y-4 rounded-3xl border border-[#deceb6] bg-[#fffaf2] p-3 shadow-sm dark:border-slate-600 dark:bg-slate-900 sm:p-4">
        <PageTextEditor
          currentPageText={currentPageText}
          onTextChange={onTextChange}
          onSaveText={onSaveText}
          saving={textSaveStatus === "saving"}
          saveDisabled={!textDraft || textConflict}
          showRetry={textSaveStatus === "error" && !textConflict}
          editorCopy={editorCopy}
          onAddNikud={onAddNikud}
          onConvertToRhyme={onConvertToRhyme}
          bookLanguage={book.language}
          useRhyming={useRhyming}
          isGenerating={isGenerating}
          isRTL={isRTL}
          t={t}
        />

        <div className="space-y-1 text-sm" role="status">
          {textDraft && <p>{editorCopy(textDraft.local ? "book.editorLocal" : "book.editorLocalError")}</p>}
          {textSaveStatus === "saving" && <p>{editorCopy("book.editorSaving")}</p>}
          {textSaveStatus === "saved" && !textDraft && <p>{editorCopy("book.editorSaved")}</p>}
          {textSaveStatus === "error" && <p>{editorCopy("book.editorSaveError")}</p>}
        </div>
        {textConflict && (
          <div className="space-y-3 rounded-xl border border-amber-500/50 p-4">
            <p role="status">{editorCopy("book.editorConflict")}</p>
            <p className="whitespace-pre-wrap break-words" dir="auto">{serverText || editorCopy("book.editorBlankText")}</p>
            <Button className="min-h-11 whitespace-normal" onClick={onConfirmTextSave} disabled={textSaveStatus === "saving"}>
              {editorCopy("book.editorSaveMine")}
            </Button>
            <Button variant="outline" className="min-h-11 whitespace-normal" onClick={onKeepServerText} disabled={textSaveStatus === "saving"}>
              {editorCopy("book.editorKeepServer")}
            </Button>
          </div>
        )}
        <details className="rounded-xl border border-[#cbbba1] bg-[#fff6e7] px-4 dark:border-slate-600 dark:bg-slate-800">
          <summary className="min-h-11 cursor-pointer content-center font-semibold marker:text-[#805326] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">{editorCopy("book.editorAdvanced")}</summary>
          <div className="space-y-3 pb-4">
            <PageImageEditor
              currentPageImagePrompt={currentPageImagePrompt}
              onPromptChange={onImagePromptChange}
              onRegenerateImage={onRegenerateImage}
              isGenerating={isGenerating}
              isRTL={isRTL}
              t={t}
            />
            {promptDraft && (
              <p role="status" className="text-sm">{editorCopy(promptDraft.local ? "book.editorPromptLocal" : "book.editorLocalError")}</p>
            )}
            <PageLayoutEditor
              currentPageLayout={currentPageLayout}
              onLayoutChange={onLayoutChange}
              isRTL={isRTL}
              t={t}
            />
          </div>
        </details>

        {/* Bottom navigation */}
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" className="min-h-11">
            <Link to={createPageUrl("Library")}>
              <ArrowLeft className={`me-2 size-4 ${isRTL ? "rotate-180" : ""}`} aria-hidden="true" />
              {editorCopy("book.backToLibrary")}
            </Link>
          </Button>
          <Button asChild className="min-h-11 bg-[#2b4255] text-white hover:bg-[#3a576c]">
            <Link to={readerUrl}>
              <BookOpen className="me-2 size-4" aria-hidden="true" />
              {t("book.viewFullBook")}
            </Link>
          </Button>
        </div>
        {hasTextDrafts && <p className="text-sm">{editorCopy("book.editorReaderVersion")}</p>}
      </div>
    </div>
  );
}
