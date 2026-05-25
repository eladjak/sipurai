
import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { 
  Lock
} from 'lucide-react';



import { useI18n } from "@/components/i18n/i18nProvider";
import { isModelSupported } from "@/lib/smartModelPicker";

// Map UI model card ids → backend smart-routing ids.
// Models NOT in this map are rendered as "Coming soon" (disabled).
const UI_ID_TO_ROUTING_ID = {
  "sdxl": null, // Open-source — not wired yet, coming soon
  "dall-e-3": "dall-e-3",
  "ideogram-basic": null,
  "flux-fast": null,
  "flux-kontext-fast": null,
  "imagen-3-fast": null,
  "luma-photon-flash": null,
  "flux-kontext-pro": null,
  "flux-pro": null,
  "ideogram-3-turbo": null,
  "imagen-3": null,
  "leonardo-phoenix": null,
  "luma-photon": null,
  "dall-e-3-hd": null,
  "flux-kontext-max": null,
  "flux-ultra": null,
  "gpt-image": null,
  "gpt-image-fast": null,
  "ideogram-3": null,
  "recraft": null,
  "recraft-realistic": null,
  // Synthetic ids exposed for smart routing — these ARE wired:
  "gemini-fast": "gemini-2-5-flash-image",
  "gemini-pro": "gemini-3-pro-image",
};

export function isUiModelWired(uiId) {
  const routingId = UI_ID_TO_ROUTING_ID[uiId];
  return !!routingId && isModelSupported(routingId);
}

export function getRoutingIdForUiModel(uiId) {
  return UI_ID_TO_ROUTING_ID[uiId] || null;
}

