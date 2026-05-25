
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Lightbulb, Edit, Trash2, Rocket } from "lucide-react";
import { useI18n } from "@/components/i18n/i18nProvider";

export default function SavedIdeas({
  ideas = [],
  onUseIdea,
  onEditIdea,
  onDeleteIdea,
  onGenerateNew,
}) {
  const { t, isRTL } = useI18n();

  if (ideas.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-gray-800/50 dark:to-gray-800/30 rounded-xl border border-dashed border-amber-200 dark:border-gray-700" dir={isRTL ? "rtl" : "ltr"}>
        <div className="rounded-full bg-amber-100 dark:bg-amber-900/30 p-6 mb-6">
          <Lightbulb className="h-12 w-12 text-amber-500" />
        </div>
        <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
          {t("savedIdeas.emptyTitle")}
        </h3>
        <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-md text-base leading-relaxed">
          {t("savedIdeas.emptyDesc")}
        </p>
        {onGenerateNew && (
          <Button
            size="lg"
            onClick={onGenerateNew}
            className="bg-purple-600 hover:bg-purple-700 gap-2 text-base px-8 py-3 h-auto"
          >
            <Lightbulb className="h-5 w-5" />
            {t("savedIdeas.generateNewIdea")}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6" dir={isRTL ? "rtl" : "ltr"}>
      <div className={`text-center ${isRTL ? 'rtl' : ''}`}>
        <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{t("savedIdeas.title")}</h3>
        <p className="text-gray-600 dark:text-gray-400 mt-1">{t("savedIdeas.subtitle")}</p>
      </div>
      <ScrollArea className="h-[calc(100vh-200px)] pr-4">
        <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 ${isRTL ? 'rtl' : ''}`}>
          {ideas.map((idea) => (
            <Card key={idea.id} className={`flex flex-col justify-between hover:shadow-lg transition-shadow overflow-hidden ${isRTL ? 'rtl' : ''}`}>
              <CardHeader className="pb-2">
                <CardTitle className={`text-lg text-gray-900 dark:text-white line-clamp-2 ${isRTL ? 'text-right' : 'text-left'}`}>
                  {idea.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-grow pt-2">
                <p className={`text-sm text-gray-600 dark:text-gray-400 line-clamp-3 mb-2 ${isRTL ? 'text-right' : 'text-left'}`}>
                  {idea.description}
                </p>
                <div className="mt-2">
                  <Badge variant="outline" className="bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-700">
                    {t(`common.languageNames.${idea.language}`) || idea.language}
                  </Badge>
                </div>
              </CardContent>
              <CardFooter className={`flex justify-between items-center bg-gray-50 dark:bg-gray-800/50 p-3 border-t border-gray-100 dark:border-gray-700 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <div className={`flex gap-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
                   <Button variant="ghost" size="icon" onClick={() => onEditIdea && onEditIdea(idea)} title={t("savedIdeas.edit")}>
                      <Edit className="h-4 w-4 text-blue-500" />
                   </Button>
                   <Button variant="ghost" size="icon" onClick={() => onDeleteIdea && onDeleteIdea(idea.id)} className="text-red-500 hover:text-red-600" title={t("savedIdeas.delete")}>
                      <Trash2 className="h-4 w-4" />
                   </Button>
                </div>
                <Button onClick={() => onUseIdea && onUseIdea(idea)} size="sm" className="bg-purple-600 hover:bg-purple-700">
                  <Rocket className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                  {t("savedIdeas.use")}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
