import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Trash2, UserPlus, User, BookOpen, Star, Check, Shuffle, Wand2 } from "lucide-react";
import useCharacterSelector from "@/hooks/useCharacterSelector";
import { useI18n } from "@/components/i18n/i18nProvider";

const CHARACTER_TEMPLATES = [
  {
    id: "brave_hero",
    emoji: "🦸",
    en: "Brave Hero",
    he: "גיבור אמיץ",
    traits: "brave, kind, helpful",
    gradient: "from-yellow-400 via-orange-400 to-red-400",
    bg: "from-yellow-50 to-orange-50 dark:from-yellow-950/40 dark:to-orange-950/40"
  },
  {
    id: "smart_detective",
    emoji: "🔍",
    en: "Smart Detective",
    he: "בלש חכם",
    traits: "clever, curious, observant",
    gradient: "from-blue-400 via-indigo-400 to-violet-500",
    bg: "from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40"
  },
  {
    id: "friendly_animal",
    emoji: "🐻",
    en: "Friendly Animal",
    he: "חיה ידידותית",
    traits: "loyal, playful, gentle",
    gradient: "from-amber-400 via-yellow-400 to-orange-400",
    bg: "from-amber-50 to-yellow-50 dark:from-amber-950/40 dark:to-yellow-950/40"
  },
  {
    id: "magical_fairy",
    emoji: "🧚",
    en: "Magical Fairy",
    he: "פיה קסומה",
    traits: "magical, cheerful, wise",
    gradient: "from-pink-400 via-fuchsia-400 to-purple-500",
    bg: "from-pink-50 to-fuchsia-50 dark:from-pink-950/40 dark:to-fuchsia-950/40"
  },
  {
    id: "space_explorer",
    emoji: "🚀",
    en: "Space Explorer",
    he: "חוקר חלל",
    traits: "adventurous, scientific, brave",
    gradient: "from-indigo-500 via-purple-500 to-violet-600",
    bg: "from-indigo-50 to-purple-50 dark:from-indigo-950/40 dark:to-purple-950/40"
  },
  {
    id: "princess",
    emoji: "👸",
    en: "Princess",
    he: "נסיכה",
    traits: "kind, wise, resourceful",
    gradient: "from-rose-400 via-pink-400 to-fuchsia-400",
    bg: "from-rose-50 to-pink-50 dark:from-rose-950/40 dark:to-pink-950/40"
  },
  {
    id: "pirate",
    emoji: "🏴‍☠️",
    en: "Pirate",
    he: "פיראט",
    traits: "adventurous, clever, bold",
    gradient: "from-slate-500 via-gray-500 to-zinc-600",
    bg: "from-slate-50 to-gray-50 dark:from-slate-950/40 dark:to-gray-950/40"
  },
  {
    id: "robot",
    emoji: "🤖",
    en: "Robot Friend",
    he: "חבר רובוט",
    traits: "smart, helpful, funny",
    gradient: "from-cyan-400 via-sky-400 to-blue-500",
    bg: "from-cyan-50 to-sky-50 dark:from-cyan-950/40 dark:to-sky-950/40"
  },
  {
    id: "dragon",
    emoji: "🐉",
    en: "Friendly Dragon",
    he: "דרקון ידידותי",
    traits: "strong, protective, warm",
    gradient: "from-emerald-400 via-green-400 to-teal-500",
    bg: "from-emerald-50 to-green-50 dark:from-emerald-950/40 dark:to-green-950/40"
  },
  {
    id: "wizard",
    emoji: "🧙",
    en: "Wizard",
    he: "קוסם",
    traits: "wise, powerful, mentoring",
    gradient: "from-violet-500 via-purple-500 to-indigo-600",
    bg: "from-violet-50 to-purple-50 dark:from-violet-950/40 dark:to-purple-950/40"
  },
];

const SURPRISE_CHARACTERS = {
  en: ["Tiny Talking Mouse", "Invisible Friend", "Cloud Surfer", "Time-Traveling Kid", "Moon Princess"],
  he: ["עכבר מדבר קטנטן", "חבר בלתי נראה", "גולש ענן", "ילד נוסע בזמן", "נסיכת הירח"]
};

const CHILD_CHARACTER_ID = "child_self";

const cardVariants = {
  hidden: { opacity: 0, scale: 0.85, y: 16 },
  visible: (i) => ({
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { delay: i * 0.04, duration: 0.3, ease: "easeOut" }
  })
};

