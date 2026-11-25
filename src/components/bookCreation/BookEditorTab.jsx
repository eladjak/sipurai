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
  textSaveStatus,
  textConflict,
  serverText,
  promptDraft,
  legacyDraft,
  editorCopy,
  onAddNikud,
  onConvertToRhyme,
  onImagePromptChange,
  onRegenerateImage,
  onLayoutChange
}) {
  const readerUrl = `${createPageUrl("BookView")}?id=${encodeURIComponent(bookId)}`;
  if (!pages.length) {
    return (
      <div className="rounded-2xl border bg-card p-6 text-center">
        <img src="/icons/moon-book-192.png" alt="" className="mx-auto size-20" />
        <p className="my-4">{editorCopy("book.editorNoPages")}</p>
        <Button asChild variant="outline" className="min-h-11">
          <Link to={createPageUrl("Library")}>{editorCopy("book.backToLibrary")}</Link>
        </Button>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left: Page preview and navigation */}
      <div className="lg:col-span-2">
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

      {/* Right: Editing tools */}
      <div className="space-y-4">
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
        {legacyDraft && (
          <details className="rounded-xl border px-4">
            <summary className="flex min-h-11 cursor-pointer items-center">{editorCopy("book.editorLegacyTitle")}</summary>
            <p className="mb-2 text-sm">{editorCopy("book.editorLegacyHelp")}</p>
            {legacyDraft.currentPageText && <p className="mb-2 whitespace-pre-wrap break-words text-sm" dir="auto">{legacyDraft.currentPageText}</p>}
            {legacyDraft.currentPageImagePrompt && <p className="mb-2 whitespace-pre-wrap break-words text-sm" dir="auto">{legacyDraft.currentPageImagePrompt}</p>}
          </details>
        )}
        <details className="rounded-xl border px-4">
          <summary className="flex min-h-11 cursor-pointer items-center">{editorCopy("book.editorAdvanced")}</summary>
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
          <Button asChild className="min-h-11 bg-purple-600 hover:bg-purple-700">
            <Link to={readerUrl}>
              <BookOpen className="me-2 size-4" aria-hidden="true" />
              {t("book.viewFullBook")}
            </Link>
          </Button>
        </div>
        {textDraft && <p className="text-sm">{editorCopy("book.editorReaderVersion")}</p>}
      </div>
    </div>
  );
}
