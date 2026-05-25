import { Lightbulb, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/components/i18n/i18nProvider";

export default function DailyPrompt({
  prompt,
  onUse,
  onDismiss,
  onRefresh,
}) {
  const { t, isRTL } = useI18n();

  if (!prompt) return null;

  return (
    <Card className="bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-700 mb-6">
      <CardHeader>
        {/* Title row with refresh button — positioned at the logical end (right in LTR, left in RTL) */}
        <div className="flex items-center justify-between" dir={isRTL ? "rtl" : "ltr"}>
          <CardTitle className="text-amber-800 dark:text-amber-300 flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-amber-500" />
            {t("dailyPrompt.title")}
          </CardTitle>
          {onRefresh && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onRefresh}
              className="h-8 w-8 text-amber-600 hover:text-amber-800 hover:bg-amber-100"
              aria-label={t("dailyPrompt.refreshAriaLabel")}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          )}
        </div>
        <p className="text-amber-700 dark:text-amber-400 text-sm">{t("dailyPrompt.subtitle")}</p>
      </CardHeader>
      <CardContent>
        <div className="mb-4" dir={isRTL ? "rtl" : "ltr"}>
          <h4 className="font-medium text-amber-800 dark:text-amber-300">{prompt.title}</h4>
          <p className="text-amber-700 dark:text-amber-400 mt-1">{prompt.description}</p>
        </div>
        <div className={`flex gap-2 ${isRTL ? "flex-row-reverse justify-end" : ""}`}>
          <Button
            className="bg-amber-500 hover:bg-amber-600 text-white"
            onClick={onUse}
          >
            <Lightbulb className={`h-4 w-4 ${isRTL ? "ms-2" : "me-2"}`} />
            {t("dailyPrompt.use")}
          </Button>
          <Button
            variant="outline"
            className="border-amber-200 text-amber-700 hover:bg-amber-100"
            onClick={onDismiss}
          >
            {t("dailyPrompt.dismiss")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}