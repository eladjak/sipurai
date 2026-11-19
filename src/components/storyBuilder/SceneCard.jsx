import { useId, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Sparkles,
  Image as ImageIcon,
  Users,
  RefreshCw,
  ChevronDown,
  Trash2
} from "lucide-react";
import heStudio from "@/components/i18n/locales/he/studio";
import enStudio from "@/components/i18n/locales/en/studio";
import { useI18n } from "@/components/i18n/i18nProvider";

const SCENE_ILLUSTRATIONS = {
  beginning: "/images/spx/topics/nature.webp",
  rising: "/images/spx/topics/adventure.webp",
  conflict: "/images/spx/topics/magic.webp",
  climax: "/images/spx/topics/science.webp",
  resolution: "/images/spx/topics/friendship.webp",
  end: "/images/spx/topics/family.webp",
};

export function sceneRoleLabel(role, language) {
  const labels = language === "yiddish" ? heStudio.studio.sceneCard.yiddishRoles :
    language === "hebrew" ? heStudio.studio.sceneCard.roles : enStudio.studio.sceneCard.roles;
  return Object.hasOwn(labels, role) ? labels[role] : labels.scene;
}

/**
 * Render an avatar chip for a character that appears in this scene.
 * Looks up the character in the `allCharacters` list (by id) to render
 * the actual avatar + traits.  Falls back to a stub when the character
 * was removed from the selection after scene generation.
 */
function CharacterChip({ characterId, allCharacters, language, onRemove }) {
  const char = allCharacters.find((c) => c.id === characterId);
  const labels = (language === "hebrew" || language === "yiddish" ? heStudio : enStudio).studio.sceneCard;

  if (!char) {
    return (
      <Badge
        variant="outline"
        className="gap-1 opacity-50 line-through"
        aria-label={labels.missing}
      >
        ?
      </Badge>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ duration: 0.18 }}
      className="inline-flex items-center gap-1.5 bg-white dark:bg-gray-800 rounded-full pl-1 pr-2.5 py-1 border border-purple-200 dark:border-purple-800 shadow-sm"
    >
      <Avatar className="h-6 w-6 ring-1 ring-purple-300">
        {char.avatar ? (
          <AvatarImage src={char.avatar} alt="" />
        ) : (
          <AvatarFallback className="text-xs bg-purple-100 dark:bg-purple-900">
            {char.emoji || char.name?.[0] || "?"}
          </AvatarFallback>
        )}
      </Avatar>
      <span className="text-xs font-semibold text-gray-800 dark:text-gray-200 max-w-[90px] truncate">
        {char.name}
      </span>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={labels.remove.replace("{name}", char.name)}
          className="inline-flex size-11 items-center justify-center rounded-full text-gray-500 hover:text-red-600"
        >
          <Trash2 className="h-3 w-3" aria-hidden="true" />
        </button>
      )}
    </motion.div>
  );
}

/**
 * SceneCard — a single scene with title, description, characters in scene,
 * and illustration prompt. All fields are editable. Hebrew RTL aware.
 *
 * @param {Object} props
 * @param {Object} props.scene - { id, title, description, characters: string[], illustration_prompt, role }
 * @param {Function} props.onSceneChange - (patch) => void; receives partial scene fields
 * @param {Array} props.allCharacters - all wizard-selected characters (id, name, avatar, emoji)
 * @param {Function} [props.onRegenerate] - regenerate THIS scene's text+prompt
 * @param {boolean} [props.isRegenerating] - shows spinner on regenerate button
 * @param {boolean} props.isRTL
 * @param {string} props.language
 * @param {number} props.sceneNumber - 1-indexed display number
 */
