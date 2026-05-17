import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Cat,
  Rocket,
  Users,
  Sparkles,
  TreePine,
  Crown,
  Compass,
  GraduationCap,
  Heart,
  Music,
  Palette,
  Globe,
  PenLine,
  Lightbulb,
  Shuffle,
  Wand2
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { StoryIdea } from "@/entities/StoryIdea";
import { useI18n } from "@/components/i18n/i18nProvider";

/**
 * Topic cards data with icons, colors, and Hebrew/English labels.
 */
const TOPIC_CARDS = [
  {
    id: "animals",
    icon: Cat,
    image: "/images/topic-animals.jpg",
    gradient: "from-amber-400 via-orange-400 to-red-400",
    bgCard: "from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/40",
    ring: "ring-amber-400",
    shadowColor: "shadow-amber-200/60",
    en: "Animals",
    he: "חיות",
    yi: "חיות"
  },
  {
    id: "space",
    icon: Rocket,
    image: "/images/topic-space.jpg",
    gradient: "from-indigo-500 via-purple-500 to-violet-600",
    bgCard: "from-indigo-50 to-purple-50 dark:from-indigo-950/40 dark:to-purple-950/40",
    ring: "ring-indigo-400",
    shadowColor: "shadow-indigo-200/60",
    en: "Space",
    he: "חלל",
    yi: "חלל"
  },
  {
    id: "family",
    icon: Users,
    image: "/images/topic-family.jpg",
    gradient: "from-pink-400 via-rose-400 to-red-400",
    bgCard: "from-pink-50 to-rose-50 dark:from-pink-950/40 dark:to-rose-950/40",
    ring: "ring-pink-400",
    shadowColor: "shadow-pink-200/60",
    en: "Family",
    he: "משפחה",
    yi: "משפּחה"
  },
  {
    id: "fairy_tale",
    icon: Crown,
    image: "/images/topic-fairy-tale.jpg",
    gradient: "from-yellow-400 via-amber-400 to-orange-400",
    bgCard: "from-yellow-50 to-amber-50 dark:from-yellow-950/40 dark:to-amber-950/40",
    ring: "ring-yellow-400",
    shadowColor: "shadow-yellow-200/60",
    en: "Fairy Tales",
    he: "אגדות",
    yi: "מעשׂיות"
  },
  {
    id: "adventure",
    icon: Compass,
    image: "/images/topic-adventure.jpg",
    gradient: "from-emerald-400 via-green-400 to-teal-500",
    bgCard: "from-emerald-50 to-green-50 dark:from-emerald-950/40 dark:to-green-950/40",
    ring: "ring-emerald-400",
    shadowColor: "shadow-emerald-200/60",
    en: "Adventure",
    he: "הרפתקאות",
    yi: "אַוואַנטורעס"
  },
  {
    id: "nature",
    icon: TreePine,
    image: "/images/topic-nature.jpg",
    gradient: "from-green-400 via-teal-400 to-cyan-500",
    bgCard: "from-green-50 to-teal-50 dark:from-green-950/40 dark:to-teal-950/40",
    ring: "ring-green-400",
    shadowColor: "shadow-green-200/60",
    en: "Nature",
    he: "טבע",
    yi: "נאַטור"
  },
  {
    id: "science",
    icon: GraduationCap,
    image: "/images/topic-science.jpg",
    gradient: "from-cyan-400 via-blue-400 to-indigo-500",
    bgCard: "from-cyan-50 to-blue-50 dark:from-cyan-950/40 dark:to-blue-950/40",
    ring: "ring-cyan-400",
    shadowColor: "shadow-cyan-200/60",
    en: "Science",
    he: "מדע",
    yi: "וויסנשאַפֿט"
  },
  {
    id: "magic",
    icon: Sparkles,
    image: "/images/topic-magic.jpg",
    gradient: "from-violet-500 via-purple-500 to-fuchsia-500",
    bgCard: "from-violet-50 to-fuchsia-50 dark:from-violet-950/40 dark:to-fuchsia-950/40",
    ring: "ring-violet-400",
    shadowColor: "shadow-violet-200/60",
    en: "Magic",
    he: "קסמים",
    yi: "כּישוף"
  },
  {
    id: "friendship",
    icon: Heart,
    image: "/images/topic-friendship.jpg",
    gradient: "from-rose-400 via-pink-400 to-fuchsia-400",
    bgCard: "from-rose-50 to-pink-50 dark:from-rose-950/40 dark:to-pink-950/40",
    ring: "ring-rose-400",
    shadowColor: "shadow-rose-200/60",
    en: "Friendship",
    he: "חברות",
    yi: "פֿרײַנדשאַפֿט"
  },
  {
    id: "music",
    icon: Music,
    image: "/images/topic-music.jpg",
    gradient: "from-fuchsia-400 via-purple-400 to-violet-500",
    bgCard: "from-fuchsia-50 to-purple-50 dark:from-fuchsia-950/40 dark:to-purple-950/40",
    ring: "ring-fuchsia-400",
    shadowColor: "shadow-fuchsia-200/60",
    en: "Music",
    he: "מוזיקה",
    yi: "מוזיק"
  },
  {
    id: "art",
    icon: Palette,
    image: "/images/topic-art.jpg",
    gradient: "from-orange-400 via-red-400 to-rose-500",
    bgCard: "from-orange-50 to-red-50 dark:from-orange-950/40 dark:to-red-950/40",
    ring: "ring-orange-400",
    shadowColor: "shadow-orange-200/60",
    en: "Art",
    he: "אמנות",
    yi: "קונסט"
  },
  {
    id: "travel",
    icon: Globe,
    image: "/images/topic-travel.jpg",
    gradient: "from-sky-400 via-blue-400 to-indigo-500",
    bgCard: "from-sky-50 to-blue-50 dark:from-sky-950/40 dark:to-blue-950/40",
    ring: "ring-sky-400",
    shadowColor: "shadow-sky-200/60",
    en: "Travel",
    he: "טיולים",
    yi: "רײַזן"
  }
];

