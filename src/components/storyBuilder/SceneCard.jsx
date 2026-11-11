import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
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
  ChevronUp,
  Trash2
} from "lucide-react";
import heStudio from "@/components/i18n/locales/he/studio";
import enStudio from "@/components/i18n/locales/en/studio";
import { useI18n } from "@/components/i18n/i18nProvider";

/**
 * Maps the canonical scene structure roles to a label key + gradient.
 * Falls back to a default gradient when role is not recognized.
 */
const ROLE_BADGES = {
  beginning: {
    gradient: "from-emerald-400 to-teal-500",
    ring: "ring-emerald-200"
  },
  rising: {
    gradient: "from-blue-400 to-indigo-500",
    ring: "ring-blue-200"
  },
  conflict: {
    gradient: "from-amber-400 to-orange-500",
    ring: "ring-amber-200"
  },
  climax: {
    gradient: "from-rose-400 to-red-500",
    ring: "ring-rose-200"
  },
  resolution: {
    gradient: "from-purple-400 to-fuchsia-500",
    ring: "ring-purple-200"
  },
  end: {
    gradient: "from-violet-400 to-purple-500",
    ring: "ring-violet-200"
  }
};

function getRoleMeta(role, language) {
  const meta = ROLE_BADGES[role] || {
    gradient: "from-slate-400 to-gray-500",
    ring: "ring-slate-200"
  };
  const labels = language === "yiddish" ? heStudio.studio.sceneCard.yiddishRoles :
    language === "hebrew" ? heStudio.studio.sceneCard.roles : enStudio.studio.sceneCard.roles;
  const label = labels[role] || labels.scene;
  return { ...meta, label };
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
          className="ml-0.5 text-gray-400 hover:text-red-500 transition-colors"
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
  const [expanded, setExpanded] = useState(true);
  const [showPromptEditor, setShowPromptEditor] = useState(false);

  const roleMeta = getRoleMeta(scene.role, language);

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
    sceneNumber: t("storyBuilder.scene.scenePrefix"),
    title: t("storyBuilder.scene.title"),
    description: t("storyBuilder.scene.description"),
    descPlaceholder: t("storyBuilder.scene.descPlaceholder"),
    characters: t("storyBuilder.scene.characters"),
    addChar: t("storyBuilder.scene.addChar"),
    noChars: t("storyBuilder.scene.noChars"),
    illustration: t("storyBuilder.scene.illustration"),
    illustrationHint: t("storyBuilder.scene.illustrationHint"),
    editPrompt: t("storyBuilder.scene.editPrompt"),
    regenerate: t("storyBuilder.scene.regenerate"),
    titlePlaceholder: t("storyBuilder.scene.titlePlaceholder")
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25 }}
      dir={isRTL ? "rtl" : "ltr"}
    >
      <Card className={`overflow-hidden border-2 ${roleMeta.ring} dark:border-gray-700`}>
        {/* Header: scene number + role badge + collapse toggle */}
        <div
          className={`flex items-center gap-3 px-4 py-3 bg-gradient-to-r ${roleMeta.gradient} text-white`}
        >
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-white/25 backdrop-blur-sm font-bold text-sm">
            {sceneNumber}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs uppercase tracking-wide text-white/80 font-semibold">
              {roleMeta.label}
            </div>
            <div className="text-sm font-bold truncate">
              {scene.title || labels.titlePlaceholder}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            aria-label={expanded ? cardLabels.collapse : cardLabels.expand}
            aria-expanded={expanded}
            className="p-1 rounded-lg hover:bg-white/20 transition-colors"
          >
            {expanded ? (
              <ChevronUp className="h-5 w-5" aria-hidden="true" />
            ) : (
              <ChevronDown className="h-5 w-5" aria-hidden="true" />
            )}
          </button>
        </div>

        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              key="body"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <CardContent className="p-4 space-y-4">
                {/* Title field */}
                <div>
                  <Label className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1 block">
                    {labels.title}
                  </Label>
                  <Input
                    value={scene.title || ""}
                    onChange={(e) => onSceneChange({ title: e.target.value })}
                    placeholder={labels.titlePlaceholder}
                    dir={isRTL ? "rtl" : "ltr"}
                    maxLength={80}
                    className="font-semibold"
                    aria-label={labels.title}
                  />
                </div>

                {/* Description field */}
                <div>
                  <Label className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1 block">
                    {labels.description}
                  </Label>
                  <Textarea
                    value={scene.description || ""}
                    onChange={(e) =>
                      onSceneChange({ description: e.target.value })
                    }
                    placeholder={labels.descPlaceholder}
                    dir={isRTL ? "rtl" : "ltr"}
                    rows={3}
                    maxLength={500}
                    className="resize-none"
                    aria-label={labels.description}
                  />
                </div>

                {/* Characters chips */}
                <div>
                  <div
                    className={`flex items-center gap-2 mb-2 ${
                      isRTL ? "flex-row-reverse" : ""
                    }`}
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
                    className={`flex flex-wrap gap-2 ${
                      isRTL ? "flex-row-reverse" : ""
                    }`}
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
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-dashed border-gray-300 dark:border-gray-600 text-xs font-medium text-gray-500 dark:text-gray-400 hover:border-purple-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/30 transition-colors"
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
                    className={`flex items-center justify-between gap-2 ${
                      isRTL ? "flex-row-reverse" : ""
                    }`}
                  >
                    <div
                      className={`flex items-center gap-2 ${
                        isRTL ? "flex-row-reverse" : ""
                      }`}
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
                      className="text-xs h-7 px-2"
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
                    className={`flex ${
                      isRTL ? "justify-start" : "justify-end"
                    } pt-1`}
                  >
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={onRegenerate}
                      disabled={isRegenerating}
                      className="gap-1.5 text-purple-600 hover:text-purple-700 hover:bg-purple-50 dark:hover:bg-purple-950/30"
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
              </CardContent>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </motion.div>
  );
}

export { ROLE_BADGES, getRoleMeta };
