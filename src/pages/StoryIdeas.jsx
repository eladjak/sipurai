
import { useState, useEffect } from "react";
import { useI18n } from "@/components/i18n/i18nProvider";
import { StoryIdea } from "@/entities/StoryIdea";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import {
  InvokeLLM
} from "@/integrations/Core";
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
import { useToast } from "@/components/ui/use-toast";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Import components
import IdeaGenerator from "../components/storyIdeas/IdeaGenerator";
import SavedIdeas from "../components/storyIdeas/SavedIdeas";
import DailyPrompt from "../components/storyIdeas/DailyPrompt";

export default function StoryIdeas() {
  const { toast } = useToast();
  const { t, language, isRTL } = useI18n();
  const { user: hookUser } = useCurrentUser();
  // currentLanguage: the AI generation language (from user profile, may differ from UI language)
  const [currentLanguage, setCurrentLanguage] = useState("english");
  const [savedIdeas, setSavedIdeas] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("generate");

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
          <SavedIdeas 
            ideas={savedIdeas}
            currentLanguage={currentLanguage}
            isRTL={isRTL}
            onIdeaUpdated={handleIdeaSaved}
          />
        </TabsContent>

        <TabsContent value="daily">
          <DailyPrompt 
            currentLanguage={currentLanguage}
            isRTL={isRTL}
            onIdeaSaved={handleIdeaSaved}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
