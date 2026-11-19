import { useId, useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Music, Lightbulb, Shuffle, Wand2 } from "lucide-react";
import IllustratedChoice from "./IllustratedChoice";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { StoryIdea } from "@/entities/StoryIdea";
import { useI18n } from "@/components/i18n/i18nProvider";

const TOPIC_CARDS = [
  { id: "animals", en: "Animals" },
  { id: "space", en: "Space" },
  { id: "family", en: "Family" },
  { id: "fairy_tale", en: "Fairy Tales" },
  { id: "adventure", en: "Adventure" },
  { id: "nature", en: "Nature" },
  { id: "science", en: "Science" },
  { id: "magic", en: "Magic" },
  { id: "friendship", en: "Friendship" },
  { id: "music", en: "Music" },
  { id: "art", en: "Art" },
  { id: "travel", en: "Travel" },
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

export function getTopicLabel(topic, t) {
  return t("topicNames." + topic.id) || topic.en;
}

/**
 * TopicStep - Step 1 of the wizard: Choose a story topic.
 * Illustrated choices, surprise ideas, and custom ideas.
 */
export default function TopicStep({ selectedTopic, onSelectTopic, customIdea, onCustomIdeaChange, isRTL, language }) {
  const { t } = useI18n();
  const isHebrew = language === "hebrew";
  const isYiddish = language === "yiddish";
  const group = useId();
  const customIdeaId = `${group}-idea`;
  const showCustomIdea = selectedTopic === "custom";
  const [showSavedIdeas, setShowSavedIdeas] = useState(false);
  const [savedIdeas, setSavedIdeas] = useState([]);
  const [isLoadingIdeas, setIsLoadingIdeas] = useState(false);
  const [surprisedTopicId, setSurprisedTopicId] = useState(null);
  const surpriseTimerRef = useRef(null);
  const [soundEnabled, setSoundEnabled] = useState(false);

  function playSurpriseSound() {
    // A short, local cue. Only an explicit button gesture can start it.
    if (!soundEnabled || !window.AudioContext) return;
    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const start = context.currentTime;
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(523.25, start);
    oscillator.frequency.setValueAtTime(659.25, start + 0.075);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.035, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.21);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.onended = () => { void context.close().catch(() => {}); };
    oscillator.start(start);
    oscillator.stop(start + 0.22);
  }

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

  const selectTopic = (topic) => {
    setShowSavedIdeas(false);
    setSurprisedTopicId(null);
    onSelectTopic(topic);
  };

  const handleSelectSavedIdea = (idea) => {
    if (onCustomIdeaChange) {
      onCustomIdeaChange(idea.description || idea.title);
    }
    onSelectTopic("custom");
    setShowSavedIdeas(false);
  };

  const handleSurpriseMe = () => {
    try { playSurpriseSound(); } catch { /* The illustrated reveal also works silently. */ }
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
      <div className="flex flex-wrap items-center justify-center gap-3">
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
          <Shuffle className="h-5 w-5 relative z-10" aria-hidden="true" />
          <span className="relative z-10">{t("surpriseMe")}</span>
          <Wand2 className="h-5 w-5 relative z-10" aria-hidden="true" />
        </motion.button>
        {typeof window !== 'undefined' && window.AudioContext && (
          <button type="button" aria-pressed={soundEnabled} onClick={() => setSoundEnabled(enabled => !enabled)}
            className="inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-sm font-medium text-slate-700 aria-pressed:bg-amber-100 dark:text-slate-100">
            <Music aria-hidden="true" size={16} />{t('spxWizard.surpriseSound')}
          </button>
        )}
      </div>

      <fieldset>
        <legend className="sr-only">{t("wizard.topic.chooseTopic")}</legend>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,9rem),1fr))] gap-3">
          {TOPIC_CARDS.map((topic) => (
            <IllustratedChoice key={topic.id} group={group} value={topic.id} checked={selectedTopic === topic.id}
              highlight={surprisedTopicId === topic.id} onSelect={selectTopic}
              src={`/images/spx/topics/${topic.id}.webp`} label={getTopicLabel(topic, t)} />
          ))}
          <IllustratedChoice group={group} value="custom" checked={showCustomIdea} onSelect={selectTopic}
            src="/images/topic-custom.jpg" label={t("wizard.topic.customIdeaShort")} />
        </div>
      </fieldset>

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
              <label htmlFor={customIdeaId} className="text-sm font-semibold text-purple-800 dark:text-purple-300 block">
                {t("wizard.topic.tellUsIdea")}
              </label>
              <Textarea
                id={customIdeaId}
                value={customIdea || ""}
                onChange={(e) => onCustomIdeaChange?.(e.target.value)}
                placeholder={t("ideaPlaceholder")}
                dir={isRTL ? "rtl" : "ltr"}
                rows={3}
                maxLength={500}
                className="resize-none bg-white dark:bg-gray-900 border-purple-200 dark:border-purple-800 focus:border-purple-400 rounded-xl"
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
