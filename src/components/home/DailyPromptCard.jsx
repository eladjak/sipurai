import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { isNewShell } from "@/lib/flags";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useI18n } from "@/components/i18n/i18nProvider";
import { Sparkles, Wand2, Compass } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

const DailyPromptCard = React.memo(function DailyPromptCard({ dailyPrompt, isPromptLoading }) {
  const { isRTL, t } = useI18n();
  const { user } = useCurrentUser();

  return (
    <section className="p-4 md:p-6 lg:p-8">
      <div className={`flex flex-wrap gap-3 justify-between items-center mb-6 ${isRTL ? "flex-row-reverse" : ""}`}>
        <h2 className={`text-2xl font-bold flex items-center gap-2 ${isRTL ? "flex-row-reverse" : ""}`}>
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 shadow-md">
            <Sparkles className="h-4 w-4 text-white" />
          </span>
          {t("home.dailyPrompt.title")}
        </h2>

        <Link to={createPageUrl("StoryIdeas")}>
          <Button
            variant="outline"
            size="sm"
            className={`gap-1.5 border-amber-300 text-amber-700 hover:bg-amber-50 hover:border-amber-400 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-950/30 font-medium rounded-xl ${isRTL ? "flex-row-reverse" : ""}`}
          >
            <Compass className="h-4 w-4" />
            {t("home.dailyPrompt.explore")}
          </Button>
        </Link>
      </div>

      <Card className="relative overflow-hidden border-0 shadow-xl">
        {/* Gradient background */}
        <div className="absolute inset-0 bg-[#344b50]" />
        {/* Decorative circles */}
        <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2" />
        {/* Sparkle dots */}
        <Sparkles className="absolute top-4 right-8 h-5 w-5 text-white/40" />
        <Sparkles className="absolute bottom-6 left-12 h-4 w-4 text-white/30" />

        <CardContent className="relative p-5 md:p-7">
          {isPromptLoading ? (
            <div className="flex flex-col items-center justify-center h-32" role="status" aria-busy="true">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              >
                <Sparkles className="h-10 w-10 text-white" aria-hidden="true" />
              </motion.div>
              <p className="text-white font-medium mt-4">{t("home.dailyPrompt.loading")}</p>
            </div>
          ) : (
            <div className={`flex flex-col md:flex-row gap-6 items-center ${isRTL ? "md:flex-row-reverse" : ""}`}>
              <div className={`flex-1 ${isRTL ? "text-right" : "text-left"}`}>
                <h3 className="text-xl md:text-2xl font-bold text-white mb-2 drop-shadow">
                  {dailyPrompt?.title}
                </h3>
                <p className="text-white/90 mb-5 leading-relaxed">
                  {dailyPrompt?.description}
                </p>
                <div className={`flex flex-wrap gap-3 ${isRTL ? "flex-row-reverse" : ""}`}>
                  {/* Single clear CTA: go to book wizard with this prompt pre-loaded */}
                  <Link
                    to={isNewShell() ? "/new" : createPageUrl("BookWizard")}
                    onClick={() => {
                      if (dailyPrompt && user?.id) {
                        try { sessionStorage.setItem("sipurai_pending_idea", JSON.stringify({
                          ...dailyPrompt,
                          ownerId: user.id,
                          source: "daily_prompt"
                        })); } catch { /* Storage may be unavailable. */ }
                      }
                    }}
                  >
                    <Button className="bg-white text-amber-700 hover:bg-amber-50 shadow-lg font-semibold gap-2">
                      <Wand2 className="h-4 w-4" />
                      {t("home.dailyPrompt.createFromIdea")}
                    </Button>
                  </Link>
                </div>
              </div>
              {/* Illustration area */}
              <div className="w-full md:w-36 h-32 md:h-36 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center shadow-inner flex-shrink-0">
                <motion.div
                  animate={{ y: [-4, 4, -4] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                >
                  <img src="/images/spx/hearth.webp" alt="" className="h-32 w-36 rounded-xl object-cover" />
                </motion.div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
});

export default DailyPromptCard;
