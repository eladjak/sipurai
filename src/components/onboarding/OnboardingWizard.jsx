import React, { useState } from "react";
import { User } from "@/entities/User";
import { useI18n } from "@/components/i18n/i18nProvider";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  BookOpen,
  Globe,
  Heart,
  ArrowRight,
  ArrowLeft,
  Check,
  Loader2,
  Baby,
  BookMarked,
  Backpack,
  GraduationCap,
  UserCheck,
  CheckSquare
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

// Step order: language → welcome → profile → topics
const STEPS = [
  { id: "language", icon: Globe },
  { id: "welcome", icon: Sparkles },
  { id: "profile", icon: BookOpen },
  { id: "topics", icon: Heart }
];

const LANGUAGES = [
  { id: "english", label: "English", flag: "EN", gradient: "from-blue-500 to-cyan-500" },
  { id: "hebrew", label: "עברית", flag: "HE", gradient: "from-purple-500 to-indigo-500" },
  { id: "yiddish", label: "ייִדיש", flag: "YI", gradient: "from-amber-500 to-orange-500" }
];

const TOPICS = [
  { id: "adventure", labelEn: "Adventure", labelHe: "הרפתקאות", emoji: "🗺️", gradient: "from-orange-400 to-red-500" },
  { id: "fantasy", labelEn: "Fantasy", labelHe: "פנטזיה", emoji: "🧙", gradient: "from-purple-400 to-indigo-500" },
  { id: "animals", labelEn: "Animals", labelHe: "חיות", emoji: "🦁", gradient: "from-green-400 to-teal-500" },
  { id: "science", labelEn: "Science", labelHe: "מדע", emoji: "🔬", gradient: "from-blue-400 to-cyan-500" },
  { id: "fairy_tale", labelEn: "Fairy Tales", labelHe: "אגדות", emoji: "🏰", gradient: "from-pink-400 to-rose-500" },
  { id: "family", labelEn: "Family", labelHe: "משפחה", emoji: "👨‍👩‍👧", gradient: "from-yellow-400 to-amber-500" },
  { id: "friendship", labelEn: "Friendship", labelHe: "חברות", emoji: "🤝", gradient: "from-teal-400 to-green-500" },
  { id: "nature", labelEn: "Nature", labelHe: "טבע", emoji: "🌿", gradient: "from-emerald-400 to-lime-500" },
  { id: "humor", labelEn: "Humor", labelHe: "הומור", emoji: "😄", gradient: "from-yellow-400 to-orange-500" },
  { id: "bedtime", labelEn: "Bedtime", labelHe: "לפני השינה", emoji: "🌙", gradient: "from-indigo-400 to-purple-500" },
  { id: "sports", labelEn: "Sports", labelHe: "ספורט", emoji: "⚽", gradient: "from-cyan-400 to-blue-500" },
  { id: "magic", labelEn: "Magic", labelHe: "קסם", emoji: "✨", gradient: "from-violet-400 to-purple-600" }
];

const AGE_RANGES = [
  { id: "2-4", label: "2-4", icon: Baby, gradient: "from-pink-400 to-rose-500", description: "Toddler", descriptionHe: "פעוטות" },
  { id: "5-7", label: "5-7", icon: Backpack, gradient: "from-yellow-400 to-orange-500", description: "Early reader", descriptionHe: "מתחילים" },
  { id: "8-10", label: "8-10", icon: BookMarked, gradient: "from-green-400 to-teal-500", description: "Reader", descriptionHe: "קוראים" },
  { id: "11-13", label: "11-13", icon: GraduationCap, gradient: "from-blue-400 to-indigo-500", description: "Pre-teen", descriptionHe: "גיל ההתבגרות" },
  { id: "14-17", label: "14-17", icon: BookOpen, gradient: "from-purple-400 to-violet-500", description: "Teen", descriptionHe: "נוער" },
  { id: "parent", label: "Parent", labelHe: "הורה/מבוגר", icon: UserCheck, gradient: "from-indigo-400 to-blue-600", description: "Parent / Adult", descriptionHe: "הורה/מבוגר" }
];

