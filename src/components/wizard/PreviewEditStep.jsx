import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Sparkles, RefreshCw, Edit3, BookOpen, Globe, ChevronDown, Settings2, Check, Music, Shuffle, Wand2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import RhymeOptions from "@/components/bookCreation/RhymeOptions";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/components/i18n/i18nProvider";

/**
 * Visual art style definitions with emoji, color, and trilingual descriptions.
 * Used in PreviewEditStep to show child-friendly style previews.
 */
const ART_STYLE_VISUAL = [
  {
    value: "disney",
    emoji: "🏰",
    image: "/images/style-disney.jpg",
    color: "#4f46e5",
    gradient: "from-indigo-400 to-violet-500",
    bg: "bg-indigo-50 dark:bg-indigo-950/30",
    border: "border-indigo-200 dark:border-indigo-700",
    en: "Disney Animation",
    he: "אנימציית דיסני",
    yi: "דיסני אַנימאַציע",
    desc: { en: "Colorful & magical", he: "צבעוני וקסום", yi: "פֿאַרביק און כּישופֿדיק" }
  },
  {
    value: "watercolor",
    emoji: "🎨",
    image: "/images/style-watercolor.jpg",
    color: "#06b6d4",
    bg: "bg-cyan-50 dark:bg-cyan-950/30",
    border: "border-cyan-200 dark:border-cyan-700",
    en: "Watercolor",
    he: "צבעי מים",
    yi: "וואַסערפֿאַרבן",
    desc: { en: "Soft & dreamy", he: "עדין וחלומי", yi: "ווייך און חלומדיק" }
  },
  {
    value: "cartoon",
    emoji: "😄",
    color: "#f59e0b",
    bg: "bg-amber-50 dark:bg-amber-950/30",
    border: "border-amber-200 dark:border-amber-700",
    en: "Bright Cartoon",
    he: "קומיקס צבעוני",
    yi: "קאַריקאַטור",
    desc: { en: "Fun & playful", he: "כיפי ושובבי", yi: "שפּאַסיק" }
  },
  {
    value: "realistic",
    emoji: "📷",
    color: "#64748b",
    bg: "bg-slate-50 dark:bg-slate-950/30",
    border: "border-slate-200 dark:border-slate-700",
    en: "Semi-Realistic",
    he: "מציאותי למחצה",
    yi: "האַלב-רעאַליסטיש",
    desc: { en: "Photo-like detail", he: "פרטים כמו צילום", yi: "פֿאָטאָ-ווי" }
  },
  {
    value: "comic",
    emoji: "💥",
    image: "/images/style-comic.jpg",
    color: "#ef4444",
    bg: "bg-red-50 dark:bg-red-950/30",
    border: "border-red-200 dark:border-red-700",
    en: "Comic Book",
    he: "ספר קומיקס",
    yi: "קאָמיקס",
    desc: { en: "Bold & dynamic", he: "נועז ודינמי", yi: "שטאַרק" }
  },
  {
    value: "storybook",
    emoji: "📖",
    image: "/images/style-storybook.jpg",
    color: "#8b5cf6",
    bg: "bg-violet-50 dark:bg-violet-950/30",
    border: "border-violet-200 dark:border-violet-700",
    en: "Storybook",
    he: "ספר ילדים קלאסי",
    yi: "מעשׂה-ביכל",
    desc: { en: "Classic & warm", he: "קלאסי וחמים", yi: "קלאַסיש" }
  },
  {
    value: "anime",
    emoji: "⭐",
    image: "/images/style-anime.jpg",
    color: "#ec4899",
    bg: "bg-pink-50 dark:bg-pink-950/30",
    border: "border-pink-200 dark:border-pink-700",
    en: "Anime/Manga",
    he: "אנימה/מנגה",
    yi: "אַנימע",
    desc: { en: "Japanese style", he: "סגנון יפני", yi: "יאַפּאַנישער סטיל" }
  },
  {
    value: "impressionist",
    emoji: "🌻",
    color: "#84cc16",
    bg: "bg-lime-50 dark:bg-lime-950/30",
    border: "border-lime-200 dark:border-lime-700",
    en: "Impressionist",
    he: "אימפרסיוניסטי",
    yi: "אימפּרעסיאָניסטיש",
    desc: { en: "Artistic & textured", he: "אמנותי ומרקמי", yi: "קינסטלעריש" }
  },
  {
    value: "pixar",
    emoji: "🎬",
    color: "#0ea5e9",
    bg: "bg-sky-50 dark:bg-sky-950/30",
    border: "border-sky-200 dark:border-sky-700",
    en: "Pixar 3D",
    he: "תלת מימד פיקסאר",
    yi: "פּיקסאַר 3D",
    desc: { en: "3D & expressive", he: "תלת-מימדי ומרגש", yi: "3D" }
  },
  {
    value: "minimalist",
    emoji: "⬜",
    color: "#94a3b8",
    bg: "bg-gray-50 dark:bg-gray-950/30",
    border: "border-gray-200 dark:border-gray-700",
    en: "Minimalist",
    he: "מינימליסטי",
    yi: "מינימאַליסטיש",
    desc: { en: "Clean & simple", he: "נקי ופשוט", yi: "פּשוט" }
  },
  {
    value: "vintage",
    emoji: "🕰️",
    color: "#92400e",
    bg: "bg-orange-50 dark:bg-orange-950/30",
    border: "border-orange-200 dark:border-orange-700",
    en: "Vintage",
    he: "וינטג'",
    yi: "וינטאַזש",
    desc: { en: "Nostalgic charm", he: "קסם נוסטלגי", yi: "נאָסטאַלגיש" }
  },
  {
    value: "fantasy",
    emoji: "🧚",
    image: "/images/style-fantasy.jpg",
    color: "#a855f7",
    bg: "bg-purple-50 dark:bg-purple-950/30",
    border: "border-purple-200 dark:border-purple-700",
    en: "Fantasy Art",
    he: "פנטזיה קסומה",
    yi: "פֿאַנטאַזיע",
    desc: { en: "Magical & enchanted", he: "קסום ומכושף", yi: "כּישופֿדיק" }
  },
  {
    value: "pop_art",
    emoji: "🎯",
    color: "#e11d48",
    bg: "bg-rose-50 dark:bg-rose-950/30",
    border: "border-rose-200 dark:border-rose-700",
    en: "Pop Art",
    he: "פופ ארט",
    yi: "פּאָפּ קונסט",
    desc: { en: "Bold & colorful", he: "נועז וצבעוני", yi: "שטאַרק" }
  },
  {
    value: "crayon",
    emoji: "🖍️",
    color: "#f97316",
    bg: "bg-orange-50 dark:bg-orange-950/30",
    border: "border-orange-200 dark:border-orange-700",
    en: "Crayon & Pastel",
    he: "צבעי פסטל",
    yi: "פּאַסטעל",
    desc: { en: "Soft & hand-drawn", he: "עדין ומצויר ביד", yi: "ווייך" }
  },
  {
    value: "collage",
    emoji: "✂️",
    color: "#14b8a6",
    bg: "bg-teal-50 dark:bg-teal-950/30",
    border: "border-teal-200 dark:border-teal-700",
    en: "Paper Collage",
    he: "קולאז' נייר",
    yi: "פּאַפּיר קאָלאַזש",
    desc: { en: "Textured & layered", he: "מרקמי ושכבות", yi: "טעקסטורירט" }
  },
  {
    value: "gouache",
    emoji: "🖌️",
    color: "#059669",
    bg: "bg-emerald-50 dark:bg-emerald-950/30",
    border: "border-emerald-200 dark:border-emerald-700",
    en: "Gouache Painting",
    he: "גואש",
    yi: "גואַש",
    desc: { en: "Rich & opaque", he: "עשיר ואטום", yi: "רייַך" }
  },
  {
    value: "chibi",
    emoji: "🌸",
    color: "#f472b6",
    bg: "bg-pink-50 dark:bg-pink-950/30",
    border: "border-pink-200 dark:border-pink-700",
    en: "Chibi",
    he: "צ'יבי (מיני אנימה)",
    yi: "טשיבי",
    desc: { en: "Cute & tiny", he: "חמוד וזעיר", yi: "חמודיק" }
  }
];

