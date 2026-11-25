import { useId, useState, useEffect, useRef } from "react";
import { Music, Lightbulb, PencilLine, Shuffle } from "lucide-react";
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

export function getSelectedTopicLabel(selectedTopic, t) {
  if (selectedTopic === "custom") return t("wizard.topic.customIdeaShort");
  const topic = TOPIC_CARDS.find(card => card.id === selectedTopic);
  return topic ? getTopicLabel(topic, t) : "";
}

/**
 * TopicStep - Step 1 of the wizard: Choose a story topic.
 * Illustrated choices, surprise ideas, and custom ideas.
 */
export default function TopicStep({ selectedTopic, onSelectTopic, customIdea, onCustomIdeaChange, onApplySuggestedIdea = onCustomIdeaChange, isRTL, language }) {
  const { t } = useI18n();
  const isHebrew = language === "hebrew";
  const isYiddish = language === "yiddish";
  const group = useId();
  const customIdeaId = `${group}-idea`;
  const showCustomIdea = selectedTopic === "custom";
  const savedIdeasId = `${group}-saved`;
  const selectedLabel = getSelectedTopicLabel(selectedTopic, t);
  const [showSavedIdeas, setShowSavedIdeas] = useState(false);
  const [savedIdeas, setSavedIdeas] = useState([]);
  const [savedStatus, setSavedStatus] = useState("loading");
  const [retryCount, setRetryCount] = useState(0);
  const [replacement, setReplacement] = useState(null);
  const ideaRef = useRef(null);
  const replacementTriggerRef = useRef(null);
  const keepIdeaRef = useRef(null);
  const focusIdeaRef = useRef(false);
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
    if (!showSavedIdeas) return;
    let ignore = false;
    async function loadSavedIdeas() {
      try {
        const ideas = await StoryIdea.list("-created_date", 10);
        if (ignore) return;
        setSavedIdeas(ideas);
        setSavedStatus("ready");
      } catch {
        if (!ignore) setSavedStatus("error");
      }
    }
    void loadSavedIdeas();
    return () => { ignore = true; };
  }, [showSavedIdeas, retryCount]);

  useEffect(() => {
    if (showCustomIdea && focusIdeaRef.current) {
      ideaRef.current?.focus();
      focusIdeaRef.current = false;
    }
  }, [customIdea, showCustomIdea]);

  useEffect(() => {
    if (!replacement) return;
    keepIdeaRef.current?.focus({ preventScroll: true });
    keepIdeaRef.current?.scrollIntoView?.({ block: "center" });
  }, [replacement]);

  const selectTopic = (topic) => {
    setReplacement(null);
    setShowSavedIdeas(false);
    onSelectTopic(topic);
  };

  const applyIdea = (idea) => {
    focusIdeaRef.current = true;
    if (showCustomIdea && customIdea === idea) {
      ideaRef.current?.focus();
      focusIdeaRef.current = false;
    }
    onApplySuggestedIdea?.(idea);
    selectTopic("custom");
  };

  const suggestIdea = (idea, trigger) => {
    if (customIdea?.trim() && customIdea !== idea) {
      replacementTriggerRef.current = trigger;
      setReplacement(idea);
      return;
    }
    applyIdea(idea);
  };

  const handleSurpriseMe = (event) => {
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

    suggestIdea(ideaText, event.currentTarget);
  };

  return (
    <div className="space-y-5" dir={isRTL ? "rtl" : "ltr"}>
      <p className="text-sm leading-relaxed text-sp-ink-600 dark:text-slate-200 sm:text-base">
        {t("wizard.topic.subtitle")}
      </p>
      <fieldset className="space-y-5">
        <legend className="sr-only">{t("wizard.topic.chooseTopic")}</legend>
        <div className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-3 dark:border-amber-900 dark:bg-slate-900 sm:p-4">
          <div className="flex flex-wrap gap-2">
            <label className="relative inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-violet-300 bg-white px-3 text-sm font-semibold text-violet-950 transition-colors hover:bg-violet-50 has-[:checked]:bg-violet-100 has-[:checked]:ring-2 has-[:checked]:ring-violet-700 focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-violet-700 dark:border-violet-700 dark:bg-slate-950 dark:text-violet-100 dark:has-[:checked]:bg-violet-950">
              <input className="sr-only" type="radio" name={group} value="custom" checked={showCustomIdea}
                onChange={() => selectTopic("custom")} />
              <PencilLine size={16} aria-hidden="true" />
              {t("wizard.topic.customIdeaShort")}
            </label>
            <Button type="button" variant="outline" onClick={handleSurpriseMe}
              className="min-h-11 gap-2 rounded-xl border-amber-300 bg-white text-violet-950 hover:bg-amber-100 dark:border-amber-900 dark:bg-slate-950 dark:text-violet-100">
              <Shuffle size={16} aria-hidden="true" />
              {t("surpriseMe")}
            </Button>
            <Button type="button" variant="outline" aria-expanded={showSavedIdeas} aria-controls={savedIdeasId}
              onClick={() => {
                if (!showSavedIdeas) setSavedStatus("loading");
                setReplacement(null);
                setShowSavedIdeas(value => !value);
              }}
              className="min-h-11 gap-2 rounded-xl border-amber-300 bg-white text-violet-950 hover:bg-amber-100 dark:border-amber-900 dark:bg-slate-950 dark:text-violet-100">
              <Lightbulb size={16} aria-hidden="true" />
              {t("wizard.topic.useSavedIdea")}
            </Button>
            {typeof window !== "undefined" && window.AudioContext && (
              <button type="button" aria-pressed={soundEnabled} onClick={() => setSoundEnabled(enabled => !enabled)}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-medium text-slate-700 hover:bg-amber-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-700 aria-pressed:bg-amber-200 dark:text-slate-100 dark:hover:bg-slate-800 dark:aria-pressed:bg-slate-700">
                <Music size={16} aria-hidden="true" />{t("spxWizard.surpriseSound")}
              </button>
            )}
          </div>

          {showCustomIdea && (
            <div className="space-y-2 rounded-xl border border-violet-200 bg-white p-3 dark:border-violet-900 dark:bg-slate-950">
              <label htmlFor={customIdeaId} className="block text-sm font-semibold text-violet-950 dark:text-violet-200">
                {t("wizard.topic.tellUsIdea")}
              </label>
              <Textarea ref={ideaRef} id={customIdeaId} value={customIdea || ""}
                onChange={(event) => onCustomIdeaChange?.(event.target.value)}
                placeholder={t("ideaPlaceholder")} dir="auto" rows={3}
                className="min-h-24 resize-y rounded-xl text-base" />
            </div>
          )}

          <section id={savedIdeasId} hidden={!showSavedIdeas}
            className="space-y-2 rounded-xl border border-violet-200 bg-white p-3 dark:border-violet-900 dark:bg-slate-950">
            <h2 className="text-sm font-semibold text-violet-950 dark:text-violet-200">{t("wizard.topic.savedIdeasTitle")}</h2>
            {savedStatus === "loading" && (
              <p role="status" className="text-sm text-slate-700 dark:text-slate-200">{t("spxWizard.topic.savedLoading")}</p>
            )}
            {savedStatus === "error" && (
              <div className="space-y-2">
                <p role="alert" className="text-sm text-slate-700 dark:text-slate-200">{t("spxWizard.topic.savedError")}</p>
                <Button type="button" variant="outline" className="min-h-11"
                  onClick={() => { setSavedStatus("loading"); setRetryCount(count => count + 1); }}>
                  {t("spxWizard.topic.retry")}
                </Button>
              </div>
            )}
            {savedStatus === "ready" && (savedIdeas.length === 0 ? (
              <p role="status" className="text-sm text-slate-700 dark:text-slate-200">{t("wizard.topic.noSavedIdeas")}</p>
            ) : (
              <ul className="grid gap-2">
                {savedIdeas.map(idea => (
                  <li key={idea.id}>
                    <button type="button" onClick={event => suggestIdea([idea.title, idea.description].filter(Boolean).join(" — "), event.currentTarget)}
                      className="block min-h-11 w-full rounded-xl border border-violet-200 px-3 py-2 text-start hover:bg-violet-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-700 dark:border-violet-900 dark:hover:bg-slate-900">
                      <span className="block break-words text-sm font-semibold" dir="auto">{idea.title}</span>
                      {idea.description && <span className="mt-1 line-clamp-2 text-sm text-slate-700 dark:text-slate-200" dir="auto">{idea.description}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            ))}
          </section>

          {replacement && (
            <div className="space-y-2 rounded-xl border border-violet-300 bg-violet-50 p-3 dark:border-violet-700 dark:bg-slate-900">
              <div role="status">
                <p className="text-sm font-semibold">{t("spxWizard.topic.replacePrompt")}</p>
                <p className="mt-1 break-words text-sm" dir="auto">{replacement}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" className="min-h-11" onClick={() => applyIdea(replacement)}>{t("spxWizard.topic.replace")}</Button>
                <Button ref={keepIdeaRef} type="button" variant="outline" className="min-h-11" onClick={() => {
                  setReplacement(null);
                  replacementTriggerRef.current?.focus();
                }}>{t("spxWizard.topic.keep")}</Button>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-baseline justify-between gap-1">
          <h2 className="text-base font-semibold text-sp-ink-900 dark:text-white">{t("spxWizard.topic.scenes")}</h2>
          <p role="status" className="text-sm font-medium text-violet-800 dark:text-violet-200">
            {selectedLabel && t("spxWizard.topic.selected", { topic: selectedLabel })}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {TOPIC_CARDS.map(topic => (
            <IllustratedChoice key={topic.id} group={group} value={topic.id} checked={selectedTopic === topic.id}
              onSelect={selectTopic} src={`/images/spx/topics/${topic.id}.webp`}
              label={getTopicLabel(topic, t)} className="aspect-[4/5] w-full sm:aspect-square" />
          ))}
        </div>
      </fieldset>
    </div>
  );
}

export { TOPIC_CARDS };
