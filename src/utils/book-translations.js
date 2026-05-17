/**
 * Translation helpers for BookCreation page.
 * Centralizes all Hebrew/English translation strings for the book editor.
 */

const translations = {
  hebrew: {
    "book.backToLibrary": "חזרה לספרייה",
    "book.createTitle": "יצירת הספר שלך",
    "book.editingLabel": "עורך הספר",
    "book.previewTitle": "תצוגה מקדימה של הספר",
    "book.readyMessage": "אנחנו מוכנים ליצור סיפור מותאם אישית על פי העדפותיך.",
    "book.storyOf": "הסיפור של",
    "book.storyTitle": "הסיפור של {name}",
    "book.bookSummary": "גיל: {age} | סוגה: {genre} | סגנון: {style}",
    "book.age": "גיל",
    "book.genre": "סוגה",
    "book.style": "סגנון",
    "book.generating": "מייצר...",
    "book.generateMyBook": "צור את הספר שלי",
    "book.creatingTitle": "יוצרים את הספר שלך",
    "book.creatingMessage": "אנא המתן בזמן שאנחנו יוצרים סיפור קסום במיוחד בשבילך...",
    "book.tab.editor": "עריכה",
    "book.tab.preview": "תצוגה מקדימה",
    "book.tab.share": "שיתוף ויצוא",
    "book.prevPage": "עמוד קודם",
    "book.nextPage": "עמוד הבא",
    "book.pageOf": "עמוד {current} מתוך {total}",
    "book.editPageText": "ערוך טקסט עמוד",
    "book.saveText": "שמור טקסט",
    "book.addNikud": "הוסף ניקוד",
    "book.makeRhyme": "בנה חריזה",
    "book.editPageImage": "עריכת תמונת עמוד",
    "book.imagePrompt": "הנחיה לתמונה",
    "book.simpleMode": "השתמש במצב פשוט",
    "book.editFullPrompt": "ערוך הנחיה מלאה",
    "book.imagePromptPlaceholder": "הנחיות מפורטות על מה צריך להיות בתמונה...",
    "book.imageSimplePlaceholder": "תאר מה צריך להיות בתמונה...",
    "book.regenerateImage": "שחזר תמונה",
    "book.pageLayout": "פריסת עמוד",
    "book.textTop": "טקסט למעלה",
    "book.textBottom": "טקסט למטה",
    "book.textLeft": "טקסט שמאלה",
    "book.textRight": "טקסט ימינה",
    "book.viewFullBook": "צפה בספר המלא",
    "book.rhymingOptions": "אפשרויות חריזה",
    "book.rhymingDesc": "הוסף תבניות חריזה כדי להפוך את הסיפור שלך למוזיקלי ומרתק",
    "book.enableRhyming": "אפשר חריזה",
    "book.applyRhyming": "החל חריזה על עמוד נוכחי",
    "book.characterSettings": "הגדרות עקביות דמויות",
    "book.characterSettingsDesc": "שמור על מראה עקבי של הדמויות לאורך כל הסיפור שלך",
    "book.mainCharDesc": "תיאור הדמות הראשית",
    "book.mainCharPlaceholder": "תאר את מראה הדמות הראשית (צבע שיער, סגנון לבוש וכו)",
    "book.secondaryChars": "דמויות משניות",
    "book.name": "שם",
    "book.briefDesc": "תיאור קצר",
    "book.addCharacter": "הוסף דמות",
    "book.artStyleConsistency": "עקביות סגנון אמנותי",
    "book.selectArtStyle": "בחר סגנון אמנותי",
    "book.noImage": "אין תמונה זמינה",
    "book.textUpdated": "טקסט העמוד עודכן בהצלחה",
    "book.textUpdateError": "שגיאה בעדכון טקסט העמוד. אנא נסה שוב.",
    "book.imageUpdated": "תמונת העמוד עודכנה בהצלחה",
    "book.imageUpdateError": "שגיאה בעדכון תמונת העמוד. אנא נסה שוב.",
    "book.layoutUpdated": "פריסת העמוד עודכנה בהצלחה",
    "book.layoutUpdateError": "שגיאה בעדכון פריסת העמוד. אנא נסה שוב.",
    "book.nikudAdded": "ניקוד נוסף בהצלחה",
    "book.nikudError": "שגיאה בהוספת ניקוד. אנא נסה שוב.",
    "book.rhymeSuccess": "הטקסט הומר לחריזה בהצלחה",
    "book.rhymeError": "שגיאה בהמרה לחריזה. אנא נסה שוב.",
    "book.bookGenerated": "הספר נוצר בהצלחה!",
    "book.rateLimit": "הגעת למגבלה היומית של {limit} ספרים. נסה שוב מחר!",
    "book.imagePartial": "{success} מתוך {total} איורים נוצרו. {failed} נכשלו — ניתן לנסות שוב בעורך.",
    "book.bookGenerateError": "שגיאה ביצירת הספר. אנא נסה שוב.",
    "book.loadError": "שגיאה בטעינת נתוני הספר. אנא נסה שוב.",
    "book.autoSaving": "שומר אוטומטית...",
    "book.autoSaved": "נשמר",
    "book.autoSaveError": "שגיאה בשמירה אוטומטית",
    "book.recoverDraft": "נמצא טיוטה שנשמרה אוטומטית. לשחזר?",
    "book.recoverYes": "שחזר",
    "book.recoverNo": "התחל מחדש",
    "book.styling": "עיצוב וסגנון"
  },
  english: {
    "book.backToLibrary": "Back to Library",
    "book.createTitle": "Create Your Book",
    "book.editingLabel": "Book Editor",
    "book.previewTitle": "Book Preview",
    "book.readyMessage": "We're ready to create a personalized story based on your preferences.",
    "book.storyOf": "Story of",
    "book.storyTitle": "{name}'s Story",
    "book.bookSummary": "Age: {age} | Genre: {genre} | Style: {style}",
    "book.age": "Age",
    "book.genre": "Genre",
    "book.style": "Style",
    "book.generating": "Generating...",
    "book.generateMyBook": "Generate My Book",
    "book.creatingTitle": "Creating Your Book",
    "book.creatingMessage": "Please wait while we create a magical story just for you...",
    "book.tab.editor": "Edit",
    "book.tab.preview": "Preview",
    "book.tab.share": "Share & Export",
    "book.prevPage": "Previous Page",
    "book.nextPage": "Next Page",
    "book.pageOf": "Page {current} of {total}",
    "book.editPageText": "Edit Page Text",
    "book.saveText": "Save Text",
    "book.addNikud": "Add Nikud",
    "book.makeRhyme": "Make Rhyme",
    "book.editPageImage": "Edit Page Image",
    "book.imagePrompt": "Image Prompt",
    "book.simpleMode": "Use Simple Mode",
    "book.editFullPrompt": "Edit Full Prompt",
    "book.imagePromptPlaceholder": "Detailed image generation prompt...",
    "book.imageSimplePlaceholder": "Describe what should be in the image...",
    "book.regenerateImage": "Regenerate Image",
    "book.pageLayout": "Page Layout",
    "book.textTop": "Text Top",
    "book.textBottom": "Text Bottom",
    "book.textLeft": "Text Left",
    "book.textRight": "Text Right",
    "book.viewFullBook": "View Full Book",
    "book.rhymingOptions": "Rhyming Options",
    "book.rhymingDesc": "Add rhyming patterns to make your story more musical and engaging",
    "book.enableRhyming": "Enable Rhyming",
    "book.applyRhyming": "Apply Rhyming to Current Page",
    "book.characterSettings": "Character Consistency Settings",
    "book.characterSettingsDesc": "Ensure consistent character appearance throughout your story",
    "book.mainCharDesc": "Main Character Description",
    "book.mainCharPlaceholder": "Describe the main character's appearance (hair color, clothing style, etc.)",
    "book.secondaryChars": "Secondary Characters",
    "book.name": "Name",
    "book.briefDesc": "Brief description",
    "book.addCharacter": "Add Character",
    "book.artStyleConsistency": "Art Style Consistency",
    "book.selectArtStyle": "Select art style",
    "book.noImage": "No image available",
    "book.textUpdated": "Page text updated successfully",
    "book.textUpdateError": "Failed to update page text. Please try again.",
    "book.imageUpdated": "Page image updated successfully",
    "book.imageUpdateError": "Failed to update page image. Please try again.",
    "book.layoutUpdated": "Page layout updated successfully",
    "book.layoutUpdateError": "Failed to update page layout. Please try again.",
    "book.nikudAdded": "Nikud added successfully",
    "book.nikudError": "Failed to add nikud. Please try again.",
    "book.rhymeSuccess": "Converted to rhyming text successfully",
    "book.rhymeError": "Failed to convert text to rhyme. Please try again.",
    "book.bookGenerated": "Book successfully generated!",
    "book.rateLimit": "You've reached today's limit of {limit} books. Try again tomorrow!",
    "book.imagePartial": "{success} of {total} images generated. {failed} failed — you can retry in the editor.",
    "book.bookGenerateError": "Failed to generate book. Please try again.",
    "book.loadError": "Failed to load book data. Please try again.",
    "book.autoSaving": "Auto-saving...",
    "book.autoSaved": "Saved",
    "book.autoSaveError": "Auto-save error",
    "book.recoverDraft": "An auto-saved draft was found. Recover it?",
    "book.recoverYes": "Recover",
    "book.recoverNo": "Start Fresh",
    "book.styling": "Styling"
  }
};