// Gradient swatches for each art style
const STYLE_GRADIENTS = {
  disney: "from-indigo-400 to-violet-500",
  watercolor: "from-cyan-400 to-sky-500",
  cartoon: "from-yellow-400 to-orange-500",
  realistic: "from-slate-400 to-gray-500",
  comic: "from-red-400 to-rose-500",
  storybook: "from-violet-400 to-purple-500",
  anime: "from-pink-400 to-fuchsia-500",
  impressionist: "from-lime-400 to-green-500",
  pixar: "from-sky-400 to-blue-500",
  minimalist: "from-gray-300 to-slate-400",
  vintage: "from-amber-500 to-orange-600",
  fantasy: "from-purple-400 to-violet-600",
  pop_art: "from-rose-500 to-red-600",
  crayon: "from-orange-400 to-amber-500",
  collage: "from-teal-400 to-cyan-500",
  gouache: "from-emerald-400 to-green-600",
  chibi: "from-pink-300 to-rose-400",
};

// Surprise Me auto-fill: picks random art style, length, tone, age range
const RANDOM_TONES = ["exciting", "funny", "calm", "mysterious", "educational"];
const RANDOM_LENGTHS = ["short", "medium", "long"];
const RANDOM_AGES = ["3-5", "5-7", "7-10"];

