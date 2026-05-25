import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen, Trophy, Heart, MessageCircle,
  Users, Calendar, Clock, ArrowUpRight, Sparkles,
  Zap, BookMarked
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useI18n } from "@/components/i18n/i18nProvider";

const activityTypes = {
  "book_created": {
    icon: BookOpen,
    color: "text-blue-500",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
    i18nKey: "activityTypes.bookCreated"
  },
  "achievement_unlocked": {
    icon: Trophy,
    color: "text-amber-500",
    bgColor: "bg-amber-100 dark:bg-amber-900/30",
    i18nKey: "activityTypes.achievementUnlocked"
  },
  "collaboration_started": {
    icon: Users,
    color: "text-green-500",
    bgColor: "bg-green-100 dark:bg-green-900/30",
    i18nKey: "activityTypes.collaborationStarted"
  },
  "level_up": {
    icon: Zap,
    color: "text-purple-500",
    bgColor: "bg-purple-100 dark:bg-purple-900/30",
    i18nKey: "activityTypes.levelUp"
  },
  "book_shared": {
    icon: Heart,
    color: "text-pink-500",
    bgColor: "bg-pink-100 dark:bg-pink-900/30",
    i18nKey: "activityTypes.bookShared"
  },
  "comment_received": {
    icon: MessageCircle,
    color: "text-indigo-500",
    bgColor: "bg-indigo-100 dark:bg-indigo-900/30",
    i18nKey: "activityTypes.commentReceived"
  },
  "idea_generated": {
    icon: Sparkles,
    color: "text-teal-500",
    bgColor: "bg-teal-100 dark:bg-teal-900/30",
    i18nKey: "activityTypes.ideaGenerated"
  },
  "book_completed": {
    icon: BookMarked,
    color: "text-emerald-500",
    bgColor: "bg-emerald-100 dark:bg-emerald-900/30",
    i18nKey: "activityTypes.bookCompleted"
  },
  "streak_milestone": {
    icon: Calendar,
    color: "text-orange-500",
    bgColor: "bg-orange-100 dark:bg-orange-900/30",
    i18nKey: "activityTypes.streakMilestone"
  }
};