/**
 * Get a translation function for the book creation page.
 * @param {string} language - "hebrew" or "english"
 * @returns {function} Translation function that takes a key and optional params
 */
export function getBookTranslation(language) {
  const lang = translations[language] || translations.english;

  return (key, params = {}) => {
    let text = lang[key] || translations.english[key] || key;
    // Replace {param} placeholders
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(`{${k}}`, v);
    }
    return text;
  };
}

export function translateGenre(genre) {
  const genreTranslations = {
    adventure: "הרפתקאות",
    fairy_tale: "אגדה",
    educational: "חינוכי",
    bedtime: "לפני השינה",
    fantasy: "פנטזיה",
    science: "מדע",
    animals: "חיות",
    sports: "ספורט"
  };

  return genreTranslations[genre] || genre.replace(/_/g, " ");
}

export function translateArtStyle(style) {
  const styleTranslations = {
    disney: "דיסני",
    pixar: "פיקסאר",
    watercolor: "צבעי מים",
    sketch: "רישום עיפרון",
    cartoon: "קומיקס",
    realistic: "מציאותי למחצה",
    anime: "אנימה",
    clay: "חימר",
    popup: "פופ-אפ",
    minimalist: "מינימליסטי",
    vintage: "וינטג'",
    cultural: "עממי"
  };

  return styleTranslations[style] || style.replace(/_/g, " ");
}

