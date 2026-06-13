
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useI18n } from "@/components/i18n/i18nProvider";
import { StoryIdea } from "@/entities/StoryIdea";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import {
  InvokeLLM
} from "@/integrations/Core";
import { createPageUrl } from "@/utils";
import { moderateInput, buildSafetyPromptPrefix } from "@/utils/content-moderation";
import {
  Lightbulb,
  Sparkles,
  BookOpen,
  Save,
  RefreshCw,
  Star
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Import components
import IdeaGenerator from "../components/storyIdeas/IdeaGenerator";
import SavedIdeas from "../components/storyIdeas/SavedIdeas";
import DailyPrompt from "../components/storyIdeas/DailyPrompt";

// Session key used to hand an idea off to the BookWizard for prefill.
const PENDING_IDEA_KEY = "sipurai_pending_idea";

export default function StoryIdeas() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { t, language, isRTL } = useI18n();
  const { user: hookUser } = useCurrentUser();
  // currentLanguage: the AI generation language (from user profile, may differ from UI language)
  const [currentLanguage, setCurrentLanguage] = useState("english");
  const [savedIdeas, setSavedIdeas] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("generate");

  // Edit-in-place dialog state for a saved idea
  const [editingIdea, setEditingIdea] = useState(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  // Delete confirmation state
  const [deletingId, setDeletingId] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Daily prompt tab state
  const [dailyPrompt, setDailyPrompt] = useState(null);
  const [isDailyLoading, setIsDailyLoading] = useState(false);

  // New state for idea generation within this page
  const [ideaParams, setIdeaParams] = useState({
    childNames: [],
    childAge: "5-7",
    genres: [],
    themes: [],
    characters: [],
    setting: [],
    additionalDetails: ""
  });
  const [generatedIdea, setGeneratedIdea] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    const loadUserSettings = async () => {
      try {
        // currentLanguage is the AI generation language from user profile
        const storedLanguage = hookUser?.language || localStorage.getItem("language") || "english";
        setCurrentLanguage(storedLanguage);

        // Load saved ideas
        const ideas = await StoryIdea.list("-created_date", 20);
        setSavedIdeas(ideas);

      } catch (error) {
        toast({ variant: "destructive", description: t("common.loadError") });
      } finally {
        setIsLoading(false);
      }
    };

    loadUserSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hookUser]);

  const handleIdeaSaved = async () => {
    // Reload saved ideas
    try {
      const ideas = await StoryIdea.list("-created_date", 20);
      setSavedIdeas(ideas);
    } catch (error) {
      // silently handled
    }
  };
  
  const constructPromptForIdea = (params, targetLanguage) => {
    // Moderate free-text user input
    const moderatedDetails = params.additionalDetails
      ? moderateInput(params.additionalDetails, 'additionalDetails')
      : null;

    if (moderatedDetails && moderatedDetails.blocked) {
      toast({ variant: "destructive", description: t("storyIdeas.inappropriateInput") });
      return null;
    }

    const languageInstruction = targetLanguage === "hebrew" ?
      "יש ליצור את כל התוכן בעברית בלבד. " :
      targetLanguage === "yiddish" ?
      "Create all content in Yiddish only. " :
      "Create all content in English only. ";

    const safetyPrefix = buildSafetyPromptPrefix(params.childAge || '5-10');

    let prompt = `${safetyPrefix}${languageInstruction}Create a detailed children's story idea with the following parameters:\n\n`;

    if (params.childNames && params.childNames.length > 0) {
      prompt += `Main characters: ${params.childNames.join(', ')}\n`;
    }

    if (params.childAge) {
      prompt += `Target age: ${params.childAge} years old\n`;
    }

    if (params.genres && params.genres.length > 0) {
      prompt += `Genre: ${params.genres.join(', ')}\n`;
    }

    if (params.themes && params.themes.length > 0) {
      prompt += `Themes: ${params.themes.join(', ')}\n`;
    }

    if (params.characters && params.characters.length > 0) {
      prompt += `Additional characters: ${params.characters.join(', ')}\n`;
    }

    if (params.setting && params.setting.length > 0) {
      prompt += `Setting: ${params.setting.join(', ')}\n`;
    }

    if (moderatedDetails?.sanitized) {
      prompt += `Additional details: ${moderatedDetails.sanitized}\n`;
    }

    prompt += `\nPlease provide:\n1. A catchy, age-appropriate title\n2. A brief but engaging description (2-3 sentences)\n3. 3-5 key plot points that create a complete story arc\n4. Character development opportunities\n5. A clear moral lesson or educational value\n\nMake sure everything is appropriate for children and engaging for the target age group.`;

    return prompt;
  };
  
  const generateIdea = async () => {
    try {
      setIsGenerating(true);
      setGeneratedIdea(null); // Clear previous idea
      const targetLanguage = currentLanguage;
      const prompt = constructPromptForIdea(ideaParams, targetLanguage);

      // Content moderation blocked the input
      if (!prompt) {
        setIsGenerating(false);
        return;
      }

      const result = await InvokeLLM({
        prompt: prompt,
        response_json_schema: {
          type: "object",
          properties: {
            title: { type: "string" },
            description: { type: "string" },
            plot_points: { type: "array", items: { type: "string" } },
            character_development: { type: "string" },
            moral_lesson: { type: "string" }
          },
          required: ["title", "description", "plot_points", "moral_lesson"]
        }
      });

      if (result) {
        setGeneratedIdea({
            ...result,
            language: targetLanguage,
            parameters: JSON.stringify(ideaParams)
        });
      }
    } catch (error) {
      toast({ variant: "destructive", description: t("storyIdeas.generateError") });
    } finally {
      setIsGenerating(false);
    }
  };
  
  const saveGeneratedIdea = async () => {
      if (!generatedIdea) return;
      try {
          await StoryIdea.create(generatedIdea);
          toast({ description: t("storyIdeas.saveSuccess") });
          handleIdeaSaved(); // Reload saved ideas
          setGeneratedIdea(null); // Clear generated idea after saving
      } catch (error) {
          toast({ variant: "destructive", description: t("storyIdeas.saveFailed") });
      }
  };

  // --- Saved-idea actions (previously dead — now wired end-to-end) ---

  // "Use idea": stash the idea and jump into the book wizard, which prefills
  // the topic/title/description on mount.
  const handleUseIdea = (idea) => {
    if (!idea) return;
    try {
      sessionStorage.setItem(
        PENDING_IDEA_KEY,
        JSON.stringify({
          title: idea.title || "",
          description: idea.description || "",
          moral: idea.moral_lesson || "",
          language: idea.language || currentLanguage,
        })
      );
    } catch {
      // sessionStorage unavailable (private mode) — navigate anyway.
    }
    navigate(createPageUrl("BookWizard"));
  };

  const handleEditIdea = (idea) => {
    setEditingIdea({ ...idea });
  };

  const handleSaveEdit = async () => {
    if (!editingIdea?.id) return;
    if (!editingIdea.title?.trim()) {
      toast({ variant: "destructive", description: t("savedIdeas.titleRequired") });
      return;
    }
    try {
      setIsSavingEdit(true);
      await StoryIdea.update(editingIdea.id, {
        title: editingIdea.title.trim(),
        description: editingIdea.description?.trim() || "",
      });
      toast({ description: t("savedIdeas.updateSuccess") });
      setEditingIdea(null);
      await handleIdeaSaved();
    } catch (error) {
      toast({ variant: "destructive", description: t("savedIdeas.updateFailed") });
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingId) return;
    try {
      setIsDeleting(true);
      await StoryIdea.delete(deletingId);
      toast({ description: t("savedIdeas.deleteSuccess") });
      setDeletingId(null);
      await handleIdeaSaved();
    } catch (error) {
      toast({ variant: "destructive", description: t("savedIdeas.deleteFailed") });
    } finally {
      setIsDeleting(false);
    }
  };

  // --- Daily prompt (previously a blank tab — DailyPrompt never received data) ---
  const generateDailyPrompt = async ({ force = false } = {}) => {
    try {
      setIsDailyLoading(true);
      const today = new Date().toDateString();
      if (!force) {
        const cached = localStorage.getItem("dailyPrompt");
        const cacheDate = localStorage.getItem("dailyPromptDate");
        if (cached && cacheDate === today) {
          setDailyPrompt(JSON.parse(cached));
          setIsDailyLoading(false);
          return;
        }
      }

      const safetyPrefix = buildSafetyPromptPrefix("5-10");
      const lang = currentLanguage;
      const languagePrompt =
        lang === "hebrew"
          ? "צור רעיון קצר לסיפור ילדים בעברית לגילאי 5-10. הרעיון צריך להיות מעורר דמיון ומהנה. כלול כותרת קצרה ותיאור קצר (1-2 משפטים). החזר כ-JSON עם השדות title ו-description."
          : lang === "yiddish"
          ? "שרייב אַ קורצן, קינד-פֿרײַנדלעכן פּראָמפּט פֿאַר אַ קינדערגעשיכטע פֿאַר קינדער פֿון 5-10 יאָר. כלל אַ קורצן טיטל און אַ קורצע (1-2 זאַץ) באַשרייַבונג. שיק אַלס JSON מיט טיטל און באַשרייַבונג פֿעלדער."
          : "Generate a creative, child-friendly, short story prompt for children aged 5-10. Include a story title and a brief (1-2 sentence) description. Return as JSON with title and description fields.";

      const result = await InvokeLLM({
        prompt: safetyPrefix + languagePrompt,
        response_json_schema: {
          type: "object",
          properties: {
            title: { type: "string" },
            description: { type: "string" },
          },
        },
      });

      if (result) {
        setDailyPrompt(result);
        localStorage.setItem("dailyPrompt", JSON.stringify(result));
        localStorage.setItem("dailyPromptDate", today);
      }
    } catch (error) {
      toast({ variant: "destructive", description: t("storyIdeas.generateError") });
    } finally {
      setIsDailyLoading(false);
    }
  };

  // Lazily generate the daily prompt the first time the Daily tab is opened.
  useEffect(() => {
    if (activeTab === "daily" && !dailyPrompt && !isDailyLoading) {
      generateDailyPrompt();
    }
  }, [activeTab]);

  const handleSaveDailyPrompt = async () => {
    if (!dailyPrompt) return;
    try {
      await StoryIdea.create({
        title: dailyPrompt.title,
        description: dailyPrompt.description,
        language: currentLanguage,
      });
      toast({ description: t("storyIdeas.saveSuccess") });
      await handleIdeaSaved();
    } catch (error) {
      toast({ variant: "destructive", description: t("storyIdeas.saveFailed") });
    }
  };


  return (
    <div className="max-w-6xl mx-auto py-8" dir={isRTL ? "rtl" : "ltr"}>
      {/* Header banner with image */}
      <div className="relative mb-8 rounded-2xl overflow-hidden bg-gradient-to-r from-amber-500 via-purple-600 to-indigo-600 p-6 md:p-8 shadow-lg">
        <div className="absolute inset-0 bg-[url('/images/story-ideas.jpg')] bg-cover bg-center opacity-15" />
        <div className={`relative ${isRTL ? 'text-right' : 'text-left'}`}>
          <h1 className="text-3xl font-bold text-white mb-2 drop-shadow-sm">
            {t("storyIdeas.title")}
          </h1>
          <p className="text-purple-100">
            {t("storyIdeas.subtitle")}
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="generate" className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            {t("storyIdeas.generate")}
          </TabsTrigger>
          <TabsTrigger value="saved" className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            {t("storyIdeas.saved")}
            {savedIdeas.length > 0 && (
              <Badge variant="secondary" className="ms-1">
                {savedIdeas.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="daily" className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4" />
            {t("storyIdeas.daily")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="generate">
          <div className="space-y-6">
            <IdeaGenerator 
              ideaParams={ideaParams}
              onInputChange={(field, value) => setIdeaParams(prev => ({...prev, [field]: value}))}
              onGenerate={generateIdea}
              currentLanguage={currentLanguage}
              isRTL={isRTL}
              isGenerating={isGenerating} // Pass isGenerating to disable button in child
            />
            {generatedIdea && (
                <Card className="border-0 shadow-xl bg-gradient-to-br from-purple-50 via-white to-indigo-50 dark:from-purple-900/30 dark:via-gray-800 dark:to-indigo-900/30 rounded-2xl overflow-hidden">
                    {/* Accent bar */}
                    <div className="h-1 bg-gradient-to-r from-purple-500 via-indigo-500 to-violet-500" />
                    <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-2 text-xl">
                            <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 shadow-md">
                                <Sparkles className="h-5 w-5 text-white" />
                            </div>
                            <span className="bg-gradient-to-r from-purple-700 to-indigo-600 dark:from-purple-300 dark:to-indigo-300 bg-clip-text text-transparent">
                                {t("storyIdeas.generatedIdeaTitle")}
                            </span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="p-4 rounded-xl bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-purple-100 dark:border-purple-800/50">
                            <p className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
                                {generatedIdea.title}
                            </p>
                            <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                                {generatedIdea.description}
                            </p>
                        </div>
                        {generatedIdea.plot_points && generatedIdea.plot_points.length > 0 && (
                            <div className="space-y-2">
                                <p className="text-sm font-semibold text-purple-700 dark:text-purple-300 uppercase tracking-wide">
                                    {t("storyIdeas.plotPointsLabel")}
                                </p>
                                <ul className="space-y-1.5">
                                    {generatedIdea.plot_points.slice(0, 3).map((point, i) => (
                                        <li key={i} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
                                            <span className="mt-0.5 flex-shrink-0 h-5 w-5 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 text-xs font-bold flex items-center justify-center">
                                                {i + 1}
                                            </span>
                                            {point}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        {generatedIdea.moral_lesson && (
                            <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/30">
                                <Star className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
                                <p className="text-sm text-amber-800 dark:text-amber-200">
                                    <strong>{t("storyIdeas.moralLabel")}:</strong> {generatedIdea.moral_lesson}
                                </p>
                            </div>
                        )}
                        <div className="flex gap-2 pt-2">
                            <Button
                                onClick={saveGeneratedIdea}
                                className="relative bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-md rounded-xl overflow-hidden group"
                            >
                                <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                                <Save className={`relative h-4 w-4 ${isRTL ? 'ms-2' : 'me-2'}`} />
                                <span className="relative">{t("storyIdeas.saveButton")}</span>
                            </Button>
                            <Button
                                variant="outline"
                                onClick={generateIdea}
                                disabled={isGenerating}
                                className="border-purple-200 dark:border-purple-800 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-xl"
                            >
                                <RefreshCw className={`h-4 w-4 ${isRTL ? 'ms-2' : 'me-2'} ${isGenerating ? 'animate-spin' : ''}`} />
                                {t("storyIdeas.regenerateButton")}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="saved">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" dir={isRTL ? "rtl" : "ltr"}>
              {Array.from({ length: 6 }).map((_, i) => (
                <Card key={i} className="overflow-hidden">
                  <CardHeader className="pb-2">
                    <Skeleton className="h-5 w-3/4" />
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-5/6" />
                    <Skeleton className="h-6 w-20 rounded-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <SavedIdeas
              ideas={savedIdeas}
              currentLanguage={currentLanguage}
              isRTL={isRTL}
              onUseIdea={handleUseIdea}
              onEditIdea={handleEditIdea}
              onDeleteIdea={(id) => setDeletingId(id)}
              onGenerateNew={() => setActiveTab("generate")}
            />
          )}
        </TabsContent>

        <TabsContent value="daily">
          {isDailyLoading ? (
            <Card className="bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-700 mb-6">
              <CardHeader className="space-y-2">
                <Skeleton className="h-5 w-1/3" />
                <Skeleton className="h-4 w-1/2" />
              </CardHeader>
              <CardContent className="space-y-3">
                <Skeleton className="h-5 w-2/5" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-10 w-40 rounded-md" />
              </CardContent>
            </Card>
          ) : (
            <DailyPrompt
              prompt={dailyPrompt}
              isRTL={isRTL}
              onUse={() => handleUseIdea(dailyPrompt)}
              onRefresh={() => generateDailyPrompt({ force: true })}
              onDismiss={handleSaveDailyPrompt}
            />
          )}
        </TabsContent>
      </Tabs>

      {/* Edit saved idea dialog */}
      <Dialog open={!!editingIdea} onOpenChange={(open) => !open && setEditingIdea(null)}>
        <DialogContent dir={isRTL ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle className={isRTL ? "text-right" : "text-left"}>
              {t("savedIdeas.editTitle")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="edit-idea-title">
                {t("savedIdeas.titleLabel")}
              </label>
              <Input
                id="edit-idea-title"
                value={editingIdea?.title || ""}
                onChange={(e) => setEditingIdea((prev) => ({ ...prev, title: e.target.value }))}
                dir={isRTL ? "rtl" : "ltr"}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="edit-idea-desc">
                {t("savedIdeas.descLabel")}
              </label>
              <Textarea
                id="edit-idea-desc"
                rows={4}
                value={editingIdea?.description || ""}
                onChange={(e) => setEditingIdea((prev) => ({ ...prev, description: e.target.value }))}
                dir={isRTL ? "rtl" : "ltr"}
              />
            </div>
          </div>
          <DialogFooter className={isRTL ? "sm:flex-row-reverse sm:justify-start gap-2" : "gap-2"}>
            <Button variant="outline" onClick={() => setEditingIdea(null)} disabled={isSavingEdit}>
              {t("common.cancel")}
            </Button>
            <Button onClick={handleSaveEdit} disabled={isSavingEdit} className="bg-purple-600 hover:bg-purple-700">
              {isSavingEdit && <RefreshCw className={`h-4 w-4 animate-spin ${isRTL ? "ms-2" : "me-2"}`} />}
              {t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
        <AlertDialogContent dir={isRTL ? "rtl" : "ltr"}>
          <AlertDialogHeader>
            <AlertDialogTitle className={isRTL ? "text-right" : "text-left"}>
              {t("savedIdeas.deleteTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription className={isRTL ? "text-right" : "text-left"}>
              {t("savedIdeas.deleteConfirm")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className={isRTL ? "sm:flex-row-reverse sm:justify-start gap-2" : "gap-2"}>
            <AlertDialogCancel disabled={isDeleting}>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleConfirmDelete(); }}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isDeleting && <RefreshCw className={`h-4 w-4 animate-spin ${isRTL ? "ms-2" : "me-2"}`} />}
              {t("savedIdeas.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