export default function SceneCard({
  scene,
  onSceneChange,
  allCharacters = [],
  onRegenerate,
  isRegenerating = false,
  isRTL,
  language,
  sceneNumber
}) {
  const { t } = useI18n();
  const cardLabels = (language === "hebrew" ? heStudio : enStudio).studio.sceneCard;
  const fieldId = useId();
  const [showPromptEditor, setShowPromptEditor] = useState(false);

  const role = sceneRoleLabel(scene.role, language);
  const image = Object.hasOwn(SCENE_ILLUSTRATIONS, scene.role) ? SCENE_ILLUSTRATIONS[scene.role] : SCENE_ILLUSTRATIONS.beginning;

  const inSceneCharIds = scene.characters || [];
  const availableForAdd = allCharacters.filter(
    (c) => !inSceneCharIds.includes(c.id)
  );

  const handleAddChar = (charId) => {
    onSceneChange({ characters: [...inSceneCharIds, charId] });
  };

  const handleRemoveChar = (charId) => {
    onSceneChange({
      characters: inSceneCharIds.filter((id) => id !== charId)
    });
  };

  const labels = {
    title: t("storyBuilder.scene.title"),
    description: t("storyBuilder.scene.description"),
    descPlaceholder: t("storyBuilder.scene.descPlaceholder"),
    characters: t("storyBuilder.scene.characters"),
    addChar: t("storyBuilder.scene.addChar"),
    noChars: t("storyBuilder.scene.noChars"),
    illustration: t("spxWizard.stationIllustration"),
    illustrationHint: t("spxWizard.stationIllustrationHint"),
    editPrompt: t("spxWizard.editStationIllustration"),
    regenerate: t("storyBuilder.scene.regenerate"),
    titlePlaceholder: t("storyBuilder.scene.titlePlaceholder")
  };

  return (
    <details className="group/scene overflow-hidden rounded-xl bg-white dark:bg-gray-900">
      <summary className="relative isolate flex min-h-36 cursor-pointer list-none items-end overflow-hidden rounded-xl bg-slate-900 text-white outline-offset-[-3px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-white [&::-webkit-details-marker]:hidden">
        <img src={image} alt="" draggable={false}
          className="pointer-events-none absolute inset-0 -z-10 h-full w-full object-cover" />
        <span className="flex w-full min-w-0 items-end gap-3 bg-gradient-to-t from-slate-950 via-slate-950/90 to-transparent px-4 pb-3 pt-10">
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-slate-100">{sceneNumber} · {role}</span>
            {scene.title && <span dir="auto" className="block break-words font-bold">{scene.title}</span>}
            {scene.description && <span dir="auto" className="line-clamp-2 break-words text-sm text-white/90">{scene.description}</span>}
          </span>
          <span className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-lg bg-slate-950/70 px-2 text-xs font-semibold">
            <span className="group-open/scene:hidden">{t("spxWizard.editStation")}</span>
            <span className="hidden group-open/scene:inline">{t("spxWizard.closeStation")}</span>
            <ChevronDown size={16} aria-hidden="true" className="group-open/scene:rotate-180" />
          </span>
        </span>
      </summary>
      <div className="space-y-4 p-4" dir={isRTL ? "rtl" : "ltr"}>
        {/* Title field */}
        <div>
          <Label htmlFor={`${fieldId}-title`} className="mb-1 block text-sm font-semibold">
            {labels.title}
          </Label>
          <Input
            id={`${fieldId}-title`}
            value={scene.title || ""}
            onChange={(e) => onSceneChange({ title: e.target.value })}
            placeholder={labels.titlePlaceholder}
            dir={isRTL ? "rtl" : "ltr"}
            maxLength={80}
            className="min-h-11 font-semibold"
          />
        </div>

        {/* Description field */}
        <div>
          <Label htmlFor={`${fieldId}-summary`} className="mb-1 block text-sm font-semibold">
            {labels.description}
          </Label>
          <Textarea
            id={`${fieldId}-summary`}
            value={scene.description || ""}
            onChange={(e) =>
              onSceneChange({ description: e.target.value })
            }
            placeholder={labels.descPlaceholder}
            dir={isRTL ? "rtl" : "ltr"}
            rows={3}
            maxLength={500}
            className="resize-none"
          />
        </div>

        {/* Characters chips */}
        <div>
          <div
            className="mb-2 flex items-center gap-2"
          >
            <Users
              className="h-4 w-4 text-purple-600"
              aria-hidden="true"
            />
            <Label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
              {labels.characters}
            </Label>
          </div>

          <div
            className="flex flex-wrap gap-2"
          >
            <AnimatePresence>
              {inSceneCharIds.length === 0 && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-xs italic text-gray-400 dark:text-gray-500"
                >
                  {labels.noChars}
                </motion.p>
              )}
              {inSceneCharIds.map((cid) => (
                <CharacterChip
                  key={cid}
                  characterId={cid}
                  allCharacters={allCharacters}
                  language={language}
                  onRemove={() => handleRemoveChar(cid)}
                />
              ))}
            </AnimatePresence>

            {/* Add character buttons (chips for characters not yet in scene) */}
            {availableForAdd.map((c) => (
              <button
                type="button"
                key={`add-${c.id}`}
                onClick={() => handleAddChar(c.id)}
                aria-label={`${labels.addChar}: ${c.name}`}
                className="inline-flex min-h-11 items-center gap-1.5 px-2.5 py-1 rounded-full border border-dashed border-gray-300 dark:border-gray-600 text-xs font-medium text-gray-500 dark:text-gray-400 hover:border-purple-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/30 transition-colors"
              >
                <span className="text-base leading-none" aria-hidden="true">
                  {c.emoji || "+"}
                </span>
                <span className="max-w-[80px] truncate">{c.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Illustration prompt (collapsed by default) */}
        <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
          <div
            className="flex flex-wrap items-center justify-between gap-2"
          >
            <div
              className="flex items-center gap-2"
            >
              <ImageIcon
                className="h-4 w-4 text-amber-500"
                aria-hidden="true"
              />
              <Label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                {labels.illustration}
              </Label>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowPromptEditor(!showPromptEditor)}
              aria-expanded={showPromptEditor}
              className="min-h-11 text-xs px-2"
            >
              {showPromptEditor ? cardLabels.hide : labels.editPrompt}
            </Button>
          </div>

          <AnimatePresence>
            {showPromptEditor && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 mb-1">
                  {labels.illustrationHint}
                </p>
                <Textarea
                  value={scene.illustration_prompt || ""}
                  onChange={(e) =>
                    onSceneChange({
                      illustration_prompt: e.target.value
                    })
                  }
                  dir={isRTL ? "rtl" : "ltr"}
                  rows={3}
                  maxLength={600}
                  className="resize-none text-sm bg-amber-50/40 dark:bg-amber-950/20"
                  aria-label={labels.illustration}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {!showPromptEditor && scene.illustration_prompt && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 line-clamp-2 italic">
              {scene.illustration_prompt}
            </p>
          )}
        </div>

        {/* Per-scene regenerate */}
        {onRegenerate && (
          <div
            className="flex justify-end pt-1"
          >
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onRegenerate}
              disabled={isRegenerating}
              className="min-h-11 gap-1.5 text-purple-600 hover:text-purple-700 hover:bg-purple-50 dark:hover:bg-purple-950/30"
              aria-label={labels.regenerate}
            >
              {isRegenerating ? (
                <RefreshCw
                  className="h-3.5 w-3.5 animate-spin"
                  aria-hidden="true"
                />
              ) : (
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              <span className="text-xs">{labels.regenerate}</span>
            </Button>
          </div>
        )}
      </div>
    </details>
  );
}
