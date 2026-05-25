import {
  ArrowLeft,
  Book as BookIcon,
  Lightbulb,
  Sparkles,
  RotateCw,
  Music
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import RhymeOptions from "./RhymeOptions";
import { translateGenre, translateArtStyle, ART_STYLE_OPTIONS } from "@/utils/book-translations";

/**
 * Pre-generation view shown when a book is in "draft" status.
 * Allows setting character consistency, art style, and rhyming before generation.
 */
export default function DraftView({
  book,
  characterConsistency,
  setCharacterConsistency,
  useRhyming,
  setUseRhyming,
  rhymeSettings,
  setRhymeSettings,
  isGenerating,
  onGenerate,
  onNavigateBack,
  isRTL,
  t
}) {
  const isHebrewLike = isRTL;

  return (
    <div className="max-w-4xl mx-auto py-8" dir={isRTL ? "rtl" : "ltr"}>
      {/* Header */}
      <div className="mb-8">
        <div className={`flex items-center gap-2 mb-4 ${isRTL ? "flex-row-reverse" : ""}`}>
          <Button variant="ghost" onClick={onNavigateBack}>
            <ArrowLeft className={`h-4 w-4 ${isRTL ? "ml-2" : "mr-2"}`} />
            {t("book.backToLibrary")}
          </Button>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          {book.title || t("book.createTitle")}
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          {t("book.readyMessage")}
        </p>
      </div>

      {/* Book Info Summary */}
      <div className={`flex items-center gap-4 mb-8 ${isRTL ? "flex-row-reverse" : ""}`}>
        <div className="w-16 h-16 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-300 flex-shrink-0">
          <BookIcon className="h-8 w-8" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200">
            {t("book.storyTitle", { name: book.child_name })}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t("book.bookSummary", {
              age: book.child_age,
              genre: isHebrewLike ? translateGenre(book.genre) : (book.genre?.replace(/_/g, " ") ?? ""),
              style: isHebrewLike ? translateArtStyle(book.art_style) : (book.art_style?.replace(/_/g, " ") ?? "")
            })}
          </p>
        </div>
      </div>

      {/* Character Consistency Settings */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className={`flex items-center ${isRTL ? "flex-row-reverse" : ""}`}>
            <Lightbulb className={`h-5 w-5 text-amber-500 ${isRTL ? "ml-2" : "mr-2"}`} />
            {t("book.characterSettings")}
          </CardTitle>
          <CardDescription>{t("book.characterSettingsDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-5">
            {/* Main Character */}
            <div>
              <Label className="font-medium mb-1.5 block">{t("book.mainCharDesc")}</Label>
              <Textarea
                value={characterConsistency.mainCharacter.description || ""}
                onChange={(e) =>
                  setCharacterConsistency({
                    ...characterConsistency,
                    mainCharacter: {
                      ...characterConsistency.mainCharacter,
                      description: e.target.value
                    }
                  })
                }
                placeholder={t("book.mainCharPlaceholder")}
                className="h-20"
                dir={isRTL ? "rtl" : "ltr"}
              />
            </div>

            {/* Secondary Characters */}
            <div>
              <Label className="font-medium mb-1.5 block">{t("book.secondaryChars")}</Label>
              {characterConsistency.secondaryCharacters.map((char, index) => (
                <div key={index} className={`flex gap-2 mb-2 ${isRTL ? "flex-row-reverse" : ""}`}>
                  <Input
                    value={char.name}
                    onChange={(e) => {
                      const updated = [...characterConsistency.secondaryCharacters];
                      updated[index] = { ...updated[index], name: e.target.value };
                      setCharacterConsistency({
                        ...characterConsistency,
                        secondaryCharacters: updated
                      });
                    }}
                    placeholder={t("book.name")}
                    className="w-1/3"
                    dir={isRTL ? "rtl" : "ltr"}
                  />
                  <Input
                    value={char.description}
                    onChange={(e) => {
                      const updated = [...characterConsistency.secondaryCharacters];
                      updated[index] = { ...updated[index], description: e.target.value };
                      setCharacterConsistency({
                        ...characterConsistency,
                        secondaryCharacters: updated
                      });
                    }}
                    placeholder={t("book.briefDesc")}
                    className="flex-1"
                    dir={isRTL ? "rtl" : "ltr"}
                  />
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setCharacterConsistency({
                    ...characterConsistency,
                    secondaryCharacters: [
                      ...characterConsistency.secondaryCharacters,
                      { name: "", description: "" }
                    ]
                  })
                }
                className="mt-2"
              >
                {t("book.addCharacter")}
              </Button>
            </div>

            {/* Art Style */}
            <div>
              <Label htmlFor="artStyle" className="font-medium mb-1.5 block">
                {t("book.artStyleConsistency")}
              </Label>
              <Select
                value={characterConsistency.style}
                onValueChange={(value) =>
                  setCharacterConsistency({
                    ...characterConsistency,
                    style: value
                  })
                }
              >
                <SelectTrigger id="artStyle">
                  <SelectValue placeholder={t("book.selectArtStyle")} />
                </SelectTrigger>
                <SelectContent>
                  {ART_STYLE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {isRTL ? option.he : option.en}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Rhyming Options */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className={`flex items-center ${isRTL ? "flex-row-reverse" : ""}`}>
            <Music className={`h-5 w-5 text-purple-500 ${isRTL ? "ml-2" : "mr-2"}`} />
            {t("book.rhymingOptions")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`mb-4 flex items-center justify-between ${isRTL ? "flex-row-reverse" : ""}`}>
            <Label htmlFor="use-rhyming-draft" className="font-medium">
              {t("book.enableRhyming")}
            </Label>
            <Switch
              id="use-rhyming-draft"
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
      </Card>

      {/* Generate Button */}
      <div className={`mt-8 flex ${isRTL ? "justify-start" : "justify-end"}`}>
        <Button
          onClick={onGenerate}
          disabled={isGenerating}
          className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-lg px-8 py-3 h-auto"
          size="lg"
        >
          {isGenerating ? (
            <>
              <RotateCw className={`h-5 w-5 animate-spin ${isRTL ? "ml-2" : "mr-2"}`} />
              {t("book.generating")}
            </>
          ) : (
            <>
              <Sparkles className={`h-5 w-5 ${isRTL ? "ml-2" : "mr-2"}`} />
              {t("book.generateMyBook")}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
