import { useState, useRef, useEffect } from 'react';
import { DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Upload,
  Camera,
  Check,
  Loader2,
  Sparkles,
  Image as ImageIcon,
  AlertCircle
} from 'lucide-react';
import { GenerateImage, UploadFile } from "@/integrations/Core";
import { useI18n } from "@/components/i18n/i18nProvider";

export default function AvatarSelector({
  open,
  onOpenChange,
  currentAvatar,
  onSelectAvatar,
}) {
  const [activeTab, setActiveTab] = useState("upload");
  const [previewUrl, setPreviewUrl] = useState(currentAvatar || "");
  const [tempPreviewUrl, setTempPreviewUrl] = useState("");
  const [selectedStyle, setSelectedStyle] = useState("cartoon");
  const [generationPrompt, setGenerationPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);

  // For avatar generation examples
  const stylePrompts = {
    cartoon: "professional cute cartoon style portrait, vibrant colors",
    anime: "high-quality anime style avatar, expressive character",
    pixar: "3D Pixar-style portrait, high quality character",
    disney: "Disney animation style portrait, magical character",
    watercolor: "soft watercolor painting portrait",
    realistic: "realistic digital portrait, photorealistic"
  };

  const { t, isRTL } = useI18n();

  // Set currentAvatar as preview when component mounts or currentAvatar changes
  useEffect(() => {
    if (currentAvatar) {
      setPreviewUrl(currentAvatar);
    }
  }, [currentAvatar]);

  const triggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileUpload = async (file) => {
    setError("");
    setIsUploading(true);

    try {
      const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
      if (!validTypes.includes(file.type)) {
        setError(t("avatar.error.format"));
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        setError(t("avatar.error.size"));
        return;
      }

      // Create a temporary URL for preview immediately
      const tempUrl = URL.createObjectURL(file);
      setTempPreviewUrl(tempUrl);
      
      const response = await UploadFile({
        file: file
      });

      if (response?.file_url) {
        setPreviewUrl(response.file_url);
        onSelectAvatar(response.file_url);
      } else {
        throw new Error('No URL in response');
      }
    } catch (error) {
      setError(t("avatar.error.upload"));
    } finally {
      setIsUploading(false);
      // Clean up the temporary URL
      if (tempPreviewUrl) {
        URL.revokeObjectURL(tempPreviewUrl);
      }
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFileUpload(e.target.files[0]);
    }
  };

  const generateAvatar = async () => {
    if (!generationPrompt.trim()) {
      setError("Please enter a description");
      return;
    }

    setIsGenerating(true);
    setError("");

    try {
      // Use a more direct, focused prompt for the avatar generation
      const prompt = `Create a professional profile picture avatar of a ${generationPrompt}. Style: ${selectedStyle}. Square format with face clearly visible, centered composition, high quality.`;
      
      const result = await GenerateImage({
        prompt: prompt
      });

      if (result?.url) {
        setPreviewUrl(result.url);
        onSelectAvatar(result.url);
      } else {
        throw new Error('No URL in response');
      }
    } catch (error) {
      setError(t("avatar.error.generation"));
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6" dir={isRTL ? "rtl" : "ltr"}>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-2">
          <TabsTrigger value="upload" className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            {t("avatar.upload.tab")}
          </TabsTrigger>
          <TabsTrigger value="create" className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            {t("avatar.create.tab")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upload">
          <div
            className={`border-2 border-dashed rounded-lg p-6 transition-colors ${
              isDragging ? 'border-purple-400 bg-purple-50' : 'border-gray-200'
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            <div className="text-center">
              <ImageIcon className="mx-auto h-12 w-12 text-gray-400" />
              <p className="mt-2">{t("avatar.upload.drag")}</p>
              <p className="text-sm text-gray-500 mt-1">{t("avatar.upload.or")}</p>
              
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={handleFileSelect}
              />
              
              <Button 
                variant="outline" 
                className="mt-2"
                onClick={triggerFileInput}
                disabled={isUploading}
              >
                {isUploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t("avatar.uploading")}
                  </>
                ) : (
                  t("avatar.upload.browse")
                )}
              </Button>
              
              <p className="text-xs text-gray-500 mt-2">
                {t("avatar.formats")}
              </p>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="create">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("avatar.create.prompt")}</Label>
              <Input
                placeholder={t("avatar.create.promptPlaceholder")}
                value={generationPrompt}
                onChange={(e) => setGenerationPrompt(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>{t("avatar.create.style")}</Label>
              <div className="grid grid-cols-2 gap-2">
                {Object.keys(stylePrompts).map((style) => (
                  <Button
                    key={style}
                    variant={selectedStyle === style ? "default" : "outline"}
                    onClick={() => setSelectedStyle(style)}
                    className="capitalize"
                  >
                    {style}
                  </Button>
                ))}
              </div>
            </div>

            <Button
              className="w-full"
              onClick={generateAvatar}
              disabled={isGenerating || !generationPrompt.trim()}
            >
              {isGenerating ? (
                <>
                  <Loader2 className={`${isRTL ? 'ml-2' : 'mr-2'} h-4 w-4 animate-spin`} />
                  {t("avatar.create.generating")}
                </>
              ) : (
                <>
                  <Sparkles className={`${isRTL ? 'ml-2' : 'mr-2'} h-4 w-4`} />
                  {t("avatar.create.generate")}
                </>
              )}
            </Button>
          </div>
        </TabsContent>

        {/* Preview Section */}
        <div className="mt-6">
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-medium mb-4 text-center">{t("avatar.preview")}</h3>
              <div className="relative mx-auto w-32 h-32">
                <Avatar className="w-32 h-32 border-4 border-purple-100 dark:border-purple-900/50">
                  {(previewUrl || tempPreviewUrl) ? (
                    <AvatarImage 
                      src={previewUrl || tempPreviewUrl} 
                      alt="Avatar preview"
                      className="object-cover"
                      onError={(e) => {
                        setError(t("avatar.error.loading"));
                      }}
                    />
                  ) : (
                    <AvatarFallback>
                      <Camera className="h-12 w-12 text-gray-400" />
                    </AvatarFallback>
                  )}
                </Avatar>
              </div>
              
              {/* Add preview URL for debugging - will help identify what's going on */}
              {(previewUrl || tempPreviewUrl) && (
                <div className="mt-4 text-xs text-gray-500 break-all text-center">
                  <p>URL: {previewUrl || tempPreviewUrl}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </Tabs>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-md flex items-start">
          <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5 mr-2" />
          <span>{error}</span>
        </div>
      )}

      <DialogFooter>
        <Button 
          variant="outline" 
          onClick={() => onOpenChange(false)}
        >
          {t("avatar.cancel")}
        </Button>
        
        {/* Add explicit save button */}
        {previewUrl && (
          <Button 
            onClick={() => {
              onSelectAvatar(previewUrl);
              onOpenChange(false);
            }}
          >
            <Check className="mr-2 h-4 w-4" />
            {t("avatar.save")}
          </Button>
        )}
      </DialogFooter>
    </div>
  );
}