function getChildNameFromStorage() {
  try {
    const childName = localStorage.getItem("childName");
    if (childName && childName.trim()) return childName.trim();
    const userName = localStorage.getItem("userName");
    if (userName && userName.trim()) return userName.trim();
    const onboarding = localStorage.getItem("onboardingData");
    if (onboarding) {
      const parsed = JSON.parse(onboarding);
      if (parsed.childName && parsed.childName.trim()) return parsed.childName.trim();
      if (parsed.name && parsed.name.trim()) return parsed.name.trim();
    }
  } catch {
    // ignore parse errors
  }
  return null;
}

function buildChildCharacter(name, t) {
  return {
    id: CHILD_CHARACTER_ID,
    name,
    traits: "the main character, adventurous, kind",
    emoji: "⭐",
    avatar: null,
    isTemplate: false,
    isEntity: false,
    isChildSelf: true,
    label: t("characterPicker.thatsYou")
  };
}

/**
 * CharacterPicker - Unified character selection with visual gradient cards.
 * "Surprise Me" button, My Characters, Quick Templates, and Add Custom.
 */
export default function CharacterPicker({
  selectedCharacters,
  onCharactersChange,
  isRTL,
  language
}) {
  const { t } = useI18n();
  const isHebrew = language === "hebrew";
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customCharacterName, setCustomCharacterName] = useState("");
  const { savedCharacters, isLoading, entityToSelection } = useCharacterSelector();

  // Auto-add child character on mount if name found and no characters selected yet
  useEffect(() => {
    if (selectedCharacters.length > 0) return;
    const childName = getChildNameFromStorage();
    if (!childName) return;
    const childChar = buildChildCharacter(childName, t);
    onCharactersChange([childChar]);
  // Only run once on mount
   
  }, []);

  const toggleCharacter = (charSelection) => {
    const exists = selectedCharacters.find((c) => c.id === charSelection.id);
    if (exists) {
      onCharactersChange(selectedCharacters.filter((c) => c.id !== charSelection.id));
    } else {
      onCharactersChange([...selectedCharacters, charSelection]);
    }
  };

  const toggleTemplate = (template) => {
    const charSelection = {
      id: template.id,
      name: isHebrew ? template.he : template.en,
      traits: template.traits,
      emoji: template.emoji,
      avatar: null,
      isTemplate: true,
      isEntity: false,
    };
    toggleCharacter(charSelection);
  };

  const toggleEntity = (entity) => {
    const charSelection = entityToSelection(entity);
    toggleCharacter(charSelection);
  };

  const addCustomCharacter = () => {
    if (!customCharacterName.trim()) return;
    const customChar = {
      id: `custom_${Date.now()}`,
      name: customCharacterName.trim(),
      traits: "",
      emoji: "🧑",
      avatar: null,
      isTemplate: false,
      isEntity: false,
    };
    onCharactersChange([...selectedCharacters, customChar]);
    setCustomCharacterName("");
    setShowCustomInput(false);
  };

  const removeCharacter = (charId) => {
    onCharactersChange(selectedCharacters.filter((c) => c.id !== charId));
  };

  const handleSurpriseMe = () => {
    const list = isHebrew ? SURPRISE_CHARACTERS.he : SURPRISE_CHARACTERS.en;
    const randomName = list[Math.floor(Math.random() * list.length)];
    const customChar = {
      id: `surprise_${Date.now()}`,
      name: randomName,
      traits: "mysterious, magical, surprising",
      emoji: ["✨", "🌟", "🎭", "🦄", "🌙"][Math.floor(Math.random() * 5)],
      avatar: null,
      isTemplate: false,
      isEntity: false,
    };
    onCharactersChange([...selectedCharacters, customChar]);
  };

  const hasSavedCharacters = savedCharacters.length > 0;

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
            {t("characterPicker.title")}
          </h2>
        </motion.div>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
        >
          <p className="text-gray-500 dark:text-gray-400 text-base">
            {t("characterPicker.subtitle")}
          </p>
        </motion.div>
      </div>

      {/* Surprise Me! */}
      <div className="flex justify-center">
        <motion.button
          onClick={handleSurpriseMe}
          whileHover={{ scale: 1.06, y: -2 }}
          whileTap={{ scale: 0.95 }}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          aria-label={t("characterPicker.surpriseLabel")}
          className="
            relative flex items-center gap-3 px-7 py-3 rounded-2xl font-bold text-base
            bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500
            text-white shadow-lg shadow-purple-300/50
            hover:shadow-xl hover:shadow-purple-400/50
            transition-shadow duration-200 overflow-hidden
          "
        >
          <motion.div
            className="absolute inset-0 bg-white/20 skew-x-12"
            animate={{ x: ["-200%", "300%"] }}
            transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 2, ease: "easeInOut" }}
            aria-hidden="true"
          />
          <Shuffle className="h-5 w-5 relative z-10" aria-hidden="true" />
          <span className="relative z-10">{t("characterPicker.surpriseButton")}</span>
          <Wand2 className="h-5 w-5 relative z-10" aria-hidden="true" />
        </motion.button>
      </div>

      {/* My Characters section */}
      {isLoading ? (
        <div>
          <p className="text-sm font-semibold mb-3 text-purple-700 dark:text-purple-300">
            {t("characterPicker.myCharacters")}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {Array(4).fill(0).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-2xl" />
            ))}
          </div>
        </div>
      ) : hasSavedCharacters ? (
        <div>
          <p className="text-sm font-semibold mb-3 text-purple-700 dark:text-purple-300 flex items-center gap-1.5">
            <BookOpen className="h-4 w-4" aria-hidden="true" />
            {t("characterPicker.myCharacters")}
          </p>
          <div
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3"
            role="group"
            aria-label={t("characterPicker.myCharacters")}
          >
            {savedCharacters.map((entity, index) => {
              const selectionId = `entity_${entity.id}`;
              const isSelected = selectedCharacters.some((c) => c.id === selectionId);
              return (
                <motion.button
                  key={entity.id}
                  custom={index}
                  variants={cardVariants}
                  initial="hidden"
                  animate="visible"
                  whileHover={{ scale: 1.05, y: -3 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => toggleEntity(entity)}
                  aria-pressed={isSelected}
                  aria-label={entity.name}
                  className={`
                    relative flex flex-col items-center p-4 rounded-2xl transition-all duration-200 cursor-pointer overflow-hidden
                    ${isSelected
                      ? "bg-gradient-to-br from-purple-100 to-indigo-100 dark:from-purple-900/50 dark:to-indigo-900/50 ring-2 ring-purple-500 shadow-lg shadow-purple-200/50"
                      : "bg-gradient-to-br from-gray-50 to-slate-50 dark:from-gray-800 dark:to-slate-800 hover:shadow-md border border-gray-200 dark:border-gray-700"
                    }
                  `}
                >
                  {isSelected && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute top-2 right-2 w-5 h-5 bg-purple-600 rounded-full flex items-center justify-center shadow-sm"
                      aria-hidden="true"
                    >
                      <Check className="h-3 w-3 text-white" />
                    </motion.div>
                  )}
                  <Avatar className="h-14 w-14 mb-2.5 border-2 border-purple-200 dark:border-purple-800 shadow-sm">
                    <AvatarImage src={entity.primary_image_url} alt={entity.name} />
                    <AvatarFallback className="bg-gradient-to-br from-purple-100 to-indigo-100 dark:from-purple-900 dark:to-indigo-900 text-purple-600 dark:text-purple-300">
                      <User className="h-6 w-6" />
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs font-semibold text-gray-800 dark:text-gray-200 text-center line-clamp-1">
                    {entity.name}
                  </span>
                </motion.button>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Quick Templates */}
      <div>
        <p className="text-sm font-semibold mb-3 text-gray-600 dark:text-gray-400">
          {t("characterPicker.quickTemplates")}
        </p>
        <div
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3"
          role="group"
          aria-label={t("characterPicker.templateLabel")}
        >
          {CHARACTER_TEMPLATES.map((template, index) => {
            const isSelected = selectedCharacters.some((c) => c.id === template.id);
            return (
              <motion.button
                key={template.id}
                custom={index}
                variants={cardVariants}
                initial="hidden"
                animate="visible"
                whileHover={{ scale: 1.05, y: -3 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => toggleTemplate(template)}
                aria-pressed={isSelected}
                aria-label={isHebrew ? template.he : template.en}
                className={`
                  relative flex flex-col items-center p-4 rounded-2xl transition-all duration-200 cursor-pointer overflow-hidden
                  bg-gradient-to-br ${template.bg}
                  ${isSelected
                    ? "ring-2 ring-purple-500 shadow-lg shadow-purple-200/50"
                    : "hover:shadow-md border border-transparent hover:border-gray-200 dark:hover:border-gray-600 shadow-sm"
                  }
                `}
              >
                {isSelected && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute top-2 right-2 w-5 h-5 bg-purple-600 rounded-full flex items-center justify-center shadow-sm z-10"
                    aria-hidden="true"
                  >
                    <Check className="h-3 w-3 text-white" />
                  </motion.div>
                )}
                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${template.gradient} flex items-center justify-center mb-2.5 shadow-md`}>
                  <span className="text-3xl leading-none drop-shadow" aria-hidden="true">{template.emoji}</span>
                </div>
                <span className="text-xs md:text-sm font-semibold text-gray-800 dark:text-gray-200 text-center line-clamp-2 w-full">
                  {isHebrew ? template.he : template.en}
                </span>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Selected characters display */}
      {selectedCharacters.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-950/30 dark:to-indigo-950/30 rounded-2xl border border-purple-100 dark:border-purple-900/50"
        >
          <p className="text-sm font-semibold mb-3 text-purple-700 dark:text-purple-300">
            {t("characterPicker.selectedCount", { count: selectedCharacters.length })}
          </p>
          <div className="flex flex-wrap gap-2">
            <AnimatePresence>
              {selectedCharacters.map((char) => (
                <motion.div
                  key={char.id}
                  initial={{ opacity: 0, scale: 0.7 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.7 }}
                  transition={{ type: "spring", stiffness: 400, damping: 20 }}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl shadow-sm ${
                    char.isChildSelf
                      ? "bg-gradient-to-r from-yellow-100 to-amber-100 dark:from-yellow-900/40 dark:to-amber-900/40 ring-2 ring-yellow-400"
                      : "bg-white dark:bg-gray-800 ring-1 ring-purple-200 dark:ring-purple-800"
                  }`}
                >
                  {char.isChildSelf ? (
                    <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-400" aria-hidden="true" />
                  ) : char.avatar ? (
                    <Avatar className="h-5 w-5">
                      <AvatarImage src={char.avatar} alt={char.name} />
                      <AvatarFallback className="text-[10px]"><User className="h-3 w-3" /></AvatarFallback>
                    </Avatar>
                  ) : char.emoji ? (
                    <span className="text-base leading-none" aria-hidden="true">{char.emoji}</span>
                  ) : (
                    <User className="h-3.5 w-3.5 text-purple-600" />
                  )}
                  <span className={`text-sm font-semibold ${char.isChildSelf ? "text-yellow-800 dark:text-yellow-200" : "text-gray-800 dark:text-gray-200"}`}>
                    {char.name}
                  </span>
                  {char.isChildSelf && (
                    <span className="text-xs text-yellow-600 dark:text-yellow-400 font-medium">
                      {char.label}
                    </span>
                  )}
                  <button
                    onClick={() => removeCharacter(char.id)}
                    className="ml-1 text-gray-400 hover:text-red-500 transition-colors rounded-full p-0.5 hover:bg-red-50 dark:hover:bg-red-950/30"
                    aria-label={t("characterPicker.removeChar", { name: char.name })}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </motion.div>
      )}

      {/* Add custom character */}
      <div>
        {!showCustomInput ? (
          <Button
            variant="outline"
            onClick={() => setShowCustomInput(true)}
            className="gap-2 rounded-xl border-dashed border-gray-300 dark:border-gray-600 hover:border-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/20"
            aria-label={t("characterPicker.addCustomLabel")}
          >
            <UserPlus className="h-4 w-4" aria-hidden="true" />
            {t("characterPicker.addCustomButton")}
          </Button>
        ) : (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="overflow-hidden"
          >
            <div className="flex gap-2 items-end p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-200 dark:border-gray-700">
              <div className="flex-1">
                <Label htmlFor="custom-character-name" className="mb-1.5 block text-sm font-medium">
                  {t("characterPicker.charNameLabel")}
                </Label>
                <Input
                  id="custom-character-name"
                  value={customCharacterName}
                  onChange={(e) => setCustomCharacterName(e.target.value)}
                  placeholder={t("wizard.characters.namePlaceholder")}
                  dir={isRTL ? "rtl" : "ltr"}
                  maxLength={50}
                  className="rounded-xl"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") addCustomCharacter();
                  }}
                />
              </div>
              <Button
                onClick={addCustomCharacter}
                disabled={!customCharacterName.trim()}
                className="bg-purple-600 hover:bg-purple-700 rounded-xl"
                aria-label={t("characterPicker.addButton")}
              >
                <Plus className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setShowCustomInput(false);
                  setCustomCharacterName("");
                }}
                className="rounded-xl"
                aria-label={t("characterPicker.cancelButton")}
              >
                {t("characterPicker.cancelButton")}
              </Button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
