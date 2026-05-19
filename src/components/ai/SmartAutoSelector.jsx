import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Wand2 } from 'lucide-react';
import { useI18n } from '@/components/i18n/i18nProvider';
import { pickBestModel, MODEL_REGISTRY } from '@/lib/smartModelPicker';

/**
 * SmartAutoSelector — shows the user which model the auto router will pick
 * for their current prompt, with a one-line reason. Pure visual; the actual
 * generation call uses the same `pickBestModel()` so the displayed pick is
 * always what gets used.
 *
 * Props:
 *   - prompt: current prompt text
 *   - userTier: 'free' | 'creator' | 'pro' | 'premium'
 *   - lastManualPick: model id stored in localStorage (optional)
 *
 * Created 2026-05-14.
 */
export default function SmartAutoSelector({ prompt = '', userTier = 'free', lastManualPick }) {
  const { t, isRTL } = useI18n();

  const pick = useMemo(
    () => pickBestModel({ prompt, userTier, lastManualPick }),
    [prompt, userTier, lastManualPick]
  );

  const model = pick.model || MODEL_REGISTRY[pick.modelId];

  return (
    <Card
      className="border-dashed border-2 border-purple-300 dark:border-purple-700 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <CardContent className="pt-6">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/40">
            <Wand2 className="size-5 text-purple-600 dark:text-purple-300" aria-hidden="true" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white text-balance">
              {t('aiStudio.auto.title')}
            </h3>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300 text-pretty">
              {t('aiStudio.auto.hint')}
            </p>

            {prompt.trim() && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Sparkles className="size-4 text-purple-500" aria-hidden="true" />
                <span className="text-sm text-gray-700 dark:text-gray-200">
                  {t('aiStudio.auto.picked')}:
                </span>
                <Badge className="bg-purple-600 text-white dark:bg-purple-500">
                  {model?.label || pick.modelId}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {t(`aiStudio.auto.reason.${pick.reason}`)}
                </Badge>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
