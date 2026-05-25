
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Sparkles,
  Image,
  Video,
  Music,
  Zap,
  Crown,
  Lock,
  CheckCircle,
  Settings,
  Info,
  Wand2,
  Rocket,
  Type,
  Plus,
  RotateCw // New import for spinner icon
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Input } from '@/components/ui/input'; // New import for Input component
import ModelSelector, { getRoutingIdForUiModel, isUiModelWired } from './ModelSelector';
import SmartAutoSelector from './SmartAutoSelector';
import TextOverlay from './TextOverlay'; // Import the new component
import StoryVideoButton from '@/components/storyVideo/StoryVideoButton'; // Story → Video MVP (Remotion + Ken Burns)
import { GenerateImage, UploadFile } from '@/integrations/Core'; // New imports for integrations
import { useI18n } from '@/components/i18n/i18nProvider';
import { pickBestModel } from '@/lib/smartModelPicker';

const LS_KEY_MANUAL_PICK = 'sipurai_last_manual_model';
const LS_KEY_AUTO_MODE = 'sipurai_ai_auto_mode';

export default function AIStudio({
  currentModel,
  onModelChange,
  userTier = "free",
  credits = { used: 0, total: 50 },
  currentLanguage = "english",
  story = null // Optional: a story ({ pages:[], language, genre }) enables "צור וידאו מהסיפור"
}) {
  const [selectedCategory, setSelectedCategory] = useState("image");
  const [mode, setMode] = useState('simple');
  const [selectedVoice, setSelectedVoice] = useState('adam');
  const [generatedImageUrl, setGeneratedImageUrl] = useState(null);
  const [showOverlay, setShowOverlay] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false); // New state for loading
  const [prompt, setPrompt] = useState(''); // New state for prompt input

  // Smart-mode toggle (auto picks model from prompt + tier; manual = user picks)
  // Default 'auto' on first visit. Persisted in localStorage so user pref survives reload.
  const [selectionMode, setSelectionMode] = useState(() => {
    if (typeof window === 'undefined') return 'auto';
    const stored = window.localStorage?.getItem(LS_KEY_AUTO_MODE);
    return stored === 'manual' ? 'manual' : 'auto';
  });

  // Last manual pick — used as smart-default when prompt has no strong signal.
  const [lastManualPick, setLastManualPick] = useState(() => {
    if (typeof window === 'undefined') return null;
    return window.localStorage?.getItem(LS_KEY_MANUAL_PICK) || null;
  });

  // Persist mode change
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage?.setItem(LS_KEY_AUTO_MODE, selectionMode);
  }, [selectionMode]);

  const { t, isRTL } = useI18n();

  const recommendedModels = {
    quality: { id: 'midjourney' },
    text: { id: 'ideogram-basic' },
    fast: { id: 'sdxl' }
  };

  const SimpleModeCard = ({ icon, title, description, model, isSelected, onSelect }) => (
    <Card
      className={`cursor-pointer transition-all duration-200 hover:shadow-lg ${isSelected ? 'ring-2 ring-purple-500 shadow-xl' : ''}`}
      onClick={() => onSelect(model)}
    >
      <CardHeader>
        <CardTitle className="flex items-center gap-3 text-lg">{icon} {title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-gray-500 dark:text-gray-400">{description}</p>
      </CardContent>
    </Card>
  );

  const voices = [
    { id: 'adam', name: 'Adam (Male, Calm)', tier: 'free' },
    { id: 'rachel', name: 'Rachel (Female, Expressive)', tier: 'free' },
    { id: 'david', name: 'David (Male, Deep)', tier: 'creator' },
    { id: 'sarah', name: 'Sarah (Female, Storyteller)', tier: 'creator' },
    { id: 'liam', name: 'Liam (Male, Professional)', tier: 'pro' }
  ];

  const canAccessVoice = (voice) => {
    const tierHierarchy = { free: 0, creator: 1, pro: 2, premium: 3 };
    const userTierLevel = tierHierarchy[userTier] || 0;
    const voiceTierLevel = tierHierarchy[voice.tier] || 0;
    return userTierLevel >= voiceTierLevel;
  }

  // Wrap onModelChange so manual picks persist as "smart-default" for next session.
  const handleManualModelChange = (model) => {
    if (model?.id) {
      const routingId = getRoutingIdForUiModel(model.id);
      if (routingId && typeof window !== 'undefined') {
        window.localStorage?.setItem(LS_KEY_MANUAL_PICK, routingId);
        setLastManualPick(routingId);
      }
    }
    onModelChange?.(model);
  };

  // Resolve which routing-id to send to the backend based on current mode.
  const resolveRoutingModelId = () => {
    if (selectionMode === 'auto') {
      const pick = pickBestModel({ prompt, userTier, lastManualPick });
      return pick.modelId;
    }
    // Manual mode — use currentModel selection if it's wired, otherwise fall back to auto pick.
    if (currentModel?.id && isUiModelWired(currentModel.id)) {
      return getRoutingIdForUiModel(currentModel.id);
    }
    const pick = pickBestModel({ prompt, userTier, lastManualPick });
    return pick.modelId;
  };

  const handleImageGeneration = async () => {
    if (!prompt.trim()) return;
    // In manual mode require a model; in auto mode the picker always returns one.
    if (selectionMode === 'manual' && !currentModel) return;

    try {
      setIsGenerating(true);

      const modelId = resolveRoutingModelId();

      // Route to the correct backend (DALL-E / Gemini Pro / Gemini Fast) via modelId.
      const result = await GenerateImage({
        prompt,
        modelId,
      });

      setGeneratedImageUrl(result.url); // Assuming result has a 'url' property
      setShowOverlay(true);
    } catch (error) {
      alert(t('aiStudio.warning.generateFailed') || 'Failed to generate image. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveOverlay = async (data) => {
    try {
      // Upload the final image blob
      const uploadResult = await UploadFile({
        file: data.imageBlob // Assuming data.imageBlob is a File or Blob object
      });

      setShowOverlay(false);
      setGeneratedImageUrl(null);
      setPrompt(''); // Clear prompt after successful save

      // Show success message
      alert("Image with text saved successfully!");

    } catch (error) {
      alert("Failed to save image. Please try again.");
    }
  };

  const handleCancelOverlay = () => {
    setShowOverlay(false);
    setGeneratedImageUrl(null);
  };

  return (
    <div className="space-y-6" dir={isRTL ? "rtl" : "ltr"}>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-purple-500" />
                {t("aiStudio.title")}
              </CardTitle>
              <CardDescription>{t("aiStudio.subtitle")}</CardDescription>
            </div>
            <div className="flex items-center gap-4 flex-wrap">
               {/* Auto / Manual Switch (default: auto) */}
              <div className="flex items-center space-x-2 rtl:space-x-reverse">
                <Label htmlFor="selection-mode-switch" className="text-sm font-medium">
                  {t('aiStudio.selectionMode.auto')}
                </Label>
                <Switch
                  id="selection-mode-switch"
                  checked={selectionMode === 'manual'}
                  onCheckedChange={(checked) => setSelectionMode(checked ? 'manual' : 'auto')}
                  aria-label={t('aiStudio.selectionMode.toggleAria')}
                />
                <Label htmlFor="selection-mode-switch" className="text-sm font-medium">
                  {t('aiStudio.selectionMode.manual')}
                </Label>
              </div>

               {/* Simple / Advanced Switch (only relevant when manual) */}
              <div
                className={`flex items-center space-x-2 rtl:space-x-reverse transition-opacity ${
                  selectionMode === 'auto' ? 'opacity-50 pointer-events-none' : ''
                }`}
              >
                <Label htmlFor="mode-switch" className="text-sm font-medium">{t("aiStudio.mode.simple")}</Label>
                <Switch
                  id="mode-switch"
                  checked={mode === 'advanced'}
                  onCheckedChange={(checked) => setMode(checked ? 'advanced' : 'simple')}
                  disabled={selectionMode === 'auto'}
                />
                <Label htmlFor="mode-switch" className="text-sm font-medium">{t("aiStudio.mode.advanced")}</Label>
              </div>

              {/* Credits and Tier Info */}
              <div className="text-right">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                    {userTier} {t("aiStudio.plan")}
                  </Badge>
                  {userTier !== "pro" && (
                    <Button variant="outline" size="sm">
                      <Crown className="h-4 w-4 mr-1 rtl:ml-1" />
                      {t("aiStudio.upgrade")}
                    </Button>
                  )}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  <span>{t("aiStudio.credits")}: </span>
                  <span className="font-medium">
                    {credits.total - credits.used}/{credits.total}
                  </span>
                </div>
                <Progress
                  value={(credits.total - credits.used) / credits.total * 100}
                  className="w-32 h-2 mt-1"
                />
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="image" className="flex items-center gap-2">
            <Image className="h-4 w-4" />
            {t("aiStudio.categories.image")}
          </TabsTrigger>
          <TabsTrigger value="video" className="flex items-center gap-2">
            <Video className="h-4 w-4" />
            {t("aiStudio.categories.video")}
          </TabsTrigger>
          <TabsTrigger value="audio" className="flex items-center gap-2">
            <Music className="h-4 w-4" />
            {t("aiStudio.categories.audio")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="image" className="mt-6">
          {showOverlay && generatedImageUrl ? (
            <TextOverlay
              imageUrl={generatedImageUrl}
              onSave={handleSaveOverlay}
              onCancel={handleCancelOverlay}
              currentLanguage={currentLanguage}
            />
          ) : (
            <>
              {selectionMode === 'auto' ? (
                <SmartAutoSelector
                  prompt={prompt}
                  userTier={userTier}
                  lastManualPick={lastManualPick}
                />
              ) : mode === 'simple' ? (
                <div className="space-y-4">
                   <h3 className="text-lg font-semibold text-center mb-4">{t("aiStudio.simple.title")}</h3>
                   <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <SimpleModeCard
                        icon="🎨"
                        title={t("aiStudio.simple.quality.title")}
                        description={t("aiStudio.simple.quality.desc")}
                        model={recommendedModels.quality}
                        isSelected={currentModel?.id === recommendedModels.quality.id}
                        onSelect={handleManualModelChange}
                      />
                      <SimpleModeCard
                        icon="🔤"
                        title={t("aiStudio.simple.text.title")}
                        description={t("aiStudio.simple.text.desc")}
                        model={recommendedModels.text}
                        isSelected={currentModel?.id === recommendedModels.text.id}
                        onSelect={handleManualModelChange}
                      />
                       <SimpleModeCard
                        icon="⚡️"
                        title={t("aiStudio.simple.fast.title")}
                        description={t("aiStudio.simple.fast.desc")}
                        model={recommendedModels.fast}
                        isSelected={currentModel?.id === recommendedModels.fast.id}
                        onSelect={handleManualModelChange}
                      />
                   </div>
                </div>
              ) : (
                <ModelSelector
                  category={selectedCategory}
                  selectedModel={currentModel}
                  onModelChange={handleManualModelChange}
                  userTier={userTier}
                  credits={credits}
                  currentLanguage={currentLanguage}
                />
              )}

              {/* Prompt Input and Generate Button */}
              <div className="mt-6 space-y-4">
                <div>
                  <Label htmlFor="image-prompt" className="text-sm font-medium">
                    {t("aiStudio.prompt.label")}
                  </Label>
                  <div className="mt-2 flex gap-2">
                    <Input
                      id="image-prompt"
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      placeholder={t("aiStudio.prompt.placeholder")}
                      className="flex-1"
                      dir={isRTL ? "rtl" : "ltr"}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && !isGenerating) {
                          handleImageGeneration();
                        }
                      }}
                    />
                    <Button
                      onClick={handleImageGeneration}
                      disabled={
                        (selectionMode === 'manual' && !currentModel) ||
                        !prompt.trim() ||
                        isGenerating
                      }
                      className="bg-purple-600 hover:bg-purple-700"
                    >
                      {isGenerating ? (
                        <>
                          <RotateCw className="mr-2 h-4 w-4 animate-spin" />
                          {t("aiStudio.button.generating")}
                        </>
                      ) : (
                        <>
                          <Sparkles className="mr-2 h-4 w-4" />
                          {t("aiStudio.button.generate")}
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {selectionMode === 'manual' && !currentModel && (
                  <p className="text-sm text-amber-600 dark:text-amber-400">
                    {t("aiStudio.warning.noModel")}
                  </p>
                )}
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="video" className="mt-6 space-y-6">
           {/* Story → Video (MVP: Remotion + Ken Burns + existing narration).
               Shown when a story with pages is available. */}
           {story && Array.isArray(story.pages) && story.pages.length > 0 && (
             <StoryVideoButton
               story={story}
               userTier={userTier}
               usedThisMonth={credits?.videosUsed ?? 0}
             />
           )}
           <ModelSelector
              category="video"
              selectedModel={currentModel}
              onModelChange={onModelChange}
              userTier={userTier}
              credits={credits}
              currentLanguage={currentLanguage}
            />
        </TabsContent>

        <TabsContent value="audio" className="mt-6">
          <Tabs defaultValue="narration" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="narration">{t("aiStudio.audio.narration")}</TabsTrigger>
              <TabsTrigger value="music">{t("aiStudio.audio.music")}</TabsTrigger>
            </TabsList>
            <TabsContent value="narration" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>{t("aiStudio.audio.selectVoice")}</CardTitle>
                  <CardDescription>{t("aiStudio.audio.poweredBy")}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Select value={selectedVoice} onValueChange={setSelectedVoice}>
                    <SelectTrigger>
                      <SelectValue placeholder={t("aiStudio.audio.selectVoice")} />
                    </SelectTrigger>
                    <SelectContent>
                      {voices.map(voice => (
                        <SelectItem key={voice.id} value={voice.id} disabled={!canAccessVoice(voice)}>
                          {voice.name} {!canAccessVoice(voice) && `(${t(`aiStudio.model.${voice.tier}`)})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Card className="bg-gray-50 dark:bg-gray-800/50">
                    <CardHeader>
                      <CardTitle className="text-base">{t("aiStudio.audio.voiceCloning")}</CardTitle>
                      <CardDescription>{t("aiStudio.audio.voiceCloningDesc")}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Button disabled={userTier !== 'pro' && userTier !== 'premium'}>
                        <Plus className="mr-2 h-4 w-4" />
                        {t("aiStudio.audio.uploadVoiceSample")}
                      </Button>
                    </CardContent>
                  </Card>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="music" className="mt-4">
               <ModelSelector
                category="music"
                selectedModel={currentModel}
                onModelChange={onModelChange}
                userTier={userTier}
                credits={credits}
                currentLanguage={currentLanguage}
              />
            </TabsContent>
          </Tabs>
        </TabsContent>
      </Tabs>
    </div>
  );
}