export default function ModelSelector({
  category = "image",
  selectedModel,
  onModelChange,
  userTier = "free",
  credits = { used: 0, total: 50 },
  currentLanguage = "english",
  showDetails = true
}) {
  const [models, setModels] = useState([]);
  const { t, isRTL } = useI18n();

  // מודלים מלאים כמו ב-Gamma (מהתמונות שצירפת)
  const modelsByCategory = {
    image: [
      // Free Tier - Wired models (live endpoints)
      {
        id: "gemini-fast",
        name: "Gemini 2.5 Flash Image",
        provider: "Google",
        tier: "free",
        speed: "very-fast",
        quality: "high",
        specialties: ["Cost-tier default", "Hebrew text", "Kids illustration"],
        credits: 1,
        tags: ["recommended"],
        description: "Sipurai's default — fast, cheap, great for kids' books"
      },
      {
        id: "gemini-pro",
        name: "Gemini 3 Pro Image",
        provider: "Google",
        tier: "creator",
        speed: "medium",
        quality: "excellent",
        specialties: ["Hebrew typography", "Rich illustration", "Multi-style"],
        credits: 4,
        tags: ["new"],
        description: "Best Hebrew text fidelity, highest-quality kids' book art"
      },
      // Free Tier - Basic Models
      {
        id: "sdxl",
        name: "Stable Diffusion XL",
        provider: "Stability AI",
        tier: "free",
        speed: "fast",
        quality: "good",
        specialties: ["Open source", "Fast generation", "General purpose"],
        credits: 1,
        tags: [],
        description: "Open-source model, great for general illustrations"
      },
      {
        id: "dall-e-3",
        name: "DALL-E 3",
        provider: "OpenAI",
        tier: "free",
        speed: "medium",
        quality: "high",
        specialties: ["Complex prompts", "Creative scenes", "Detailed understanding"],
        credits: 2,
        tags: [],
        description: "Advanced understanding of complex prompts"
      },

      // Creator Tier - Intermediate Models  
      {
        id: "ideogram-basic",
        name: "Ideogram Basic",
        provider: "Ideogram",
        tier: "creator",
        speed: "medium",
        quality: "good",
        specialties: ["Text in images", "Hebrew support", "Typography"],
        credits: 2,
        tags: ["recommended"],
        description: "Excellent for text integration, supports Hebrew text"
      },
      {
        id: "flux-fast",
        name: "Flux Fast 1.1",
        provider: "Black Forest",
        tier: "creator",
        speed: "very-fast",
        quality: "good",
        specialties: ["Quick iterations", "Concept art", "Sketching"],
        credits: 2,
        tags: ["new"],
        description: "Ultra-fast generation for rapid prototyping"
      },
      {
        id: "flux-kontext-fast",
        name: "Flux Kontext Fast",
        provider: "Black Forest",
        tier: "creator",
        speed: "fast",
        quality: "high",
        specialties: ["Context understanding", "Scene coherence", "Character consistency"],
        credits: 3,
        tags: ["new"],
        description: "Fast context-aware generation with good consistency"
      },
      {
        id: "imagen-3-fast",
        name: "Imagen 3 Fast",
        provider: "Google",
        tier: "creator",
        speed: "fast",
        quality: "high",
        specialties: ["Photorealism", "Google's latest", "Technical accuracy"],
        credits: 3,
        tags: ["new"],
        description: "Google's latest fast image generation model"
      },
      {
        id: "luma-photon-flash",
        name: "Luma Photon Flash",
        provider: "Luma",
        tier: "creator",
        speed: "very-fast",
        quality: "good",
        specialties: ["Lightning fast", "Real-time generation", "Interactive use"],
        credits: 2,
        tags: [],
        description: "Fastest generation for real-time applications"
      },

      // Pro Tier - Advanced Models
      {
        id: "flux-kontext-pro",
        name: "Flux Kontext Pro",
        provider: "Black Forest",
        tier: "pro",
        speed: "medium",
        quality: "excellent",
        specialties: ["Professional quality", "Advanced context", "Series consistency"],
        credits: 5,
        tags: ["premium", "new"],
        description: "Professional-grade context understanding and consistency"
      },
      {
        id: "flux-pro",
        name: "Flux Pro",
        provider: "Black Forest",
        tier: "pro",
        speed: "medium",
        quality: "excellent",
        specialties: ["Highest quality", "Professional work", "Fine details"],
        credits: 5,
        tags: ["premium"],
        description: "Top-tier quality for professional applications"
      },
      {
        id: "ideogram-3-turbo",
        name: "Ideogram 3 Turbo",
        provider: "Ideogram",
        tier: "pro",
        speed: "fast",
        quality: "excellent",
        specialties: ["Advanced text", "Hebrew mastery", "Professional typography"],
        credits: 4,
        tags: ["premium"],
        description: "Advanced text integration with professional typography"
      },
      {
        id: "imagen-3",
        name: "Imagen 3",
        provider: "Google",
        tier: "pro",
        speed: "slow",
        quality: "excellent",
        specialties: ["Photorealism", "Complex scenes", "Technical precision"],
        credits: 6,
        tags: ["premium"],
        description: "Google's flagship photorealistic generation"
      },
      {
        id: "leonardo-phoenix",
        name: "Leonardo Phoenix",
        provider: "Leonardo",
        tier: "pro",
        speed: "medium",
        quality: "excellent",
        specialties: ["Artistic styles", "Character design", "Fantasy art"],
        credits: 4,
        tags: ["premium"],
        description: "Specialized in artistic and character illustration"
      },
      {
        id: "luma-photon",
        name: "Luma Photon",
        provider: "Luma",
        tier: "pro",
        speed: "medium",
        quality: "excellent",
        specialties: ["Professional photography", "Lighting mastery", "Commercial quality"],
        credits: 5,
        tags: ["premium"],
        description: "Professional photography-grade generation"
      },

      // Premium Tier - Cutting Edge
      {
        id: "dall-e-3-hd",
        name: "DALL-E 3 HD",
        provider: "OpenAI",
        tier: "premium",
        speed: "slow",
        quality: "excellent",
        specialties: ["Highest resolution", "Premium quality", "Complex understanding"],
        credits: 8,
        tags: ["premium"],
        description: "DALL-E 3 at maximum resolution and quality"
      },
      {
        id: "flux-kontext-max",
        name: "Flux Kontext Max",
        provider: "Black Forest",
        tier: "premium",
        speed: "slow",
        quality: "excellent",
        specialties: ["Maximum context", "Series mastery", "Ultimate consistency"],
        credits: 10,
        tags: ["premium", "new"],
        description: "Maximum context understanding for complex series"
      },
      {
        id: "flux-ultra",
        name: "Flux Ultra",
        provider: "Black Forest",
        tier: "premium",
        speed: "very-slow",
        quality: "excellent",
        specialties: ["Ultra quality", "Cinema grade", "Professional mastery"],
        credits: 12,
        tags: ["premium"],
        description: "Ultra-high quality for cinema and professional use"
      },
      {
        id: "gpt-image",
        name: "GPT Image",
        provider: "OpenAI",
        tier: "premium",
        speed: "medium",
        quality: "excellent",
        specialties: ["GPT integration", "Conversational generation", "Context awareness"],
        credits: 8,
        tags: ["premium", "new"],
        description: "GPT-powered image generation with conversational interface"
      },
      {
        id: "gpt-image-fast",
        name: "GPT Image Fast",
        provider: "OpenAI",
        tier: "premium",
        speed: "fast",
        quality: "high",
        specialties: ["GPT speed", "Quick conversations", "Rapid iterations"],
        credits: 6,
        tags: ["premium"],
        description: "Fast GPT-powered generation for quick iterations"
      },
      {
        id: "ideogram-3",
        name: "Ideogram 3",
        provider: "Ideogram",
        tier: "premium",
        speed: "slow",
        quality: "excellent",
        specialties: ["Perfect text", "Hebrew mastery", "Typography perfection"],
        credits: 10,
        tags: ["premium"],
        description: "Perfect text integration in any language"
      },
      {
        id: "recraft",
        name: "Recraft",
        provider: "Recraft",
        tier: "premium",
        speed: "medium",
        quality: "excellent",
        specialties: ["Brand consistency", "Logo design", "Vector art"],
        credits: 8,
        tags: ["premium"],
        description: "Professional brand and vector art generation"
      },
      {
        id: "recraft-realistic",
        name: "Recraft Realistic",
        provider: "Recraft",
        tier: "premium",
        speed: "slow",
        quality: "excellent",
        specialties: ["Ultra realism", "Photo quality", "Commercial photography"],
        credits: 10,
        tags: ["premium"],
        description: "Ultra-realistic commercial photography generation"
      }
    ],
    video: [
        // Free Tier
        {
            id: 'svd',
            name: 'Stable Video Diffusion',
            provider: 'Stability AI',
            tier: 'free',
            speed: 'fast',
            quality: 'good',
            specialties: ['Image to Video', 'Short clips (2-4s)'],
            credits: 5,
            tags: [],
            description: 'Animates a still image into a short video clip.'
        },
        // Creator Tier
        {
            id: 'pika',
            name: 'Pika Labs',
            provider: 'Pika',
            tier: 'creator',
            speed: 'medium',
            quality: 'high',
            specialties: ['Text to Video', 'Artistic Styles', 'Lip Sync'],
            credits: 10,
            tags: ['recommended'],
            description: 'Generates high-quality video clips from text prompts.'
        },
        {
            id: 'luma-dream-machine',
            name: 'Luma Dream Machine',
            provider: 'Luma AI',
            tier: 'creator',
            speed: 'medium',
            quality: 'excellent',
            specialties: ['Coherent motion', 'Realistic physics', 'Character consistency'],
            credits: 15,
            tags: ['new'],
            description: 'State-of-the-art model for creating realistic and consistent video clips.'
        },
        // Pro Tier
        {
            id: 'runway-gen3',
            name: 'Runway Gen-3',
            provider: 'RunwayML',
            tier: 'pro',
            speed: 'slow',
            quality: 'excellent',
            specialties: ['Cinematic control', 'Advanced motion tools', 'Professional output'],
            credits: 20,
            tags: ['premium'],
            description: 'Professional-grade video generation with advanced controls.'
        },
        {
            id: 'google-veo',
            name: 'Google Veo',
            provider: 'Google',
            tier: 'pro',
            speed: 'slow',
            quality: 'excellent',
            specialties: ['Longer videos (10s+)', 'High-definition', 'Cinematic understanding'],
            credits: 25,
            tags: ['premium'],
            description: 'Google\'s flagship model for creating longer, high-definition videos.'
        },
        // Premium Tier
        {
            id: 'openai-sora',
            name: 'OpenAI Sora',
            provider: 'OpenAI',
            tier: 'premium',
            speed: 'very-slow',
            quality: 'excellent',
            specialties: ['Hyper-realistic', 'Complex scenes', 'Long-form video'],
            credits: 50,
            tags: ['premium', 'new'],
            description: 'The most anticipated model for generating hyper-realistic and long videos. (API not yet public)'
        }
    ],
    music: [
        // Free Tier
        {
            id: 'suno-basic',
            name: 'Suno Basic',
            provider: 'Suno AI',
            tier: 'free',
            speed: 'fast',
            quality: 'good',
            specialties: ['Short music clips', 'Songs with vocals', 'Quick ideas'],
            credits: 3,
            tags: [],
            description: 'Create short songs and music clips from text prompts.'
        },
        // Creator Tier
        {
            id: 'udio-creator',
            name: 'Udio Creator',
            provider: 'Udio',
            tier: 'creator',
            speed: 'medium',
            quality: 'high',
            specialties: ['High-quality music', 'Instrumental tracks', 'Full songs'],
            credits: 8,
            tags: ['recommended'],
            description: 'Generate full-length, high-quality music tracks and instrumentals.'
        },
        // Pro Tier
        {
            id: 'stable-audio-pro',
            name: 'Stable Audio Pro',
            provider: 'Stability AI',
            tier: 'pro',
            speed: 'slow',
            quality: 'excellent',
            specialties: ['Sound effects (SFX)', 'Professional mastering', 'High-fidelity audio'],
            credits: 15,
            tags: ['premium'],
            description: 'Professional tool for generating high-fidelity music and sound effects.'
        }
    ]
  };

  useEffect(() => {
    setModels(modelsByCategory[category] || []);
  }, [category]);

  const tierColors = {
    free: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
    creator: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    pro: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
    premium: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
  };

  const speedColors = {
    "very-fast": "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
    "fast": "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
    "medium": "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
    "slow": "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
    "very-slow": "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
  };

  const qualityColors = {
    "good": "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    "high": "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
    "excellent": "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
  };

  const canAccessModel = (model) => {
    const tierHierarchy = { free: 0, creator: 1, pro: 2, premium: 3 };
    const userTierLevel = tierHierarchy[userTier] || 0;
    const modelTierLevel = tierHierarchy[model.tier] || 0;
    return userTierLevel >= modelTierLevel;
  };

  const ModelCard = ({ model, isSelected, onSelect }) => {
    const accessible = canAccessModel(model);
    const wired = isUiModelWired(model.id);
    const isLocked = !accessible;
    const isComingSoon = !wired;
    const disabled = isLocked || isComingSoon;

    return (
      <div
        className={`relative p-4 rounded-lg border-2 transition-all duration-200 ${
          disabled ? 'cursor-not-allowed' : 'cursor-pointer'
        } ${
          isSelected && !disabled
            ? 'border-purple-500 bg-purple-50 dark:border-purple-600 dark:bg-purple-900/20 shadow-md'
            : 'border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600'
        } ${disabled ? 'opacity-60' : ''}`}
        onClick={() => !disabled && onSelect(model)}
        aria-disabled={disabled}
      >
        {isLocked && (
          <div className={`absolute ${isRTL ? 'left-2' : 'right-2'} top-2`}>
            <Lock className="h-4 w-4 text-gray-400" aria-label={t("modelSelector.locked")} />
          </div>
        )}

        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              {model.name}
              {model.tags.includes("recommended") && (
                <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                  {t("modelSelector.recommended")}
                </Badge>
              )}
              {model.tags.includes("new") && (
                <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                  {t("modelSelector.new")}
                </Badge>
              )}
              {isComingSoon && (
                <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                  {t("modelSelector.comingSoon")}
                </Badge>
              )}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">{model.provider}</p>
          </div>
          <Badge className={tierColors[model.tier]} variant="secondary">
            {t(`modelSelector.${model.tier}`)}
          </Badge>
        </div>

        {showDetails && (
          <div className="space-y-2">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {model.description}
            </p>
            
            <div className="flex flex-wrap gap-2">
              <Badge className={speedColors[model.speed]} variant="secondary">
                {t("modelSelector.speed")}: {model.speed}
              </Badge>
              <Badge className={qualityColors[model.quality]} variant="secondary">
                {t("modelSelector.quality")}: {model.quality}
              </Badge>
            </div>

            <div className="text-sm">
              <span className="text-gray-600 dark:text-gray-400">{t("modelSelector.credits")}: </span>
              <span className="font-medium">{model.credits}</span>
            </div>

            <div className="text-sm">
              <span className="text-gray-600 dark:text-gray-400">{t("modelSelector.specialties")}: </span>
              <span className="font-medium">{model.specialties.slice(0, 2).join(", ")}</span>
            </div>
          </div>
        )}

        {isLocked && (
          <div className="mt-3 p-2 bg-gray-100 dark:bg-gray-800 rounded text-center">
            <p className="text-xs text-gray-600 dark:text-gray-400">
              {t("modelSelector.locked")}
            </p>
          </div>
        )}

        {!isLocked && isComingSoon && (
          <div className="mt-3 p-2 bg-amber-50 dark:bg-amber-900/20 rounded text-center">
            <p className="text-xs text-amber-700 dark:text-amber-300">
              {t("modelSelector.comingSoonNote")}
            </p>
          </div>
        )}
      </div>
    );
  };

  const groupedModels = {
    free: models.filter(m => m.tier === 'free'),
    creator: models.filter(m => m.tier === 'creator'),
    pro: models.filter(m => m.tier === 'pro'),
    premium: models.filter(m => m.tier === 'premium')
  };

  return (
    <div className="space-y-6" dir={isRTL ? "rtl" : "ltr"}>
      {Object.entries(groupedModels).map(([tier, tierModels]) => (
        tierModels.length > 0 && (
          <div key={tier}>
            <div className="flex items-center gap-2 mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {tier === 'free' && '🆓'} 
                {tier === 'creator' && '⭐'} 
                {tier === 'pro' && '👑'} 
                {tier === 'premium' && '💎'} 
                {t(`modelSelector.${tier}`)}
              </h3>
              {tier === 'creator' && userTier === 'free' && (
                <Badge variant="outline" className="text-xs">
                  $15/month
                </Badge>
              )}
              {tier === 'pro' && (userTier === 'free' || userTier === 'creator') && (
                <Badge variant="outline" className="text-xs">
                  $40/month
                </Badge>
              )}
              {tier === 'premium' && userTier !== 'premium' && (
                <Badge variant="outline" className="text-xs">
                  $80/month
                </Badge>
              )}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {tierModels.map(model => (
                <ModelCard
                  key={model.id}
                  model={model}
                  isSelected={selectedModel?.id === model.id}
                  onSelect={onModelChange}
                />
              ))}
            </div>
          </div>
        )
      ))}
    </div>
  );
}
