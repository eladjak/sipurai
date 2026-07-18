import { useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, BookOpen, Star, Award, BadgeCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { motion, useInView } from "framer-motion";
import { useI18n } from "@/components/i18n/i18nProvider";
import { useCountUp } from "@/hooks/useCountUp";

// wow-ui-standard count-up (principle 13): animates 0→value once when in view,
// restores the exact final value, and is skipped under reduced-motion.
function CountUp({ value, active }) {
  const n = useCountUp(value, active);
  return <span className="tabular-nums">{n}</span>;
}

export default function UserStats({ userData }) {
  const { t, isRTL } = useI18n();
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  const completedBadges = userData.badges?.filter(badge => badge.completed) || [];
  const xpProgress = (userData.xp / userData.next_level_xp) * 100;

  return (
    <Card ref={ref}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Trophy className="h-5 w-5 text-amber-500" />
          {t("userStats.level")} {userData.level} {t("userStats.storyteller")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4" dir={isRTL ? "rtl" : "ltr"}>
          {/* Level & XP */}
          <div className="md:col-span-2 bg-gradient-to-r from-purple-500 to-blue-500 dark:from-purple-800 dark:to-blue-800 rounded-lg p-5 text-white">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-white/80 font-medium">{t("userStats.level")}</h3>
                <div className="flex items-end gap-1">
                  <span className="text-4xl font-bold"><CountUp value={userData.level} active={inView} /></span>
                  <span className="text-lg mb-1">{t("userStats.storyteller")}</span>
                </div>
              </div>
              <Trophy className="h-8 w-8 text-amber-300" />
            </div>
            
            <div className="mt-4 space-y-1">
              <div className="flex justify-between text-sm">
                <span>{userData.xp} {t("userStats.xp")}</span>
                <span>{userData.next_level_xp - userData.xp} {t("userStats.nextLevel")}</span>
              </div>
              <motion.div 
                className="h-2 bg-white/20 rounded-full overflow-hidden"
                initial={{ width: 0 }}
                animate={{ width: "100%" }}
                transition={{ duration: 0.5 }}
              >
                <motion.div 
                  className="h-full bg-white"
                  initial={{ width: 0 }}
                  animate={{ width: `${xpProgress}%` }}
                  transition={{ duration: 0.8, delay: 0.3 }}
                />
              </motion.div>
            </div>
          </div>
          
          {/* Books Created */}
          <motion.div 
            className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <div className="flex justify-between items-start">
              <h3 className="text-blue-800 dark:text-blue-300 font-medium">{t("userStats.books")}</h3>
              <BookOpen className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <p className="text-2xl font-bold mt-2"><CountUp value={userData.total_books} active={inView} /></p>
            <p className="text-blue-600/70 dark:text-blue-300/70 text-sm">
              {userData.total_pages} {t("userStats.pages")}
            </p>
          </motion.div>
          
          {/* Streak */}
          <motion.div 
            className="bg-amber-50 dark:bg-amber-950/30 rounded-lg p-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <div className="flex justify-between items-start">
              <h3 className="text-amber-800 dark:text-amber-300 font-medium">{t("userStats.streak")}</h3>
              <Star className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <p className="text-2xl font-bold mt-2"><CountUp value={userData.streak_days} active={inView} /></p>
            <p className="text-amber-600/70 dark:text-amber-300/70 text-sm">
              {t("userStats.keepGoing")}
            </p>
          </motion.div>
          
          {/* Badge Showcase */}
          <div className="md:col-span-4 mt-2">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium flex items-center gap-2">
                <Award className="h-5 w-5 text-purple-600" />
                {t("userStats.badges")}
              </h3>
              <Badge variant="outline" className="px-2 py-0 text-xs">
                {completedBadges.length} {t("userStats.badgesCount")}
              </Badge>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
              {completedBadges.length > 0 ? (
                completedBadges.map((badge, index) => (
                  <motion.div
                    key={index}
                    className="flex flex-col items-center bg-gray-50 dark:bg-gray-800 rounded-lg p-3"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3, delay: index * 0.1 }}
                  >
                    <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-full mb-2">
                      <BadgeCheck className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <span className="text-xs font-medium text-center text-gray-700 dark:text-gray-300">
                      {badge.name}
                    </span>
                  </motion.div>
                ))
              ) : (
                <div className="col-span-full flex flex-col items-center border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg p-6">
                  <Award className="h-8 w-8 text-gray-400 mb-2" />
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400 text-center">
                    {t("userStats.complete")}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}