const translations = {
  english: {
    "welcome.title": "Welcome to Sipurai!",
    "welcome.subtitle": "Let's set up your magical book studio",
    "welcome.start": "Let's Go!",
    "profile.title": "Tell Us About You",
    "profile.name": "Your Name",
    "profile.namePlaceholder": "Enter your name...",
    "profile.age": "Age Range",
    "language.title": "Choose Your Language",
    "language.subtitle": "Everything will appear in your language",
    "topics.title": "What Do You Love?",
    "topics.subtitle": "Pick your favorite topics (at least 1)",
    "topics.selectAll": "Select All",
    "topics.clearAll": "Clear All",
    "finish": "Start Creating!",
    "next": "Next",
    "back": "Back",
    "skip": "Skip for now"
  },
  hebrew: {
    "welcome.title": "!Sipurai-ברוכים הבאים ל",
    "welcome.subtitle": "בואו נקים את סטודיו הספרים הקסום שלכם",
    "welcome.start": "!יאללה",
    "profile.title": "ספרו לנו על עצמכם",
    "profile.name": "השם שלך",
    "profile.namePlaceholder": "...הכניסו את שמכם",
    "profile.age": "טווח גילאים",
    "language.title": "בחרו שפה",
    "language.subtitle": "הכל יוצג בשפה שלכם",
    "topics.title": "?מה אתם אוהבים",
    "topics.subtitle": "(בחרו נושאים מועדפים (לפחות 1",
    "topics.selectAll": "בחר הכל",
    "topics.clearAll": "נקה הכל",
    "finish": "!בואו ליצור",
    "next": "הבא",
    "back": "חזרה",
    "skip": "דלג לעת עתה"
  },
  yiddish: {
    "welcome.title": "!Sipurai-ברוכים הבאים ל",
    "welcome.subtitle": "לאמיר אויפשטעלן אייער ביכל סטודיאָ",
    "welcome.start": "!לאָמיר גיין",
    "profile.title": "דערציילט אונדז וועגן זיך",
    "profile.name": "אייער נאָמען",
    "profile.namePlaceholder": "...שרייבט אייער נאָמען",
    "profile.age": "עלטער",
    "language.title": "קלויבט שפּראַך",
    "language.subtitle": "אַלץ וועט דערשיינען אין אייער שפּראַך",
    "topics.title": "?וואָס האָט איר ליב",
    "topics.subtitle": "(קלויבט ליבלינגס טעמעס (מינדסטנס 1",
    "topics.selectAll": "קלויבט אַלץ",
    "topics.clearAll": "לייד אויס אַלץ",
    "finish": "!לאָמיר שאַפֿן",
    "next": "ווייטער",
    "back": "צוריק",
    "skip": "אויסלאָזן פֿאַר איצט"
  }
};