/**
 * Art style options used in the book creation form.
 */
export const ART_STYLE_OPTIONS = [
  { value: "disney", he: "אנימציית דיסני", en: "Disney Animation" },
  { value: "pixar", he: "תלת מימד פיקסאר", en: "Pixar 3D" },
  { value: "watercolor", he: "ציור בצבעי מים", en: "Watercolor Painting" },
  { value: "sketch", he: "רישום בעיפרון", en: "Pencil Sketch" },
  { value: "cartoon", he: "קומיקס צבעוני", en: "Bright Cartoon" },
  { value: "realistic", he: "מציאותי למחצה", en: "Semi-Realistic" },
  { value: "anime", he: "אנימה/מנגה", en: "Anime/Manga" },
  { value: "minimalist", he: "מינימליסטי", en: "Minimalist" },
  { value: "vintage", he: "וינטג'", en: "Vintage" },
  { value: "comic", he: "ספר קומיקס", en: "Comic Book" },
  { value: "storybook", he: "ספר ילדים קלאסי", en: "Classic Storybook" },
  { value: "impressionist", he: "אימפרסיוניסטי", en: "Impressionist" },
  { value: "fantasy", he: "פנטזיה קסומה", en: "Fantasy Art" },
  { value: "pop_art", he: "פופ ארט", en: "Pop Art" },
  { value: "crayon", he: "ציור בצבעי פסטל", en: "Crayon & Pastel" },
  { value: "collage", he: "קולאז' נייר", en: "Paper Collage" },
  { value: "gouache", he: "גואש", en: "Gouache Painting" },
  { value: "chibi", he: "צ'יבי (מיני אנימה)", en: "Chibi (Mini Anime)" }
];
