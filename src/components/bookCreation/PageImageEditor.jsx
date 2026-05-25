import { useState } from "react";
import { Image, RefreshCw, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

/**
 * Accordion-based editor for page image prompt and regeneration.
 * Includes simple mode (input) and advanced mode (textarea).
 */
export default function PageImageEditor({
  currentPageImagePrompt,
  onPromptChange,
  onRegenerateImage,
  isGenerating,
  isRTL,
  t
}) {
  const [isEditingPrompt, setIsEditingPrompt] = useState(false);

  return (
    <Accordion
      type="single"
      collapsible
      className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700"
    >
      <AccordionItem value="image">
        <AccordionTrigger className="px-4">
          <div className={`flex items-center ${isRTL ? "flex-row-reverse" : ""}`}>
            <Image className={`h-5 w-5 text-purple-500 ${isRTL ? "ml-2" : "mr-2"}`} />
            <span>{t("book.editPageImage")}</span>
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-4 pb-4">
          <div className="space-y-4">
            <div className={`flex items-center justify-between mb-2 ${isRTL ? "flex-row-reverse" : ""}`}>
              <Label htmlFor="imagePrompt">{t("book.imagePrompt")}</Label>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-xs"
                onClick={() => setIsEditingPrompt(!isEditingPrompt)}
              >
                {isEditingPrompt ? t("book.simpleMode") : t("book.editFullPrompt")}
              </Button>
            </div>

            {isEditingPrompt ? (
              <Textarea
                id="imagePrompt"
                value={currentPageImagePrompt}
                onChange={(e) => onPromptChange(e.target.value)}
                className="min-h-[150px]"
                placeholder={t("book.imagePromptPlaceholder")}
                dir={isRTL ? "rtl" : "ltr"}
              />
            ) : (
              <div className="space-y-3">
                <Input
                  value={currentPageImagePrompt}
                  onChange={(e) => onPromptChange(e.target.value)}
                  placeholder={t("book.imageSimplePlaceholder")}
                  dir={isRTL ? "rtl" : "ltr"}
                />
                <div className={`flex flex-wrap gap-1 ${isRTL ? "flex-row-reverse" : ""}`}>
                  {["Character", "Setting", "Action", "Emotion"].map((tag) => (
                    <Button
                      key={tag}
                      variant="outline"
                      size="sm"
                      className="text-xs h-7"
                      onClick={() =>
                        onPromptChange(
                          currentPageImagePrompt +
                            (currentPageImagePrompt ? ", " : "") +
                            tag.toLowerCase() +
                            ": "
                        )
                      }
                    >
                      +{tag}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            <Button
              onClick={onRegenerateImage}
              disabled={isGenerating || !currentPageImagePrompt}
              className="w-full"
            >
              {isGenerating ? (
                <>
                  <RotateCw className={`h-4 w-4 animate-spin ${isRTL ? "ml-2" : "mr-2"}`} />
                  {t("book.generating")}
                </>
              ) : (
                <>
                  <RefreshCw className={`h-4 w-4 ${isRTL ? "ml-2" : "mr-2"}`} />
                  {t("book.regenerateImage")}
                </>
              )}
            </Button>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