/**
 * Fun "Surprise Me!" twist phrases per topic.
 */
const SURPRISE_TWISTS = {
  en: [
    "who discovers they can talk to clouds",
    "on a mission to find the world's tastiest cookie",
    "who accidentally shrinks to the size of an ant",
    "that can travel through rainbows",
    "who builds a rocket out of cardboard boxes",
    "that befriends a tiny invisible dragon",
    "who discovers a secret library under the sea",
    "on a quest to collect every color of the sunset"
  ],
  he: [
    "שמגלה שהוא יכול לדבר עם העננים",
    "במשימה למצוא את העוגייה הטעימה בעולם",
    "שמתכווץ בטעות לגודל של נמלה",
    "שיכול לנסוע דרך קשתות",
    "שבונה רקטה מקרטון",
    "שמתיידד עם דרקון קטנטן בלתי נראה",
    "שמגלה ספרייה סודית מתחת לים",
    "במסע לאסוף כל צבעי השקיעה"
  ],
  yi: [
    "וואָס ענטדעקט אַז ער קען רעדן מיט וואָלקנס",
    "אויף אַ מיסיע צו געפֿינען דעם טעמסטן קיכל אין דער וועלט",
    "וואָס שרומפּט אַראָפּ צו דער גרייס פֿון אַן אַמייז",
    "וואָס קען רײַזן דורך רעגנבויגנס",
    "וואָס בויט אַ ראַקעטע פֿון קאַרטאָן",
    "וואָס ווערט אַ פֿרײַנד מיט אַ קליין אומזעיִקן דראַקאָן",
    "וואָס ענטדעקט אַ סודותדיקע ביבליאָטעק אונטער ים",
    "אויף אַ קוועסט צו זאַמלען אַלע פֿאַרבן פֿון שקיעה"
  ]
};

const cardVariants = {
  hidden: { opacity: 0, y: 24, scale: 0.92 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { delay: i * 0.04, duration: 0.35, ease: "easeOut" }
  })
};

const surpriseRevealVariants = {
  initial: { scale: 0.5, rotate: -15, opacity: 0 },
  animate: {
    scale: 1,
    rotate: 0,
    opacity: 1,
    transition: { type: "spring", stiffness: 400, damping: 15 }
  },
  exit: { scale: 0.5, rotate: 15, opacity: 0, transition: { duration: 0.15 } }
};

