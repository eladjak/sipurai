import React from "react";
import { motion } from "framer-motion";
import { Check, BookOpen, Users, Eye, Rocket, Film } from "lucide-react";
import { useI18n } from "@/components/i18n/i18nProvider";

// Order mirrors BookWizard.steps: topic → characters → structure → preview → save.
// Falls back to BookOpen for any extra/unknown step index.
const STEP_ICONS = [BookOpen, Users, Film, Eye, Rocket];

/**
 * WizardProgress - Animated visual step indicator for the book creation wizard.
 * Features gradient active state, step icons, and animated progress fill.
 */
export default function WizardProgress({ steps, currentStep, onStepClick, isRTL }) {
  const { t } = useI18n();
  return (
    <div
      className="mb-8 px-2"
      dir={isRTL ? "rtl" : "ltr"}
      role="navigation"
      aria-label={t("wizard.title")}
    >
      <div className={`flex items-start justify-between ${isRTL ? "flex-row-reverse" : "flex-row"}`}>
        {steps.map((step, index) => {
          const isCompleted = index < currentStep;
          const isActive = index === currentStep;
          const isClickable = index < currentStep;
          const Icon = STEP_ICONS[index] || BookOpen;

          return (
            <React.Fragment key={step.id}>
              {/* Step node */}
              <div className="flex flex-col items-center gap-2 relative">
                <motion.button
                  onClick={() => isClickable && onStepClick(index)}
                  disabled={!isClickable}
                  className={`
                    relative w-12 h-12 md:w-14 md:h-14 rounded-2xl flex items-center justify-center
                    font-bold transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500
                    ${isCompleted
                      ? "bg-gradient-to-br from-green-400 to-emerald-500 text-white shadow-lg shadow-green-200/60 cursor-pointer"
                      : isActive
                        ? "bg-gradient-to-br from-purple-500 via-indigo-500 to-violet-600 text-white shadow-xl shadow-purple-300/60 ring-4 ring-purple-200 dark:ring-purple-800"
                        : "bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 cursor-default"
                    }
                  `}
                  whileHover={isClickable ? { scale: 1.1, rotate: 3 } : {}}
                  whileTap={isClickable ? { scale: 0.95 } : {}}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.08 }}
                  aria-label={`${step.title} - ${isCompleted ? t("wizard.stepStatus.completed") : isActive ? t("wizard.stepStatus.current") : t("wizard.stepStatus.notCompleted")}`}
                  aria-current={isActive ? "step" : undefined}
                >
                  {isCompleted ? (
                    <Check className="h-5 w-5 md:h-6 md:w-6" aria-hidden="true" />
                  ) : (
                    <Icon className="h-5 w-5 md:h-6 md:w-6" aria-hidden="true" />
                  )}

                  {/* Pulse ring for active step */}
                  {isActive && (
                    <motion.div
                      className="absolute inset-0 rounded-2xl bg-purple-400/30"
                      animate={{ scale: [1, 1.3, 1], opacity: [0.6, 0, 0.6] }}
                      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                      aria-hidden="true"
                    />
                  )}
                </motion.button>

                {/* Step label */}
                <motion.div
                  className={`
                    text-xs md:text-sm font-semibold text-center max-w-[72px] md:max-w-[90px] leading-tight
                    ${isActive
                      ? "text-purple-700 dark:text-purple-300"
                      : isCompleted
                        ? "text-green-600 dark:text-green-400"
                        : "text-gray-400 dark:text-gray-500"
                    }
                  `}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: index * 0.08 + 0.1 }}
                >
                  {step.title}
                </motion.div>
              </div>

              {/* Animated connector line */}
              {index < steps.length - 1 && (
                <div className="flex-1 mx-1 md:mx-2 mt-6 h-1.5 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800 self-start">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-green-400 to-emerald-500"
                    initial={{ width: "0%" }}
                    animate={{ width: isCompleted ? "100%" : "0%" }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                  />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
