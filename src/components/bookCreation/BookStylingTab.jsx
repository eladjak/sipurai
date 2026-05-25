import { Music, Wand2, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import PageStyler from "./PageStyler";
import RhymeOptions from "./RhymeOptions";

/**
 * Styling tab that combines text styles and rhyming options.
 * Simplified from the original 7-tab layout.
 */
export default function BookStylingTab({
  textStyles,
  setTextStyles,
  bookLanguage,
  useRhyming,
  setUseRhyming,
  rhymeSettings,
  setRhymeSettings,
  onConvertToRhyme,
  isGenerating,
  isRTL,
  t,
  toast
}) {
  return (
    <div className="space-y-8" dir={isRTL ? "rtl" : "ltr"}>
      {/* Text Styling */}
      <PageStyler
        textStyles={textStyles}
        setTextStyles={setTextStyles}
        bookLanguage={bookLanguage}
        onApplyStyles={(styles) => {
          setTextStyles(styles);
          toast({
            description: t("book.layoutUpdated"),
            className: "bg-green-100 text-green-900"
          });
        }}
      />

      {/* Rhyming Options */}
      <Card>
        <CardHeader>
          <CardTitle className={`flex items-center ${isRTL ? "flex-row-reverse" : ""}`}>
            <Music className={`h-5 w-5 text-purple-500 ${isRTL ? "ml-2" : "mr-2"}`} />
            {t("book.rhymingOptions")}
          </CardTitle>
          <CardDescription>{t("book.rhymingDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className={`mb-4 flex items-center justify-between ${isRTL ? "flex-row-reverse" : ""}`}>
            <Label htmlFor="use-rhyming-styling" className="font-medium">
              {t("book.enableRhyming")}
            </Label>
            <Switch
              id="use-rhyming-styling"
              checked={useRhyming}
              onCheckedChange={setUseRhyming}
            />
          </div>

          {useRhyming && (
            <RhymeOptions
              rhymeSettings={rhymeSettings}
              setRhymeSettings={setRhymeSettings}
              currentLanguage={isRTL ? "hebrew" : "english"}
            />
          )}
        </CardContent>
        <CardFooter>
          <Button
            onClick={onConvertToRhyme}
            className="w-full"
            disabled={!useRhyming || isGenerating}
          >
            {isGenerating ? (
              <RotateCw className={`h-4 w-4 animate-spin ${isRTL ? "ml-2" : "mr-2"}`} />
            ) : (
              <Wand2 className={`h-4 w-4 ${isRTL ? "ml-2" : "mr-2"}`} />
            )}
            {t("book.applyRhyming")}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