function getStyleLabel(style, t) {
  return t("illustrationStyles." + style.value + ".name") || style.en;
}

function getStyleDesc(style, t) {
  return t("illustrationStyles." + style.value + ".desc") || style.desc.en;
}

/**
 * PreviewEditStep - Step 3 of the wizard: Preview and edit the story outline.
 * Shows generated story details with edit capability.
 * Art style selection uses visual preview cards instead of plain text buttons.
 */
export default function PreviewEditStep({
  bookData,
  onBookDataChange,
  generatedOutline,
  isGeneratingOutline,
  onRegenerateOutline,
  isRTL,
  language,
  useRhyming = false,
  onUseRhymingChange,
  rhymeSettings,
  onRhymeSettingsChange
}) {
  const { t } = useI18n();
  const isHebrew = language === "hebrew";
  const isYiddish = language === "yiddish";
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleSurpriseMe = () => {
    const styleValues = ART_STYLE_VISUAL.map((s) => s.value);
    onBookDataChange("art_style", styleValues[Math.floor(Math.random() * styleValues.length)]);
    onBookDataChange("length", RANDOM_LENGTHS[Math.floor(Math.random() * RANDOM_LENGTHS.length)]);
    onBookDataChange("tone", RANDOM_TONES[Math.floor(Math.random() * RANDOM_TONES.length)]);
    onBookDataChange("age_range", RANDOM_AGES[Math.floor(Math.random() * RANDOM_AGES.length)]);
  };

  // Loading skeleton
  if (isGeneratingOutline) {
    return (
      <div className="space-y-6" dir={isRTL ? "rtl" : "ltr"}>
        <div className="text-center mb-6">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-2">
            {t("wizard.preview.preparingStory")}
          </h2>
          <p className="text-gray-500 dark:text-gray-400 text-lg">
            {t("wizard.preview.aiCrafting")}
          </p>
        </div>

        <Card>
          <CardContent className="p-6 space-y-4">
            <Skeleton className="h-8 w-3/4 mx-auto" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-4/6" />
            <div className="pt-4 space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-4/6" />
            </div>
            <div className="flex justify-center pt-6">
              <div className="flex items-center gap-2 text-purple-600">
                <RefreshCw className="h-5 w-5 animate-spin" aria-hidden="true" />
                <span className="text-sm font-medium">
                  {t("wizard.preview.generatingStory")}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5" dir={isRTL ? "rtl" : "ltr"}>
      <div className="text-center mb-4">
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-2">
            {t("wizard.preview.title")}
          </h2>
        </motion.div>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
        >
          <p className="text-gray-500 dark:text-gray-400 text-base">
            {t("wizard.preview.subtitle")}
          </p>
        </motion.div>
      </div>

      {/* Surprise Me! — auto-fill art style, length, tone */}
      <div className="flex justify-center">
        <motion.button
          onClick={handleSurpriseMe}
          whileHover={{ scale: 1.05, y: -2 }}
          whileTap={{ scale: 0.95 }}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="
            relative flex items-center gap-3 px-6 py-3 rounded-2xl font-bold text-sm
            bg-gradient-to-r from-amber-400 via-orange-400 to-pink-400
            text-white shadow-md shadow-orange-200/50
            hover:shadow-lg hover:shadow-orange-300/50
            transition-shadow duration-200 overflow-hidden
          "
          aria-label={t("wizard.preview.surpriseMeLabel")}
        >
          <motion.div
            className="absolute inset-0 bg-white/25 skew-x-12"
            animate={{ x: ["-200%", "300%"] }}
            transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 2.5, ease: "easeInOut" }}
            aria-hidden="true"
          />
          <Shuffle className="h-4 w-4 relative z-10" aria-hidden="true" />
          <span className="relative z-10">
            {t("wizard.preview.surpriseMe")}
          </span>
          <Wand2 className="h-4 w-4 relative z-10" aria-hidden="true" />
        </motion.button>
      </div>

      {/* Story Title */}
      <Card>
        <CardHeader>
          <CardTitle className={`flex items-center gap-2 text-lg ${isRTL ? "flex-row-reverse" : ""}`}>
            <BookOpen className="h-5 w-5 text-purple-600" aria-hidden="true" />
            {t("wizard.preview.storyTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Input
            value={bookData.title || ""}
            onChange={(e) => onBookDataChange("title", e.target.value)}
            placeholder={t("wizard.preview.storyTitlePlaceholder")}
            dir={isRTL ? "rtl" : "ltr"}
            className="text-lg font-semibold"
            maxLength={100}
            aria-label={t("wizard.preview.storyTitle")}
          />
        </CardContent>
      </Card>

      {/* Story Description */}
      <Card>
        <CardHeader>
          <CardTitle className={`flex items-center gap-2 text-lg ${isRTL ? "flex-row-reverse" : ""}`}>
            <Edit3 className="h-5 w-5 text-blue-600" aria-hidden="true" />
            {t("wizard.preview.storyDescription")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={bookData.description || ""}
            onChange={(e) => onBookDataChange("description", e.target.value)}
            placeholder={t("wizard.preview.storyDescPlaceholder")}
            dir={isRTL ? "rtl" : "ltr"}
            rows={4}
            maxLength={500}
            className="resize-none"
            aria-label={t("wizard.preview.storyDescription")}
          />

          {/* Moral / Lesson */}
          <div>
            <Label className="mb-1 block text-sm font-medium">
              {t("wizard.preview.moral")}
            </Label>
            <Input
              value={bookData.moral || ""}
              onChange={(e) => onBookDataChange("moral", e.target.value)}
              placeholder={t("wizard.preview.moralPlaceholder")}
              dir={isRTL ? "rtl" : "ltr"}
              maxLength={200}
              aria-label={t("wizard.preview.moral")}
            />
          </div>
        </CardContent>
      </Card>

      {/* Language Selector */}
      <Card>
        <CardContent className="p-4">
          <div className={`flex items-center gap-4 ${isRTL ? "flex-row-reverse" : ""}`}>
            <Globe className="h-5 w-5 text-blue-600 flex-shrink-0" aria-hidden="true" />
            <Label className="text-sm font-medium whitespace-nowrap">
              {t("wizard.preview.storyLanguage")}
            </Label>
            <Select
              value={bookData.language || "english"}
              onValueChange={(value) => onBookDataChange("language", value)}
            >
              <SelectTrigger className="w-[160px]" aria-label={t("wizard.preview.selectLanguage")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="english">{t("common.languageNames.english")}</SelectItem>
                <SelectItem value="hebrew">{t("common.languageNames.hebrew")}</SelectItem>
                <SelectItem value="yiddish">{t("common.languageNames.yiddish")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Art Style Selection — Visual Preview Cards */}
      <Card>
        <CardHeader>
          <CardTitle className={`flex items-center gap-2 text-lg ${isRTL ? "flex-row-reverse" : ""}`}>
            <Sparkles className="h-5 w-5 text-amber-500" aria-hidden="true" />
            {t("wizard.preview.artStyle")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3"
            role="radiogroup"
            aria-label={t("wizard.preview.selectArtStyle")}
          >
            {ART_STYLE_VISUAL.map((style, index) => {
              const isSelected = bookData.art_style === style.value;
              const grad = STYLE_GRADIENTS[style.value] || "from-gray-400 to-slate-500";
              return (
                <motion.button
                  key={style.value}
                  onClick={() => onBookDataChange("art_style", style.value)}
                  role="radio"
                  aria-checked={isSelected}
                  aria-label={getStyleLabel(style, t)}
                  whileHover={{ scale: 1.04, y: -2 }}
                  whileTap={{ scale: 0.96 }}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.02 }}
                  className={`
                    relative p-3 rounded-2xl text-left cursor-pointer overflow-hidden
                    ${style.bg}
                    transition-all duration-150
                    ${isSelected
                      ? "ring-2 ring-purple-500 shadow-lg shadow-purple-200/50"
                      : `border border-transparent hover:border-gray-200 dark:hover:border-gray-600 shadow-sm hover:shadow-md`
                    }
                  `}
                >
                  {/* Selected checkmark */}
                  <div
                    className={`absolute top-2 right-2 w-5 h-5 bg-purple-600 rounded-full flex items-center justify-center transition-all duration-150 shadow-sm ${isSelected ? "opacity-100 scale-100" : "opacity-0 scale-50 pointer-events-none"}`}
                    aria-hidden="true"
                  >
                    <Check className="h-3 w-3 text-white" />
                  </div>

                  <div className="flex flex-col items-start gap-1">
                    {/* Image preview or gradient swatch fallback */}
                    {style.image ? (
                      <img
                        src={style.image}
                        alt=""
                        aria-hidden="true"
                        className="w-10 h-10 rounded-xl object-cover mb-2 shadow-md"
                      />
                    ) : (
                      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${grad} flex items-center justify-center mb-2 shadow-md`}>
                        <span className="text-xl leading-none drop-shadow-sm" aria-hidden="true">
                          {style.emoji}
                        </span>
                      </div>
                    )}

                    {/* Style name */}
                    <span className={`text-xs font-bold leading-tight ${isSelected ? "text-purple-800 dark:text-purple-200" : "text-gray-800 dark:text-gray-200"}`}>
                      {getStyleLabel(style, t)}
                    </span>

                    {/* Short description */}
                    <span className={`text-xs leading-tight ${isSelected ? "text-purple-600 dark:text-purple-300" : "text-gray-500 dark:text-gray-400"}`}>
                      {getStyleDesc(style, t)}
                    </span>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Story Length Selection — visual pill buttons */}
      <Card>
        <CardContent className="p-4">
          <div className={`flex items-center gap-4 flex-wrap ${isRTL ? "flex-row-reverse" : ""}`}>
            <Label className="text-sm font-semibold whitespace-nowrap">
              {t("wizard.preview.storyLength")}
            </Label>
            <div className={`flex gap-2 flex-wrap ${isRTL ? "flex-row-reverse" : ""}`}>
              {[
                { value: "short", label: t("wizard.preview.lengthShort") },
                { value: "medium", label: t("wizard.preview.lengthMedium") },
                { value: "long", label: t("wizard.preview.lengthLong") }
              ].map((opt) => (
                <motion.button
                  key={opt.value}
                  onClick={() => onBookDataChange("length", opt.value)}
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.96 }}
                  className={`px-3 py-2 rounded-xl text-sm font-semibold transition-all duration-150 ${
                    (bookData.length || "medium") === opt.value
                      ? "bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-md shadow-purple-200/50"
                      : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                  }`}
                >
                  {opt.label}
                </motion.button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Rhyming Options */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className={`flex items-center gap-3 ${isRTL ? "flex-row-reverse" : ""}`}>
            <Music className="h-5 w-5 text-purple-500 flex-shrink-0" aria-hidden="true" />
            <Label htmlFor="use-rhyming-wizard" className="text-sm font-medium flex-1">
              {t("wizard.preview.rhymingStory")}
            </Label>
            <Switch
              id="use-rhyming-wizard"
              checked={useRhyming}
              onCheckedChange={onUseRhymingChange}
              aria-label={t("wizard.preview.enableRhyming")}
            />
          </div>
          {useRhyming && rhymeSettings && onRhymeSettingsChange && (
            <div className="pt-1">
              <RhymeOptions
                rhymeSettings={rhymeSettings}
                setRhymeSettings={onRhymeSettingsChange}
                currentLanguage={language}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Advanced Toggle */}
      <div className="flex justify-center">
        <Button
          variant="ghost"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-gray-600 dark:text-gray-400 hover:text-purple-600 gap-2"
          aria-expanded={showAdvanced}
        >
          <Settings2 className="h-4 w-4" aria-hidden="true" />
          {t("wizard.preview.advancedToggle")}
          <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${showAdvanced ? "rotate-180" : ""}`} aria-hidden="true" />
        </Button>
      </div>

      <AnimatePresence>
        {showAdvanced && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden space-y-4"
          >
            {/* Tone */}
            <Card>
              <CardContent className="p-4">
                <div className={`flex items-center gap-4 ${isRTL ? "flex-row-reverse" : ""}`}>
                  <Label className="text-sm font-medium whitespace-nowrap">
                    {t("wizard.preview.tone")}
                  </Label>
                  <Select
                    value={bookData.tone || "exciting"}
                    onValueChange={(value) => onBookDataChange("tone", value)}
                  >
                    <SelectTrigger className="w-[180px]" aria-label={t("wizard.preview.selectTone")}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="exciting">{t("wizard.preview.toneExciting")}</SelectItem>
                      <SelectItem value="calm">{t("wizard.preview.toneCalm")}</SelectItem>
                      <SelectItem value="funny">{t("wizard.preview.toneFunny")}</SelectItem>
                      <SelectItem value="educational">{t("wizard.preview.toneEducational")}</SelectItem>
                      <SelectItem value="mysterious">{t("wizard.preview.toneMysterious")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Age Range */}
            <Card>
              <CardContent className="p-4">
                <div className={`flex items-center gap-4 ${isRTL ? "flex-row-reverse" : ""}`}>
                  <Label className="text-sm font-medium whitespace-nowrap">
                    {t("wizard.preview.ageRange")}
                  </Label>
                  <Select
                    value={bookData.age_range || "5-7"}
                    onValueChange={(value) => onBookDataChange("age_range", value)}
                  >
                    <SelectTrigger className="w-[180px]" aria-label={t("wizard.preview.ageRange")}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="3-5">{t("wizard.preview.age3to5")}</SelectItem>
                      <SelectItem value="5-7">{t("wizard.preview.age5to7")}</SelectItem>
                      <SelectItem value="7-10">{t("wizard.preview.age7to10")}</SelectItem>
                      <SelectItem value="10-12">{t("wizard.preview.age10to12")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Detailed Moral */}
            <Card>
              <CardContent className="p-4 space-y-2">
                <Label className="text-sm font-medium block">
                  {t("wizard.preview.moralDetail")}
                </Label>
                <Textarea
                  value={bookData.moral_detail || ""}
                  onChange={(e) => onBookDataChange("moral_detail", e.target.value)}
                  placeholder={t("wizard.preview.moralDetailPlaceholder")}
                  dir={isRTL ? "rtl" : "ltr"}
                  rows={2}
                  maxLength={300}
                  className="resize-none"
                  aria-label={t("wizard.preview.moralDetail")}
                />
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Regenerate button */}
      {onRegenerateOutline && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={onRegenerateOutline}
            disabled={isGeneratingOutline}
            className="gap-2"
            aria-label={t("wizard.preview.newIdeaLabel")}
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            {t("wizard.preview.newIdea")}
          </Button>
        </div>
      )}
    </div>
  );
}