const OnboardingWizard = React.memo(function OnboardingWizard({ onComplete, userName }) {
  // NOTE: Language is now step 0 so the user immediately sees the UI in their
  // chosen language for all subsequent steps. RTL applies from step 0 onward.
  const { changeLanguage } = useI18n();
  const [step, setStep] = useState(0);
  const [name, setName] = useState(userName || "");
  const [ageRange, setAgeRange] = useState("");
  const [language, setLanguage] = useState(() => {
    // Auto-detect from browser language; fallback to English
    const nav = (navigator.language || navigator.userLanguage || '').toLowerCase();
    if (nav.startsWith('he')) return 'hebrew';
    if (nav.startsWith('yi')) return 'yiddish';
    return 'english';
  });
  const [selectedTopics, setSelectedTopics] = useState([]);
  const [isSaving, setIsSaving] = useState(false);

  // RTL applies as soon as the user picks Hebrew/Yiddish in step 0
  const isRTL = language === "hebrew" || language === "yiddish";
  const t = (key) => translations[language]?.[key] || translations.english[key] || key;

  const toggleTopic = (topicId) => {
    setSelectedTopics(prev =>
      prev.includes(topicId)
        ? prev.filter(id => id !== topicId)
        : [...prev, topicId]
    );
  };

  const selectAllTopics = () => {
    setSelectedTopics(TOPICS.map(t => t.id));
  };

  const clearAllTopics = () => {
    setSelectedTopics([]);
  };

  const canAdvance = () => {
    // step 2 = profile (name required)
    if (step === 2) return name.trim().length > 0;
    // step 3 = topics (at least 1 required)
    if (step === 3) return selectedTopics.length > 0;
    return true;
  };

  const handleFinish = async () => {
    setIsSaving(true);
    // Apply language change to the global i18n provider immediately so the
    // app renders in the correct language/direction right after onboarding.
    await changeLanguage(language);
    try {
      await User.updateMyUserData({
        display_name: name.trim(),
        preferred_age_range: ageRange,
        preferred_language: language,
        language: language,
        favorite_topics: selectedTopics
      });

      localStorage.setItem("language", language);
      localStorage.setItem("onboarding_complete", "true");
      localStorage.setItem("preferredAgeRange", ageRange);
      localStorage.setItem("favoriteTopics", JSON.stringify(selectedTopics));

      onComplete?.();
    } catch {
      // Still mark complete even if profile update fails (Base44 may not support all fields)
      localStorage.setItem("language", language);
      localStorage.setItem("onboarding_complete", "true");
      localStorage.setItem("preferredAgeRange", ageRange);
      localStorage.setItem("favoriteTopics", JSON.stringify(selectedTopics));
      onComplete?.();
    } finally {
      setIsSaving(false);
    }
  };

  const handleNext = () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      handleFinish();
    }
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
  };

  const slideVariants = {
    enter: (direction) => ({ x: direction > 0 ? 200 : -200, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (direction) => ({ x: direction > 0 ? -200 : 200, opacity: 0 })
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <Card className="w-full max-w-lg overflow-hidden" dir={isRTL ? "rtl" : "ltr"}>
        {/* Progress bar */}
        <div className="flex gap-1 p-3 bg-gray-50 dark:bg-gray-900">
          {STEPS.map((s, i) => (
            <div
              key={s.id}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                i <= step ? "bg-purple-500" : "bg-gray-200 dark:bg-gray-700"
              }`}
            />
          ))}
        </div>

        <CardContent className="p-6 min-h-[360px] flex flex-col">
          <AnimatePresence mode="wait" custom={1}>
            <motion.div
              key={step}
              custom={1}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.2 }}
              className="flex-1"
            >
              {/* Step 0: Language Selection — first so all following steps are in user's language */}
              {step === 0 && (
                <div className="space-y-5">
                  <div className="text-center mb-2">
                    <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
                      <Globe className="h-7 w-7 text-white" />
                    </div>
                    <h2 className="text-xl font-bold">
                      {translations[language]?.["language.title"] || "Choose Your Language"}
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">
                      {translations[language]?.["language.subtitle"] || "Everything will appear in your language"}
                    </p>
                  </div>
                  <div className="space-y-3">
                    {LANGUAGES.map(lang => (
                      <button
                        key={lang.id}
                        className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${
                          language === lang.id
                            ? "border-purple-500 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-950/30 dark:to-indigo-950/30 shadow-md"
                            : "border-gray-200 dark:border-gray-700 hover:border-purple-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                        }`}
                        onClick={() => setLanguage(lang.id)}
                      >
                        <div className={`w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold text-white bg-gradient-to-br ${lang.gradient} shadow-sm`}>
                          {lang.flag}
                        </div>
                        <span className="text-lg font-semibold">{lang.label}</span>
                        {language === lang.id && (
                          <div className="ms-auto w-6 h-6 rounded-full bg-purple-500 flex items-center justify-center">
                            <Check className="h-3.5 w-3.5 text-white" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 1: Welcome */}
              {step === 1 && (
                <div className="text-center py-6">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", delay: 0.1 }}
                  >
                    <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg">
                      <Sparkles className="h-10 w-10 text-white" />
                    </div>
                  </motion.div>
                  <h2 className="text-2xl font-bold mb-3">{t("welcome.title")}</h2>
                  <p className="text-gray-500 dark:text-gray-400 mb-8">{t("welcome.subtitle")}</p>
                  <Button
                    onClick={handleNext}
                    className="bg-gradient-to-r from-purple-600 to-indigo-600 px-8 shadow-md"
                    size="lg"
                  >
                    {t("welcome.start")}
                    <ArrowRight className={`h-4 w-4 ${isRTL ? "me-2 rotate-180" : "ms-2"}`} />
                  </Button>
                </div>
              )}

              {/* Step 2: Profile */}
              {step === 2 && (
                <div className="space-y-5">
                  <div className="text-center mb-2">
                    <h2 className="text-xl font-bold">{t("profile.title")}</h2>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">{t("profile.name")}</label>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={t("profile.namePlaceholder")}
                      className="text-lg"
                      autoFocus
                      dir={isRTL ? "rtl" : "ltr"}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-3">{t("profile.age")}</label>
                    <div className="grid grid-cols-3 gap-2">
                      {AGE_RANGES.map(range => {
                        const AgeIcon = range.icon;
                        const isSelected = ageRange === range.id;
                        return (
                          <button
                            key={range.id}
                            onClick={() => setAgeRange(range.id)}
                            className={`relative flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all ${
                              isSelected
                                ? "border-transparent shadow-md scale-105"
                                : "border-gray-200 dark:border-gray-700 hover:border-purple-300 hover:scale-102"
                            }`}
                          >
                            {isSelected && (
                              <div className={`absolute inset-0 rounded-xl bg-gradient-to-br ${range.gradient} opacity-15`} />
                            )}
                            <div className={`w-9 h-9 rounded-full flex items-center justify-center bg-gradient-to-br ${range.gradient} shadow-sm`}>
                              <AgeIcon className="h-4.5 w-4.5 text-white" />
                            </div>
                            <span className={`text-sm font-bold ${isSelected ? "text-purple-700 dark:text-purple-300" : "text-gray-700 dark:text-gray-200"}`}>
                              {isRTL && range.labelHe ? range.labelHe : range.label}
                            </span>
                            <span className="text-xs text-gray-400 dark:text-gray-500">
                              {isRTL ? range.descriptionHe : range.description}
                            </span>
                            {isSelected && (
                              <div className="absolute top-1.5 end-1.5 w-4 h-4 rounded-full bg-purple-500 flex items-center justify-center">
                                <Check className="h-2.5 w-2.5 text-white" />
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Step 3: Topics */}
              {step === 3 && (
                <div className="space-y-3">
                  <div className="text-center mb-1">
                    <h2 className="text-xl font-bold">{t("topics.title")}</h2>
                    <p className="text-sm text-gray-500 mt-1">{t("topics.subtitle")}</p>
                  </div>
                  {/* Select All / Clear All */}
                  <div className="flex justify-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={selectAllTopics}
                      className="text-xs border-purple-300 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/20"
                    >
                      <CheckSquare className={`h-3.5 w-3.5 ${isRTL ? "ms-1" : "me-1"}`} />
                      {t("topics.selectAll")}
                    </Button>
                    {selectedTopics.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearAllTopics}
                        className="text-xs text-gray-400 hover:text-gray-600"
                      >
                        {t("topics.clearAll")}
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {TOPICS.map(topic => {
                      const isSelected = selectedTopics.includes(topic.id);
                      return (
                        <button
                          key={topic.id}
                          onClick={() => toggleTopic(topic.id)}
                          className={`relative flex flex-col items-center gap-1 p-2.5 rounded-xl border-2 transition-all ${
                            isSelected
                              ? "border-transparent shadow-md scale-105"
                              : "border-gray-200 dark:border-gray-700 hover:border-purple-300 hover:scale-102"
                          }`}
                        >
                          {isSelected && (
                            <div className={`absolute inset-0 rounded-xl bg-gradient-to-br ${topic.gradient} opacity-15`} />
                          )}
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center text-lg bg-gradient-to-br ${isSelected ? topic.gradient : "from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600"} shadow-sm transition-all`}>
                            {topic.emoji}
                          </div>
                          <span className={`text-xs font-medium text-center leading-tight ${isSelected ? "text-purple-700 dark:text-purple-300" : "text-gray-600 dark:text-gray-300"}`}>
                            {isRTL ? topic.labelHe : topic.labelEn}
                          </span>
                          {isSelected && (
                            <div className="absolute top-1 end-1 w-4 h-4 rounded-full bg-purple-500 flex items-center justify-center">
                              <Check className="h-2.5 w-2.5 text-white" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Navigation buttons:
              step 0 (language) → Next only (no back on first step)
              step 1 (welcome)  → hidden (welcome has its own "Let's Go!" button)
              step 2-3          → Back + Next/Finish */}
          {step !== 1 && (
            <div className="flex justify-between items-center mt-4 pt-4 border-t">
              {/* Back button — hidden on step 0 */}
              {step > 0 ? (
                <Button variant="ghost" size="sm" onClick={handleBack}>
                  <ArrowLeft className={`h-4 w-4 ${isRTL ? "ms-1 rotate-180" : "me-1"}`} />
                  {t("back")}
                </Button>
              ) : (
                <span />
              )}

              <div className="flex gap-2">
                {/* Skip only on non-required middle steps (not step 0 lang, not last step) */}
                {step > 0 && step < STEPS.length - 1 && (
                  <Button variant="ghost" size="sm" onClick={() => setStep(step + 1)}>
                    {t("skip")}
                  </Button>
                )}
                <Button
                  onClick={handleNext}
                  disabled={!canAdvance() || isSaving}
                  className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 shadow-sm"
                >
                  {step === STEPS.length - 1 ? (
                    <>
                      {isSaving ? (
                        <Loader2 className={`h-4 w-4 animate-spin ${isRTL ? "ms-1" : "me-1"}`} />
                      ) : (
                        <Check className={`h-4 w-4 ${isRTL ? "ms-1" : "me-1"}`} />
                      )}
                      {t("finish")}
                    </>
                  ) : (
                    <>
                      {t("next")}
                      <ArrowRight className={`h-4 w-4 ${isRTL ? "me-1 rotate-180" : "ms-1"}`} />
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
});

export default OnboardingWizard;
