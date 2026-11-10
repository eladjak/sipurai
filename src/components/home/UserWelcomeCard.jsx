import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useI18n } from "@/components/i18n/i18nProvider";
import { Trophy, Star, Flame, Zap } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import BadgeDisplay from "@/components/gamification/BadgeDisplay";
import { motion } from "framer-motion";

function getTimeOfDayGreeting(t, name) {
  const hour = new Date().getHours();
  const displayName = name || "";

  if (hour >= 5 && hour < 12) return t("userWelcome.morning", { name: displayName });
  if (hour >= 12 && hour < 17) return t("userWelcome.afternoon", { name: displayName });
  if (hour >= 17 && hour < 22) return t("userWelcome.evening", { name: displayName });
  return t("userWelcome.night", { name: displayName });
}

const UserWelcomeCard = React.memo(function UserWelcomeCard({ userData }) {
  const { language: currentLanguage, isRTL, t } = useI18n();

  const progressToNextLevel = userData.nextLevelXp > 0
    ? Math.min((userData.xp / userData.nextLevelXp) * 100, 100)
    : 0;

  const greeting = getTimeOfDayGreeting(t, userData.full_name);

  const streakDays = userData.streakDays || 0;
  const showStreak = streakDays >= 3;
  const pulseStreak = streakDays >= 7;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col md:flex-row gap-4 md:gap-6"
    >
      {/* User info card */}
      <Card className="relative w-full md:w-auto flex-grow-0 flex-shrink-0 border-0 shadow-lg overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500 via-indigo-500 to-violet-600 opacity-100 rounded-xl" />
        <CardContent className="relative p-5">
          <div className={`flex items-center gap-3 mb-4 ${isRTL ? "flex-row-reverse" : ""}`}>
            <Link to={createPageUrl("Profile")} className="flex-shrink-0">
              <div className="relative">
                {/* Glow ring */}
                <div className="absolute -inset-1 rounded-full bg-gradient-to-br from-yellow-300 via-pink-300 to-purple-300 opacity-70 blur-sm animate-pulse" />
                <Avatar className="relative h-14 w-14 border-3 border-white shadow-xl">
                  {userData.avatar_url ? (
                    <AvatarImage src={userData.avatar_url} alt={userData.full_name} />
                  ) : (
                    <AvatarFallback className="bg-gradient-to-br from-white/30 to-white/10 text-white text-xl font-bold">
                      {userData.full_name?.charAt(0) || t("homeLegacy.guest").charAt(0)}
                    </AvatarFallback>
                  )}
                </Avatar>
              </div>
            </Link>

            <div className={`flex-1 min-w-0 ${isRTL ? "text-right" : "text-left"}`}>
              <p className="text-sm text-purple-100 font-medium">{greeting}</p>
              <h2 className="font-bold text-xl text-white truncate drop-shadow">{userData.full_name || t("homeLegacy.guest")}</h2>
            </div>
          </div>

          <div className={`flex flex-wrap gap-2 mb-4 ${isRTL ? "justify-end" : "justify-start"}`}>
            <Badge className="bg-white/20 text-white border-white/30 gap-1 backdrop-blur-sm hover:bg-white/30">
              <Trophy className="h-3 w-3 text-yellow-300" />
              <span>{t("home.level")} {userData.level}</span>
            </Badge>

            {showStreak ? (
              <Badge
                className={`bg-orange-400/80 text-white border-orange-300/30 gap-1 ${pulseStreak ? "animate-pulse" : ""}`}
              >
                <Flame className="h-3 w-3 text-yellow-100" />
                <span>{streakDays} {t("home.streak")}</span>
              </Badge>
            ) : (
              <Badge className="bg-white/20 text-white border-white/30 gap-1">
                <Star className="h-3 w-3 text-blue-200" />
                <span>{streakDays} {t("home.streak")}</span>
              </Badge>
            )}

            {userData.completedBooks > 0 && (
              <Badge className="bg-white/20 text-white border-white/30 gap-1">
                <Zap className="h-3 w-3 text-green-300" />
                <span>{userData.completedBooks}</span>
              </Badge>
            )}
          </div>

          {/* XP progress bar — gradient */}
          <div className="space-y-1.5">
            <div className={`flex justify-between text-xs text-purple-100 ${isRTL ? "flex-row-reverse" : ""}`}>
              <span className="font-semibold">{userData.xp} XP</span>
              <span>{userData.nextLevelXp - userData.xp} XP {t("home.progress.toNext")}</span>
            </div>
            <div
              className="h-2.5 rounded-full bg-white/20 overflow-hidden"
              role="progressbar"
              aria-valuenow={userData.xp}
              aria-valuemin={0}
              aria-valuemax={userData.nextLevelXp}
              aria-label={`${userData.xp} XP — ${t("home.progress.toNext")} ${userData.nextLevelXp}`}
            >
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progressToNextLevel}%` }}
                transition={{ duration: 1, delay: 0.3, ease: "easeOut" }}
                className="h-full rounded-full bg-gradient-to-r from-yellow-300 via-green-300 to-emerald-400 shadow-sm"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Badges row */}
      {userData.badges && userData.badges.length > 0 && (
        <motion.div
          initial={{ opacity: 0, x: isRTL ? -10 : 10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="flex items-center gap-2 flex-wrap"
        >
          {userData.badges.map((badge, index) => (
            <motion.div
              key={index}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.3, delay: 0.3 + index * 0.05 }}
              className="flex flex-col items-center p-2 bg-white dark:bg-gray-800 rounded-xl shadow-md hover:shadow-lg transition-shadow border border-purple-100 dark:border-purple-900"
            >
              <BadgeDisplay
                badgeId={badge.id}
                size="sm"
              />
            </motion.div>
          ))}
        </motion.div>
      )}
    </motion.div>
  );
});

export default UserWelcomeCard;
