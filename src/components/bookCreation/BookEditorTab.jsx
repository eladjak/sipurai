import React from "react";
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
  onAddNikud,
  onConvertToRhyme,
  onImagePromptChange,
  onRegenerateImage,
  onLayoutChange
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left: Page preview and navigation */}
      <div className="lg:col-span-2">
        <PagePreview
          currentPage={pages[currentPageIndex]}
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
          onNextPage={() => onPageIndexChange(Math.min(pages.length - 1, currentPageIndex + 1))}
          isRTL={isRTL}
          t={t}
        />
      </div>

      {/* Right: Editing tools */}
      <div className="space-y-4">
        <PageTextEditor
          currentPageText={currentPageText}
          onTextChange={onTextChange}
          onSaveText={onSaveText}
          onAddNikud={onAddNikud}
          onConvertToRhyme={onConvertToRhyme}
          bookLanguage={book.language}
          useRhyming={useRhyming}
          isGenerating={isGenerating}
          isRTL={isRTL}
          t={t}
        />

        <PageImageEditor
          currentPageImagePrompt={currentPageImagePrompt}
          onPromptChange={onImagePromptChange}
          onRegenerateImage={onRegenerateImage}
          isGenerating={isGenerating}
          isRTL={isRTL}
          t={t}
        />

        <PageLayoutEditor
          currentPageLayout={currentPageLayout}
          onLayoutChange={onLayoutChange}
          isRTL={isRTL}
          t={t}
        />

        {/* Bottom navigation */}
        <div className={`flex justify-between ${isRTL ? "flex-row-reverse" : ""}`}>
          <Link to={createPageUrl("Library")}>
            <Button variant="outline">
              <ArrowLeft className={`h-4 w-4 ${isRTL ? "ml-2" : "mr-2"}`} aria-hidden="true" />
              {t("book.backToLibrary")}
            </Button>
          </Link>
          <Link to={`${createPageUrl("BookView")}?id=${bookId}`}>
            <Button className="bg-purple-600 hover:bg-purple-700">
              <BookOpen className={`h-4 w-4 ${isRTL ? "ml-2" : "mr-2"}`} aria-hidden="true" />
              {t("book.viewFullBook")}
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