export default function RecentActivity({ activities = [], showFilters = false }) {
  const [filter, setFilter] = useState("all");
  const [period, setPeriod] = useState("all");

  const { t, isRTL, language } = useI18n();

  const filterActivities = (activities) => {
    if (!activities || activities.length === 0) return [];
    
    let filtered = [...activities];
    
    // פילטור לפי סוג
    if (filter !== "all") {
      const typeMap = {
        "books": ["book_created", "book_completed", "book_shared"],
        "achievements": ["achievement_unlocked", "level_up", "streak_milestone"],
        "social": ["collaboration_started", "comment_received"]
      };
      
      filtered = filtered.filter(activity => typeMap[filter]?.includes(activity.type));
    }
    
    // פילטור לפי תקופה
    if (period !== "all") {
      const now = new Date();
      const periods = {
        "week": new Date(now.setDate(now.getDate() - 7)),
        "month": new Date(now.setMonth(now.getMonth() - 1)),
        "year": new Date(now.setFullYear(now.getFullYear() - 1))
      };
      
      filtered = filtered.filter(activity => new Date(activity.date) >= periods[period]);
    }
    
    return filtered;
  };

  const groupActivitiesByDate = (activities) => {
    const groups = {
      today: [],
      yesterday: [],
      thisWeek: [],
      thisMonth: [],
      earlier: []
    };

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const thisWeek = new Date(today);
    thisWeek.setDate(thisWeek.getDate() - 7);
    const thisMonth = new Date(today);
    thisMonth.setMonth(thisMonth.getMonth() - 1);

    activities.forEach(activity => {
      const activityDate = new Date(activity.date);
      if (activityDate >= today) {
        groups.today.push(activity);
      } else if (activityDate >= yesterday) {
        groups.yesterday.push(activity);
      } else if (activityDate >= thisWeek) {
        groups.thisWeek.push(activity);
      } else if (activityDate >= thisMonth) {
        groups.thisMonth.push(activity);
      } else {
        groups.earlier.push(activity);
      }
    });

    return groups;
  };

  const formatTime = (date) => {
    return new Intl.DateTimeFormat(language === "hebrew" ? "he-IL" : "en-US", {
      hour: "numeric",
      minute: "numeric"
    }).format(new Date(date));
  };

  const filteredActivities = filterActivities(activities);
  const groupedActivities = groupActivitiesByDate(filteredActivities);
  
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { staggerChildren: 0.07 }
    }
  };
  
  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0 }
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-blue-500" />
          {t("recentActivity.title")}
        </CardTitle>
        <Button variant="ghost" size="sm" className="gap-1 text-blue-500 hover:text-blue-600">
          {t("recentActivity.viewAll")}
          <ArrowUpRight className="h-4 w-4" />
        </Button>
      </CardHeader>
      
      {showFilters && (
        <div className="px-6 pt-2 pb-4 flex flex-wrap gap-3 border-b border-gray-100 dark:border-gray-800">
          <Tabs defaultValue="all" value={filter} onValueChange={setFilter}>
            <TabsList>
              <TabsTrigger value="all">{t("recentActivity.filter.all")}</TabsTrigger>
              <TabsTrigger value="books">{t("recentActivity.filter.books")}</TabsTrigger>
              <TabsTrigger value="achievements">{t("recentActivity.filter.achievements")}</TabsTrigger>
              <TabsTrigger value="social">{t("recentActivity.filter.social")}</TabsTrigger>
            </TabsList>
          </Tabs>
          
          <div className="ms-auto">
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder={t("recentActivity.period.all")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("recentActivity.period.all")}</SelectItem>
                <SelectItem value="week">{t("recentActivity.period.week")}</SelectItem>
                <SelectItem value="month">{t("recentActivity.period.month")}</SelectItem>
                <SelectItem value="year">{t("recentActivity.period.year")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
      
      <CardContent className="pt-6">
        <div className="space-y-8" dir={isRTL ? "rtl" : "ltr"}>
          <AnimatePresence mode="wait">
            {Object.entries(groupedActivities).map(([period, periodActivities]) => {
              if (periodActivities.length === 0) return null;

              return (
                <motion.div
                  key={period}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-4"
                >
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    {t(`recentActivity.${period}`)}
                  </h3>
                  
                  <motion.div 
                    className="space-y-4"
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                  >
                    {periodActivities.map((activity) => {
                      const activityType = activityTypes[activity.type] || {
                        icon: Clock,
                        color: "text-gray-500",
                        bgColor: "bg-gray-100 dark:bg-gray-800",
                        i18nKey: null
                      };

                      const Icon = activityType.icon;
                      const activityTitle = activityType.i18nKey
                        ? t(activityType.i18nKey)
                        : t("recentActivity.title");

                      return (
                        <motion.div
                          key={activity.id}
                          variants={itemVariants}
                          className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                        >
                          <div className={`flex-shrink-0 p-2 rounded-full ${activityType.bgColor}`}>
                            <Icon className={`h-5 w-5 ${activityType.color}`} />
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <p className="font-medium text-gray-900 dark:text-gray-100">
                                {activityTitle}
                              </p>
                              <span className="text-xs text-gray-400 dark:text-gray-500 ms-2">
                                {formatTime(activity.date)}
                              </span>
                            </div>
                            
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                              {activity.description}
                            </p>
                          </div>
                        </motion.div>
                      );
                    })}
                  </motion.div>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {filteredActivities.length === 0 && (
            <div className="text-center py-12">
              <Clock className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300">
                {t("recentActivity.empty")}
              </h3>
              <p className="text-gray-500 dark:text-gray-400">
                {t("recentActivity.emptyDescription")}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}