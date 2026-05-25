import { Circle, CheckCircle, BookText, Image, Music } from 'lucide-react';
import { useI18n } from '@/components/i18n/i18nProvider';

export default function GenerationSteps({ currentStep }) {
  const { t } = useI18n();

  const steps = [
    {
      id: "generating_story",
      title: t("generationSteps.step1"),
      icon: BookText,
      description: t("generationSteps.step1Desc")
    },
    {
      id: "generating_images",
      title: t("generationSteps.step2"),
      icon: Image,
      description: t("generationSteps.step2Desc")
    },
    {
      id: "generating_audio",
      title: t("generationSteps.step3"),
      icon: Music,
      description: t("generationSteps.step3Desc")
    },
    {
      id: "complete",
      title: t("generationSteps.step4"),
      icon: CheckCircle,
      description: t("generationSteps.step4Desc")
    }
  ];

  // Find the current step index
  const currentStepIndex = steps.findIndex(step => step.id === currentStep);

  return (
    <div className="space-y-6">
      <ul className="space-y-4">
        {steps.map((step, index) => {
          // Determine step status
          const isComplete = index < currentStepIndex;
          const isCurrent = index === currentStepIndex;

          return (
            <li key={step.id} className="flex items-start gap-3">
              <div className={`mt-0.5 rounded-full p-1.5 ${
                isComplete 
                  ? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" 
                  : isCurrent 
                    ? "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 animate-pulse" 
                    : "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400"
              }`}>
                {isComplete ? (
                  <CheckCircle className="h-4 w-4" />
                ) : isCurrent ? (
                  <step.icon className="h-4 w-4" />
                ) : (
                  <Circle className="h-4 w-4" />
                )}
              </div>
              <div>
                <p className={`font-medium ${
                  isComplete 
                    ? "text-green-800 dark:text-green-300" 
                    : isCurrent 
                      ? "text-blue-800 dark:text-blue-300" 
                      : "text-gray-700 dark:text-gray-300"
                }`}>
                  {step.title}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {step.description}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}