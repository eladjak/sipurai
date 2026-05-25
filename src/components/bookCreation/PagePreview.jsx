
/**
 * Renders a single page preview with text and image in the selected layout.
 * Supports RTL languages (Hebrew, Yiddish) and interactive elements.
 */
export default function PagePreview({
  currentPage,
  currentPageIndex,
  currentPageText,
  currentPageLayout,
  textStyles,
  interactiveElements,
  bookLanguage,
  t
}) {
  if (!currentPage) return null;

  const isRTL = bookLanguage === "hebrew" || bookLanguage === "yiddish";

  const getLayoutClasses = () => {
    switch (currentPageLayout) {
      case "text_top":
        return "flex-col";
      case "text_bottom":
        return "flex-col-reverse";
      case "text_left":
        return isRTL ? "flex-row-reverse" : "flex-row";
      case "text_right":
        return isRTL ? "flex-row" : "flex-row-reverse";
      default:
        return "flex-col";
    }
  };

  const getTextStyle = () => ({
    fontSize: `${textStyles.fontSize}px`,
    fontFamily: textStyles.fontFamily,
    color: textStyles.color,
    fontWeight: textStyles.fontWeight,
    textAlign: isRTL ? "right" : textStyles.alignment,
    lineHeight: textStyles.lineHeight,
    direction: isRTL ? "rtl" : "ltr"
  });

  const pageInteractiveElements = (interactiveElements || []).filter(
    (element) => element.pageIndex === currentPageIndex
  );

  return (
    <div
      className="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 shadow-md bg-white dark:bg-gray-800"
      dir={isRTL ? "rtl" : "ltr"}
      role="article"
      aria-label={t("book.pageOf", { current: currentPageIndex + 1, total: "?" })}
    >
      <div className={`flex ${getLayoutClasses()} h-full`}>
        {/* Text section */}
        <div className="flex-1 p-6 flex items-center">
          <div style={getTextStyle()} className="w-full">
            {currentPageText}

            {pageInteractiveElements.map((element, idx) => (
              <div
                key={idx}
                className="my-2 p-2 border border-purple-300 dark:border-purple-600 rounded-lg"
              >
                {element.type === "question" && (
                  <div>
                    <p className="font-bold">{element.content}</p>
                    <div className={`flex gap-2 mt-2 ${isRTL ? "flex-row-reverse" : ""}`}>
                      {(element.options || []).map((option, i) => (
                        <button
                          key={i}
                          className="px-3 py-1.5 bg-purple-100 dark:bg-purple-900/30 rounded-lg text-sm"
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {element.type === "animation" && (
                  <div className="text-center text-purple-600 dark:text-purple-400">
                    [{element.description}]
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Image section */}
        <div className="flex-1 bg-gray-100 dark:bg-gray-700 relative">
          {currentPage.image_url ? (
            <img
              src={currentPage.image_url}
              alt={`${t("book.pageOf", { current: currentPageIndex + 1, total: "" })}`.trim()}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full min-h-[300px] flex items-center justify-center">
              <p className="text-gray-400 dark:text-gray-500">{t("book.noImage")}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