function getTopicLabel(topic, t) {
  return t("topicNames." + topic.id) || topic.en;
}

/**
 * TopicStep - Step 1 of the wizard: Choose a story topic.
 * Visual topic cards with gradients, "Surprise Me!" button, and custom idea input.
 */
export default function TopicStep({ selectedTopic, onSelectTopic, customIdea, onCustomIdeaChange, isRTL, language }) {
  const { t } = useI18n();
  const isHebrew = language === "hebrew";
  const isYiddish = language === "yiddish";
  const [showCustomIdea, setShowCustomIdea] = useState(!!customIdea);
  const [showSavedIdeas, setShowSavedIdeas] = useState(false);
  const [savedIdeas, setSavedIdeas] = useState([]);
  const [isLoadingIdeas, setIsLoadingIdeas] = useState(false);
  const [surprisedTopicId, setSurprisedTopicId] = useState(null);
  const surpriseTimerRef = useRef(null);

  useEffect(() => {
    if (showSavedIdeas && savedIdeas.length === 0) {
      loadSavedIdeas();
    }
  }, [showSavedIdeas]);

  useEffect(() => {
    return () => {
      if (surpriseTimerRef.current) {
        clearTimeout(surpriseTimerRef.current);
      }
    };
  }, []);

  const loadSavedIdeas = async () => {
    try {
      setIsLoadingIdeas(true);
      const ideas = await StoryIdea.list("-created_date", 10);
      setSavedIdeas(ideas);
    } catch {
      // silently handled
    } finally {
      setIsLoadingIdeas(false);
    }
  };

  const handleSelectCustomIdea = () => {
    setShowCustomIdea(true);
    setShowSavedIdeas(false);
    onSelectTopic("custom");
  };

  const handleSelectSavedIdea = (idea) => {
    if (onCustomIdeaChange) {
      onCustomIdeaChange(idea.description || idea.title);
    }
    onSelectTopic("custom");
    setShowSavedIdeas(false);
    setShowCustomIdea(true);
  };

  const handleSurpriseMe = () => {
    const randomTopic = TOPIC_CARDS[Math.floor(Math.random() * TOPIC_CARDS.length)];
    const twistList = isYiddish ? SURPRISE_TWISTS.yi : isHebrew ? SURPRISE_TWISTS.he : SURPRISE_TWISTS.en;
    const randomTwist = twistList[Math.floor(Math.random() * twistList.length)];
    const topicLabel = getTopicLabel(randomTopic, t);

    let ideaText;
    if (isHebrew) {
      ideaText = `סיפור על ${topicLabel} ${randomTwist}`;
    } else if (isYiddish) {
      ideaText = `אַ מעשׂה וועגן ${topicLabel} ${randomTwist}`;
    } else {
      ideaText = `A story about ${topicLabel.toLowerCase()} ${randomTwist}`;
    }

    setSurprisedTopicId(randomTopic.id);
    if (surpriseTimerRef.current) {
      clearTimeout(surpriseTimerRef.current);
    }
    surpriseTimerRef.current = setTimeout(() => setSurprisedTopicId(null), 900);

    onSelectTopic("custom");
    if (onCustomIdeaChange) onCustomIdeaChange(ideaText);
    setShowCustomIdea(true);
    setShowSavedIdeas(false);
  };

  return (
    <div className="space-y-6" dir={isRTL ? "rtl" : "ltr"}>
      {/* Header */}
      <div className="text-center mb-2">
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-2">
            {t("wizard.topic.title")}
          </h2>
        </motion.div>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15, duration: 0.4 }}
        >
          <p className="text-gray-500 dark:text-gray-400 text-base">
            {t("wizard.topic.subtitle")}
          </p>
        </motion.div>
      </div>

      {/* Surprise Me! Button */}
      <div className="flex justify-center">
        <motion.button
          onClick={handleSurpriseMe}
          whileHover={{ scale: 1.06, y: -2 }}
          whileTap={{ scale: 0.95 }}
          aria-label={t("surpriseMe")}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          className="
            relative flex items-center gap-3 px-8 py-3.5 rounded-2xl font-bold text-base
            bg-gradient-to-r from-fuchsia-500 via-purple-500 to-indigo-500
            text-white shadow-lg shadow-purple-300/50
            hover:shadow-xl hover:shadow-purple-400/50
            transition-shadow duration-200 overflow-hidden
          "
        >
          {/* Shimmer effect */}
          <motion.div
            className="absolute inset-0 bg-white/20 skew-x-12"
            animate={{ x: ["-200%", "300%"] }}
            transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 1.5, ease: "easeInOut" }}
            aria-hidden="true"
          />
          <Shuffle className="h-5 w-5 relative z-10" aria-hidden="true" />
          <span className="relative z-10">{t("surpriseMe")}</span>
          <Wand2 className="h-5 w-5 relative z-10" aria-hidden="true" />
        </motion.button>
      </div>

      {/* Topic Cards Grid */}
      <div
        className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 md:gap-4"
        role="radiogroup"
        aria-label={t("wizard.topic.chooseTopic")}
      >
        {TOPIC_CARDS.map((topic, index) => {
          const Icon = topic.icon;
          const isSelected = selectedTopic === topic.id || (selectedTopic === "custom" && surprisedTopicId === topic.id);
          const isSurprised = surprisedTopicId === topic.id;

          return (
            <motion.button
              key={topic.id}
              custom={index}
              variants={cardVariants}
              initial="hidden"
              animate="visible"
              whileHover={{ scale: 1.05, y: -3 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                setShowCustomIdea(false);
                setSurprisedTopicId(null);
                onSelectTopic(topic.id);
              }}
              role="radio"
              aria-checked={selectedTopic === topic.id}
              aria-label={getTopicLabel(topic, t)}
              className={`
                relative flex flex-col items-center justify-center p-4 md:p-5 rounded-2xl
                transition-all duration-200 cursor-pointer min-h-[130px] md:min-h-[150px]
                bg-gradient-to-br ${topic.bgCard}
                ${isSelected
                  ? `ring-2 ${topic.ring} shadow-lg ${topic.shadowColor}`
                  : "hover:shadow-md hover:ring-1 hover:ring-gray-200 dark:hover:ring-gray-600 shadow-sm"
                }
                overflow-hidden
              `}
            >
              {/* Selected glow overlay */}
              {isSelected && (
                <motion.div
                  className={`absolute inset-0 bg-gradient-to-br ${topic.gradient} opacity-10 rounded-2xl`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.1 }}
                />
              )}

              <AnimatePresence mode="wait">
                {isSurprised ? (
                  <motion.div
                    key="surprised"
                    variants={surpriseRevealVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    className="mb-3"
                  >
                    <img
                      src={topic.image}
                      alt=""
                      aria-hidden="true"
                      className={`w-14 h-14 md:w-16 md:h-16 rounded-full object-cover shadow-md ring-2 ring-white/70`}
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    key="normal"
                    className="mb-3"
                    animate={isSelected ? { scale: [1, 1.08, 1] } : {}}
                    transition={{ duration: 0.4 }}
                  >
                    <img
                      src={topic.image}
                      alt=""
                      aria-hidden="true"
                      className={`w-14 h-14 md:w-16 md:h-16 rounded-full object-cover shadow-md ring-2 ${isSelected ? `ring-white` : "ring-white/40"}`}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              <span className={`text-sm md:text-base font-bold text-center relative z-10 ${isSelected ? "text-gray-900 dark:text-white" : "text-gray-700 dark:text-gray-200"}`}>
                {getTopicLabel(topic, t)}
              </span>

              {isSelected && !surprisedTopicId && (
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className={`mt-1.5 w-2 h-2 rounded-full bg-gradient-to-r ${topic.gradient}`}
                  aria-hidden="true"
                />
              )}
            </motion.button>
          );
        })}

        {/* "I have my own idea" card */}
        <motion.button
          custom={TOPIC_CARDS.length}
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          whileHover={{ scale: 1.05, y: -3 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleSelectCustomIdea}
          role="radio"
          aria-checked={selectedTopic === "custom"}
          aria-label={t("wizard.topic.customIdea")}
          className={`
            relative flex flex-col items-center justify-center p-4 md:p-5 rounded-2xl
            transition-all duration-200 cursor-pointer min-h-[130px] md:min-h-[150px]
            bg-gradient-to-br from-slate-50 to-gray-100 dark:from-gray-800 dark:to-slate-800
            shadow-sm overflow-hidden
            ${selectedTopic === "custom"
              ? "ring-2 ring-purple-500 shadow-lg shadow-purple-200/50"
              : "hover:shadow-md border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-purple-400 dark:hover:border-purple-500"
            }
          `}
        >
          <div className="mb-3">
            <img
              src="/images/topic-custom.jpg"
              alt=""
              aria-hidden="true"
              className={`w-14 h-14 md:w-16 md:h-16 rounded-full object-cover shadow-md ring-2 ${selectedTopic === "custom" ? "ring-purple-500" : "ring-white/40"}`}
            />
          </div>
          <span className={`text-sm md:text-base font-bold text-center ${selectedTopic === "custom" ? "text-purple-700 dark:text-purple-300" : "text-gray-700 dark:text-gray-200"}`}>
            {t("wizard.topic.customIdeaShort")}
          </span>
          {selectedTopic === "custom" && !surprisedTopicId && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="mt-1.5 w-2 h-2 rounded-full bg-purple-500"
              aria-hidden="true"
            />
          )}
        </motion.button>
      </div>

      {/* Custom idea text input */}
      <AnimatePresence>
        {showCustomIdea && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-950/30 dark:to-indigo-950/30 rounded-2xl p-4 space-y-3 border border-purple-100 dark:border-purple-900/50 shadow-sm">
              <label className="text-sm font-semibold text-purple-800 dark:text-purple-300 block">
                {t("wizard.topic.tellUsIdea")}
              </label>
              <Textarea
                value={customIdea || ""}
                onChange={(e) => onCustomIdeaChange?.(e.target.value)}
                placeholder={t("ideaPlaceholder")}
                dir={isRTL ? "rtl" : "ltr"}
                rows={3}
                maxLength={500}
                className="resize-none bg-white dark:bg-gray-900 border-purple-200 dark:border-purple-800 focus:border-purple-400 rounded-xl"
                aria-label={t("wizard.topic.describeIdeaLabel")}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* "Use Saved Idea" toggle */}
      <div className="flex justify-center">
        <Button
          variant="ghost"
          onClick={() => setShowSavedIdeas(!showSavedIdeas)}
          className="text-purple-600 dark:text-purple-400 hover:text-purple-700 hover:bg-purple-50 dark:hover:bg-purple-950/30 gap-2 rounded-xl"
          aria-expanded={showSavedIdeas}
        >
          <Lightbulb className="h-4 w-4" aria-hidden="true" />
          {t("wizard.topic.useSavedIdea")}
        </Button>
      </div>

      {/* Saved ideas list */}
      <AnimatePresence>
        {showSavedIdeas && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-gradient-to-br from-blue-50 to-sky-50 dark:from-blue-950/30 dark:to-sky-950/30 rounded-2xl p-4 space-y-3 border border-blue-100 dark:border-blue-900/50">
              <h3 className="text-sm font-semibold text-blue-800 dark:text-blue-300">
                {t("wizard.topic.savedIdeasTitle")}
              </h3>
              {isLoadingIdeas ? (
                <div className="flex justify-center py-4">
                  <div className="w-6 h-6 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin" />
                </div>
              ) : savedIdeas.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-3">
                  {t("wizard.topic.noSavedIdeas")}
                </p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {savedIdeas.map((idea) => (
                    <motion.button
                      key={idea.id}
                      whileHover={{ scale: 1.01, x: isRTL ? -3 : 3 }}
                      whileTap={{ scale: 0.99 }}
                      onClick={() => handleSelectSavedIdea(idea)}
                      className="w-full text-left p-3 bg-white dark:bg-gray-800 rounded-xl hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors border border-gray-200 dark:border-gray-700 shadow-sm"
                    >
                      <p className="font-semibold text-sm text-gray-900 dark:text-white truncate">
                        {idea.title}
                      </p>
                      {idea.description && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                          {idea.description}
                        </p>
                      )}
                    </motion.button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export { TOPIC_CARDS };
