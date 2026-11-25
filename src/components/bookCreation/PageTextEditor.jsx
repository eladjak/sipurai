import { Edit, Music, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * Card component for editing the text content of a book page.
 * Includes save, nikud (Hebrew vocalization), and rhyme conversion buttons.
 */
export default function PageTextEditor({
  currentPageText,
  onTextChange,
  onSaveText,
  saving,
  saveDisabled,
  showRetry,
  editorCopy,
  onAddNikud,
  onConvertToRhyme,
  bookLanguage,
  useRhyming,
  isGenerating,
  isRTL,
  t
}) {
  const isHebrewLike = bookLanguage === "hebrew" || bookLanguage === "yiddish";

  return (
    <Card>
      <CardHeader>
        <CardTitle className={`flex items-center text-lg ${isRTL ? "flex-row-reverse" : ""}`}>
          <Edit className={`h-5 w-5 text-purple-500 me-2`} />
          {t("book.editPageText")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <Textarea
            value={currentPageText}
            onChange={(e) => onTextChange(e.target.value)}
            className="min-h-[200px] font-medium text-base leading-relaxed"
            dir={isHebrewLike ? "rtl" : "ltr"}
            aria-label={t("book.editPageText")}
          />
          <div className={`flex flex-wrap gap-2 ${isRTL ? "flex-row-reverse" : ""}`}>
            <Button onClick={onSaveText} disabled={saving || saveDisabled} className="min-h-11 min-w-[100px] flex-1">
              {editorCopy(showRetry ? "book.editorRetry" : "book.editorSave")}
            </Button>
            {isHebrewLike && (
              <Button
                variant="outline"
                onClick={onAddNikud}
                className="min-h-11 min-w-[100px] flex-1"
              >
                {t("book.addNikud")}
              </Button>
            )}
            {useRhyming && (
              <Button
                variant="outline"
                onClick={onConvertToRhyme}
                className="min-h-11 min-w-[100px] flex-1"
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <RotateCw className={`h-4 w-4 animate-spin me-2`} />
                ) : (
                  <Music className={`h-4 w-4 me-2`} />
                )}
                {t("book.makeRhyme")}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
