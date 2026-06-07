
import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { User } from "@/entities/User";
import { Book } from "@/entities/Book";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { UserBadge } from "@/entities/UserBadge";
import useGamification, { BADGE_DEFINITIONS } from "@/hooks/useGamification";
import { useI18n } from "@/components/i18n/i18nProvider";
import FollowButton from "@/components/social/FollowButton";
import { useToast } from "@/components/ui/use-toast";
import {
  User as UserIcon,
  Settings,
  Edit,
  Camera,
  Trophy,
  BookOpen,
  ChevronRight,
  Star,
  Clock,
  Sparkles,
  Calendar,
  Award,
  Gift,
  ArrowUpRight,
  Loader2,
  Palette,
  Globe,
  MessageSquare,
  Users,
  Heart,
  Zap,
  MessageCircle,
  Plus,
  FileText,
  BarChart3
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";

import { motion, AnimatePresence } from "framer-motion";

import BadgeDisplay from "../components/gamification/BadgeDisplay";
import AvatarSelector from "../components/profile/AvatarSelector";
import UserStats from "../components/profile/UserStats";
import AchievementList from "../components/profile/AchievementList";
import RecentActivity from "../components/profile/RecentActivity";
import MyBooksSection from "../components/profile/MyBooksSection";

export default function Profile() {
  const { t, language: i18nLanguage, isRTL } = useI18n();
  const { toast } = useToast();
  const { user: hookUser } = useCurrentUser();

  const showToast = (message, type = "info") => {
    toast({
      title: message,
      variant: type === "error" ? "destructive" : "default",
    });
  };

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [currentLanguage, setCurrentLanguage] = useState(i18nLanguage);
  const [activeTab, setActiveTab] = useState("overview");
  const [editMode, setEditMode] = useState(false);
  const [avatarEditorOpen, setAvatarEditorOpen] = useState(false);
  const [userBooks, setUserBooks] = useState([]);

  const [userData, setUserData] = useState({
    id: "",
    email: "",
    full_name: "",
    role: "",
    created_date: "",
    display_name: "",
    avatar_url: "",
    bio: "",
    level: 1,
    xp: 0,
    next_level_xp: 200,
    total_books: 0,
    total_pages: 0,
    streak_days: 0,
    badges: [],
    favorite_genres: [],
    completed_books: []
  });

  const [editableData, setEditableData] = useState({
    display_name: "",
    bio: ""
  });

  const [recentActivity, setRecentActivity] = useState([]);
  const [achievements, setAchievements] = useState([]);
  const [recentBooks, setRecentBooks] = useState([]);
  const [readingStats, setReadingStats] = useState({
    totalBooks: 0,
    totalPages: 0,
    favoriteGenre: null,
    memberSince: null,
  });

  useEffect(() => {
    const loadUserData = async () => {
      try {
        setIsLoading(true);

        const user = hookUser;
        if (!user) {
          setIsLoading(false);
          return;
        }

        const allBooks = await Book.filter({ created_by: user.id }, "-created_date");
        const recentBooksData = allBooks.slice(0, 3);

        const formattedUser = {
          ...user,
          display_name: user.display_name || user.full_name,
          level: user.level || 1,
          xp: user.xp || 0,
          next_level_xp: user.next_level_xp || 200,
          bio: user.bio || "",
          avatar_url: user.avatar_url || "",
          total_books: allBooks.length,
          total_pages: allBooks.reduce((total, book) => total + (book.total_pages || 0), 0),
          streak_days: user.streak_days || 0,
          badges: user.badges || [],
          favorite_genres: user.favorite_genres || []
        };

        setUserData(formattedUser);
        setEditableData({
          display_name: formattedUser.display_name,
          bio: formattedUser.bio
        });
        setRecentBooks(recentBooksData);
        setUserBooks(allBooks);

        const totalPages = allBooks.reduce((sum, b) => sum + (b.total_pages || 0), 0);
        const genreCounts = {};
        allBooks.forEach((b) => {
          if (b.genre) {
            genreCounts[b.genre] = (genreCounts[b.genre] || 0) + 1;
          }
        });
        const favoriteGenre = Object.entries(genreCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
        setReadingStats({
          totalBooks: allBooks.length,
          totalPages,
          favoriteGenre,
          memberSince: user.created_date || null,
        });

        const interfaceLanguage = user.language || i18nLanguage || "english";
        setCurrentLanguage(interfaceLanguage);

        loadAchievementsData(user, allBooks);
        loadRecentActivityData(allBooks);

      } catch (error) {
        showToast(t("profile.error"), "error");
      } finally {
        setIsLoading(false);
      }
    };

    loadUserData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hookUser]);

  const loadAchievementsData = async (user, books) => {
    try {
      let userBadges = [];
      try {
        userBadges = await UserBadge.filter({ user_id: user.id || user.email });
      } catch {
        // UserBadge may not have data yet
      }

      const genres = new Set(books.map(b => b.genre).filter(Boolean));
      const languages = new Set(books.map(b => b.language).filter(Boolean));
      const stats = {
        totalBooks: books.length,
        totalCharacters: user.total_characters || 0,
        communityShares: user.community_shares || 0,
        streakDays: user.streak_days || 0,
        uniqueGenres: genres.size,
        uniqueLanguages: languages.size
      };

      const achievementData = Object.values(BADGE_DEFINITIONS).map(def => {
        const earned = userBadges.find(b => b.badge_id === def.id);
        const isCompleted = !!earned || def.check(stats);
        const currentProgress = def.progress(stats);

        return {
          id: def.id,
          title: def.nameEn,
          description: def.descEn,
          icon: BookOpen,
          category: def.category,
          completed: isCompleted,
          progress: currentProgress,
          max_progress: def.maxProgress,
          unlocked_date: earned?.earned_date || null,
          xp_reward: def.xpReward,
          translations: {
            en: { title: def.nameEn, description: def.descEn },
            he: { title: def.nameHe, description: def.descHe }
          }
        };
      });

      setAchievements(achievementData);
    } catch {
      setAchievements([]);
    }
  };

  const loadRecentActivityData = (books) => {
    const activities = books.slice(0, 10).map((book) => ({
      id: `book_${book.id}`,
      type: "book_created",
      title: t("profile.activity.bookCreated"),
      description: book.title || t("profile.activity.untitled"),
      date: new Date(book.created_date || Date.now()),
      icon: BookOpen,
      iconColor: "text-blue-500"
    }));

    setRecentActivity(activities);
  };

  const formatDate = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return new Intl.DateTimeFormat(currentLanguage === "english" ? "en-US" : "he-IL", {
      year: "numeric",
      month: "long",
      day: "numeric"
    }).format(date);
  };

  const saveProfile = async () => {
    setIsSaving(true);
    try {
      await User.updateMyUserData({
        display_name: editableData.display_name,
        bio: editableData.bio
      });

      setUserData(prev => ({
        ...prev,
        display_name: editableData.display_name,
        bio: editableData.bio
      }));

      setEditMode(false);

      showToast(t("profile.saved"), "success");
    } catch (error) {
      showToast(t("profile.error"), "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAvatarUpdate = async (newAvatarUrl) => {
    try {
      setIsSaving(true);

      await User.updateMyUserData({
        avatar_url: newAvatarUrl
      });

      setUserData(prev => ({
        ...prev,
        avatar_url: newAvatarUrl
      }));

      showToast(t("profile.avatar.updated"), "success");
      setAvatarEditorOpen(false);
    } catch (error) {
      showToast(t("profile.avatar.error"), "error");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[500px]">
        <div className="text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          >
            <Loader2 className="h-10 w-10 text-purple-600 mx-auto mb-4" />
          </motion.div>
          <p className="text-gray-600 dark:text-gray-300">{t("profile.loading")}</p>
        </div>
      </div>
    );
  }

  const dir = isRTL ? "rtl" : "ltr";
  const xpPercent = Math.min(100, Math.round((userData.xp / (userData.next_level_xp || 200)) * 100));

  // Static Tailwind color maps — dynamic class strings break JIT
  const colorClasses = {
    purple: {
      card: "bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-900/20 dark:to-purple-900/10 border border-purple-100/50 dark:border-purple-800/20",
      icon: "bg-purple-100 dark:bg-purple-900/30",
      iconText: "text-purple-600 dark:text-purple-400"
    },
    blue: {
      card: "bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-900/20 dark:to-blue-900/10 border border-blue-100/50 dark:border-blue-800/20",
      icon: "bg-blue-100 dark:bg-blue-900/30",
      iconText: "text-blue-600 dark:text-blue-400"
    },
    amber: {
      card: "bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-900/20 dark:to-amber-900/10 border border-amber-100/50 dark:border-amber-800/20",
      icon: "bg-amber-100 dark:bg-amber-900/30",
      iconText: "text-amber-600 dark:text-amber-400"
    },
    green: {
      card: "bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-900/20 dark:to-green-900/10 border border-green-100/50 dark:border-green-800/20",
      icon: "bg-green-100 dark:bg-green-900/30",
      iconText: "text-green-600 dark:text-green-400"
    }
  };

  return (
    <div className="max-w-6xl mx-auto pb-16" dir={dir}>
      {/* Gradient Header Banner */}
      <motion.div
        className="relative overflow-hidden rounded-2xl mb-6 shadow-xl"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="bg-gradient-to-r from-purple-600 via-indigo-600 to-violet-600 p-8 pb-24">
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_30%_50%,white_0%,transparent_60%)]" />
          <div className="absolute inset-0 opacity-[0.06] bg-[url('/images/achievements.jpg')] bg-cover bg-center" />
          {/* Decorative sparkles */}
          {[
            { top: "15%", left: "10%", delay: 0 },
            { top: "60%", left: "70%", delay: 0.3 },
            { top: "30%", right: "15%", delay: 0.6 },
          ].map((pos, i) => (
            <motion.div
              key={i}
              className="absolute pointer-events-none text-white/20"
              style={{ top: pos.top, left: pos.left, right: pos.right }}
              animate={{ scale: [1, 1.3, 1], opacity: [0.2, 0.4, 0.2] }}
              transition={{ duration: 3, repeat: Infinity, delay: pos.delay }}
            >
              <Sparkles className="h-6 w-6" />
            </motion.div>
          ))}
        </div>

        {/* Profile Card overlapping the banner */}
        <div className="relative -mt-16 mx-4 md:mx-6 bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
            {/* Avatar with glow ring */}
            <motion.div
              className="relative group cursor-pointer -mt-20"
              onClick={() => setAvatarEditorOpen(true)}
              whileHover={{ scale: 1.05 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <div className="h-28 w-28 relative">
                {/* Animated glow ring */}
                <motion.div
                  className="absolute -inset-1.5 rounded-full bg-gradient-to-r from-purple-400 via-indigo-400 to-violet-400 opacity-60"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                />
                <Avatar className="relative h-28 w-28 border-4 border-white dark:border-gray-700 shadow-xl
                                  group-hover:border-purple-200 dark:group-hover:border-purple-800 transition-all">
                  {userData.avatar_url ? (
                    <AvatarImage src={userData.avatar_url} alt={userData.display_name} />
                  ) : (
                    <AvatarFallback className="bg-gradient-to-br from-purple-500 to-indigo-500 text-white text-3xl font-bold">
                      {userData.display_name?.charAt(0) || userData.full_name?.charAt(0) || "U"}
                    </AvatarFallback>
                  )}
                </Avatar>

                <div className="absolute inset-0 flex items-center justify-center rounded-full opacity-0
                                bg-black/40 group-hover:opacity-100 transition-opacity z-10">
                  <Camera className="h-8 w-8 text-white" />
                </div>

                <div className="absolute bottom-0 end-0 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-full p-1.5
                                border-2 border-white dark:border-gray-800 shadow-md z-10
                                group-hover:scale-110 transition-transform">
                  <Camera className="h-4 w-4 text-white" />
                </div>
              </div>
            </motion.div>

            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {userData.display_name}
              </h1>
              <p className="text-gray-500 dark:text-gray-400 text-sm">{userData.email}</p>

              {/* XP progress bar */}
              <div className="mt-3 mb-4 max-w-sm">
                <div className={`flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <span className={`flex items-center gap-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <Zap className="h-3 w-3 text-purple-500" />
                    {userData.xp} XP
                  </span>
                  <span>{userData.next_level_xp} XP</span>
                </div>
                <div className="h-2.5 w-full bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-purple-500 via-indigo-500 to-violet-500"
                    initial={{ width: 0 }}
                    animate={{ width: `${xpPercent}%` }}
                    transition={{ duration: 1, delay: 0.5, ease: "easeOut" }}
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <div className="bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-900/20
                  px-3 py-1.5 rounded-full flex items-center shadow-sm border border-purple-100 dark:border-purple-800/30">
                  <Trophy className="h-4 w-4 text-purple-600 dark:text-purple-400 me-1.5" />
                  <span className="text-sm font-semibold text-purple-700 dark:text-purple-300">
                    {t("profile.level")} {userData.level}
                  </span>
                </div>

                <div className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-900/20
                  px-3 py-1.5 rounded-full flex items-center shadow-sm border border-blue-100 dark:border-blue-800/30">
                  <BookOpen className="h-4 w-4 text-blue-600 dark:text-blue-400 me-1.5" />
                  <span className="text-sm font-semibold text-blue-700 dark:text-blue-300">
                    {userData.total_books} {t("profile.booksCreated")}
                  </span>
                </div>

                <div className="bg-gradient-to-r from-amber-50 to-amber-100 dark:from-amber-900/30 dark:to-amber-900/20
                  px-3 py-1.5 rounded-full flex items-center shadow-sm border border-amber-100 dark:border-amber-800/30">
                  <Calendar className="h-4 w-4 text-amber-600 dark:text-amber-400 me-1.5" />
                  <span className="text-sm font-semibold text-amber-700 dark:text-amber-300">
                    {t("profile.joined")} {formatDate(userData.created_date)}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              {userData.email && hookUser?.email && userData.email !== hookUser.email && (
                <FollowButton targetEmail={userData.email} />
              )}
              <Button
                onClick={() => setEditMode(true)}
                variant="outline"
                className="border-purple-200 hover:bg-purple-50 dark:border-purple-800 dark:hover:bg-purple-900/20 rounded-xl"
              >
                <Edit className="h-4 w-4 me-2" />
                {t("profile.editProfile")}
              </Button>
            </div>
          </div>

          <div className="mt-5">
            <UserStats userData={userData} />
          </div>
        </div>
      </motion.div>

      {/* Tabs */}
      <Tabs defaultValue="overview" value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-white dark:bg-gray-800 p-1.5 rounded-2xl shadow-sm border border-purple-100/50 dark:border-purple-900/20 gap-1">
          {[
            { value: "overview", label: t("profile.tabs.overview"), icon: BarChart3 },
            { value: "books", label: t("profile.tabs.books"), icon: BookOpen },
            { value: "achievements", label: t("profile.tabs.achievements"), icon: Trophy },
            { value: "activity", label: t("profile.tabs.activity"), icon: Clock },
          ].map(tab => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm
                data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-indigo-500
                data-[state=active]:text-white data-[state=active]:shadow-md transition-all"
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview">
          <motion.div
            className="grid gap-6 md:grid-cols-2"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <MyBooksSection
              books={recentBooks}
              currentLanguage={currentLanguage}
            />

            {/* Recent Achievements card */}
            <Card className="relative overflow-hidden border-0 shadow-lg rounded-2xl">
              <div
                className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05] bg-cover bg-center pointer-events-none"
                style={{ backgroundImage: "url('/images/achievements.jpg')" }}
              />
              <CardHeader className="relative">
                <CardTitle className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/20">
                    <Trophy className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                  </div>
                  {t("profile.recentAchievements")}
                </CardTitle>
              </CardHeader>
              <CardContent className="relative">
                <div className="space-y-6">
                  {achievements.length > 0 ? (
                    <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
                      {achievements.slice(0, 3).map((achievement, index) => {
                        const translationLang = currentLanguage === "hebrew" ? "he" : "en";
                        const achievementText = achievement.translations?.[translationLang] || {
                          title: achievement.title,
                          description: achievement.description
                        };

                        return (
                          <motion.div
                            key={achievement.id || index}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: index * 0.1 }}
                            className={`rounded-2xl overflow-hidden border-2 p-4 text-center
                              ${achievement.completed
                                ? "border-green-200 dark:border-green-800/40 bg-gradient-to-br from-green-50 to-emerald-50/50 dark:from-green-900/20 dark:to-emerald-900/10"
                                : "border-gray-200 dark:border-gray-700 bg-gradient-to-br from-gray-50 to-gray-100/40 dark:from-gray-800/40 dark:to-gray-800/20"
                              }`}
                          >
                            <BadgeDisplay
                              badgeId={achievement.id}
                              size="lg"
                              completed={achievement.completed}
                              inProgress={!achievement.completed && achievement.progress > 0}
                            />
                            <h4 className="font-medium mt-2 text-gray-900 dark:text-gray-100 text-sm">
                              {achievementText.title}
                            </h4>
                            {achievement.completed ? (
                              <Badge className="mt-1 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 text-xs">
                                {t("profile.achievements.completed")}
                              </Badge>
                            ) : (
                              <div className="w-full mt-2">
                                <div className={`flex justify-between text-xs text-gray-500 mb-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
                                  <span>{achievement.progress}/{achievement.max_progress}</span>
                                  <span>{achievement.xp_reward} XP</span>
                                </div>
                                <div className="h-1.5 w-full bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                                  <motion.div
                                    className="h-full rounded-full bg-gradient-to-r from-purple-400 to-indigo-400"
                                    initial={{ width: 0 }}
                                    animate={{ width: `${(achievement.progress / achievement.max_progress) * 100}%` }}
                                    transition={{ duration: 0.8, delay: 0.3 + index * 0.1 }}
                                  />
                                </div>
                              </div>
                            )}
                          </motion.div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <div className="p-4 rounded-full bg-amber-50 dark:bg-amber-900/20 inline-flex mb-3">
                        <Trophy className="h-10 w-10 text-amber-300" />
                      </div>
                      <p className="text-gray-500 dark:text-gray-400">
                        {t("profile.achievements.earnMore")}
                      </p>
                    </div>
                  )}

                  <Button
                    variant="ghost"
                    className="w-full rounded-xl text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20"
                    onClick={() => setActiveTab("achievements")}
                  >
                    {t("profile.viewAll")}
                    <ChevronRight className="h-4 w-4 ms-1" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Reading Stats Card */}
            <Card className="md:col-span-2 border-0 shadow-lg rounded-2xl overflow-hidden">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-purple-100 to-indigo-100 dark:from-purple-900/30 dark:to-indigo-900/20">
                    <BarChart3 className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  {t("profile.readingStats.title")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { icon: BookOpen, color: "purple", value: readingStats.totalBooks, label: t("profile.readingStats.booksCreated"), delay: 0 },
                    { icon: FileText, color: "blue", value: readingStats.totalPages, label: t("profile.readingStats.totalPages"), delay: 0.1 },
                    { icon: Star, color: "amber", value: readingStats.favoriteGenre ? readingStats.favoriteGenre.replace(/_/g, " ") : t("profile.readingStats.noGenre"), label: t("profile.readingStats.favoriteGenre"), delay: 0.2, capitalize: true },
                    { icon: Calendar, color: "green", value: readingStats.memberSince ? formatDate(readingStats.memberSince) : "-", label: t("profile.readingStats.memberSince"), delay: 0.3 }
                  ].map((stat, idx) => {
                    const IconComp = stat.icon;
                    const cc = colorClasses[stat.color];
                    return (
                      <motion.div
                        key={idx}
                        className={`${cc.card} rounded-2xl p-5 text-center shadow-sm hover:shadow-md transition-shadow`}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: stat.delay, duration: 0.4 }}
                        whileHover={{ y: -2 }}
                      >
                        <div className={`mx-auto mb-3 w-12 h-12 rounded-full ${cc.icon} flex items-center justify-center shadow-sm`}>
                          <IconComp className={`h-6 w-6 ${cc.iconText}`} />
                        </div>
                        <p className={`text-2xl font-bold text-gray-900 dark:text-white ${stat.capitalize ? 'capitalize' : ''}`}>
                          {stat.value}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{stat.label}</p>
                      </motion.div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        <TabsContent value="books">
          <motion.div
            className="space-y-6"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
              <h2 className="text-2xl font-bold">{t("profile.tabs.books")}</h2>
              <Link to={createPageUrl("BookWizard")}>
                <Button className="bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white rounded-xl shadow-md">
                  <Plus className="h-4 w-4 me-2" />
                  {t("profile.createBook")}
                </Button>
              </Link>
            </div>

            <MyBooksSection
              books={userBooks}
              currentLanguage={currentLanguage}
              showAll={true}
            />
          </motion.div>
        </TabsContent>

        <TabsContent value="achievements">
          <motion.div
            className="space-y-6"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <h2 className="text-2xl font-bold">{t("profile.tabs.achievements")}</h2>
            <AchievementList
              achievements={achievements}
              showCategories={true}
              showProgress={true}
            />
          </motion.div>
        </TabsContent>

        <TabsContent value="activity">
          <motion.div
            className="space-y-6"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <h2 className="text-2xl font-bold">{t("profile.tabs.activity")}</h2>

            {/* Styled activity timeline */}
            <div className="relative space-y-0">
              {recentActivity.length > 0 ? (
                <div className="border border-purple-100 dark:border-purple-900/20 rounded-2xl overflow-hidden bg-white dark:bg-gray-800 shadow-sm divide-y divide-purple-50 dark:divide-purple-900/10">
                  {recentActivity.slice(0, 8).map((activity, i) => (
                    <motion.div
                      key={activity.id}
                      initial={{ opacity: 0, x: isRTL ? 20 : -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.06, duration: 0.3 }}
                      className="flex items-center gap-4 px-5 py-4 hover:bg-purple-50/50 dark:hover:bg-purple-900/10 transition-colors"
                    >
                      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/20 flex items-center justify-center shadow-sm">
                        <BookOpen className="h-5 w-5 text-blue-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 dark:text-white text-sm truncate">
                          {activity.title}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {activity.description}
                        </p>
                      </div>
                      <span className="text-xs text-gray-400 flex-shrink-0">
                        {activity.date instanceof Date
                          ? activity.date.toLocaleDateString(currentLanguage === "hebrew" ? "he-IL" : "en-US", { month: "short", day: "numeric" })
                          : ""}
                      </span>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <RecentActivity
                  activities={recentActivity}
                  showFilters={true}
                />
              )}
            </div>
          </motion.div>
        </TabsContent>
      </Tabs>

      {/* Edit Profile Dialog */}
      <Dialog open={editMode} onOpenChange={setEditMode}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>{t("profile.editProfile")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="displayName">{t("profile.form.displayName")}</Label>
              <Input
                id="displayName"
                value={editableData.display_name}
                onChange={(e) => setEditableData({ ...editableData, display_name: e.target.value })}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bio">{t("profile.form.bio")}</Label>
              <Input
                id="bio"
                value={editableData.bio}
                onChange={(e) => setEditableData({ ...editableData, bio: e.target.value })}
                className="rounded-xl"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditMode(false)} className="rounded-xl">
              {t("profile.cancel")}
            </Button>
            <Button
              onClick={saveProfile}
              disabled={isSaving}
              className="bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 rounded-xl"
            >
              {isSaving ? (
                <>
                  <Loader2 className="me-2 h-4 w-4 animate-spin" />
                  {t("profile.saving")}
                </>
              ) : (
                t("profile.saveChanges")
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Avatar Editor Dialog */}
      <Dialog open={avatarEditorOpen} onOpenChange={setAvatarEditorOpen}>
        <DialogContent className="sm:max-w-[800px] rounded-2xl">
          <DialogHeader>
            <DialogTitle>{t("profile.avatar.studio")}</DialogTitle>
            <DialogDescription>
              {t("profile.avatar.description")}
            </DialogDescription>
          </DialogHeader>
          <AvatarSelector
            open={avatarEditorOpen}
            onOpenChange={setAvatarEditorOpen}
            currentAvatar={userData.avatar_url}
            onSelectAvatar={handleAvatarUpdate}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
