
import { useState, useEffect } from "react";
import { useI18n } from "@/components/i18n/i18nProvider";
import { Book } from "@/entities/Book";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { getLevelFromXP } from "@/hooks/useGamification";
import {
  Trophy,
  Medal,
  Award,
  Search,
  CalendarRange,
  Clock,
  BookOpen,
  Users,
  Shield,
  Calendar,
  Sparkles,
  Zap,
  Flame
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { motion, AnimatePresence } from "framer-motion";

export default function Leaderboard() {
  const { t, language, isRTL } = useI18n();
  const { user: hookUser } = useCurrentUser();
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [timePeriod, setTimePeriod] = useState("weekly");
  const [category, setCategory] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalStoryTellers, setTotalStoryTellers] = useState(0);

  useEffect(() => {
    loadData();
   
  }, [hookUser]);

  useEffect(() => {
    buildLeaderboard();
   
  }, [timePeriod, category]);

  const loadData = async () => {
    try {
      setIsLoading(true);

      if (hookUser) {
        setCurrentUser(hookUser);
      }

      await buildLeaderboard(hookUser);
    } catch {
      // silently handled
    } finally {
      setIsLoading(false);
    }
  };

  const buildLeaderboard = async (userOverride) => {
    try {
      const user = userOverride || currentUser;

      const allBooks = await Book.list("-created_date", 200);

      const now = new Date();
      let dateThreshold = null;
      if (timePeriod === "weekly") {
        dateThreshold = new Date(now.getTime() - 7 * 86400000);
      } else if (timePeriod === "monthly") {
        dateThreshold = new Date(now.getTime() - 30 * 86400000);
      }

      const filteredBooks = dateThreshold
        ? allBooks.filter(b => new Date(b.created_date) >= dateThreshold)
        : allBooks;

      // created_by holds the Clerk sub (user.id) since the 2026-05-25 ownership
      // migration — NEVER compare it to user.email (see CLAUDE.md). Never show
      // the raw Clerk id as a display name.
      const userMap = {};
      for (const book of filteredBooks) {
        const creatorId = book.created_by;
        if (!creatorId) continue;

        if (!userMap[creatorId]) {
          const fallbackName = creatorId.includes("@")
            ? creatorId.split("@")[0] // legacy pre-migration rows stored email
            : t("common.unknownUser");
          userMap[creatorId] = {
            email: creatorId,
            name: book.created_by_name || fallbackName,
            avatar: "",
            books: 0,
            xp: 0,
            streak: 0,
            level: 1,
            isCurrentUser: user ? creatorId === user.id : false
          };
        }
        userMap[creatorId].books += 1;
        userMap[creatorId].xp += 100;
      }

      if (user) {
        const selfKey = user.id;
        const selfName = user.display_name || user.full_name || (user.email ? user.email.split("@")[0] : t("common.unknownUser"));
        if (userMap[selfKey]) {
          userMap[selfKey].name = selfName;
          userMap[selfKey].avatar = user.avatar_url || "";
          userMap[selfKey].xp = user.xp || userMap[selfKey].xp;
          userMap[selfKey].level = user.level || getLevelFromXP(userMap[selfKey].xp);
          userMap[selfKey].streak = user.streak_days || 0;
          userMap[selfKey].isCurrentUser = true;
        } else {
          userMap[selfKey] = {
            email: user.email,
            name: selfName,
            avatar: user.avatar_url || "",
            books: 0,
            xp: user.xp || 0,
            streak: user.streak_days || 0,
            level: user.level || 1,
            isCurrentUser: true
          };
        }
      }

      let entries = Object.values(userMap);

      entries = entries.map(e => ({
        ...e,
        level: e.level || getLevelFromXP(e.xp)
      }));

      if (category === "books") {
        entries.sort((a, b) => b.books - a.books);
      } else if (category === "streak") {
        entries.sort((a, b) => b.streak - a.streak);
      } else {
        entries.sort((a, b) => b.xp - a.xp);
      }

      setLeaderboardData(entries);
      setTotalStoryTellers(entries.length);
    } catch {
      // silently handled
    }
  };

  const handleSearch = (e) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1);
  };

  const handleTimePeriodChange = (period) => {
    setTimePeriod(period);
    setCurrentPage(1);
  };

  const handleCategoryChange = (value) => {
    setCategory(value);
    setCurrentPage(1);
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const getRankDecoration = (rank) => {
    switch (rank) {
      case 1:
        return {
          icon: <Trophy className="h-5 w-5 text-amber-500" />,
          badgeClass: "bg-gradient-to-br from-amber-300 to-yellow-400 text-amber-900 shadow ring-2 ring-amber-300/60",
          rowClass: "bg-gradient-to-r from-amber-50/90 to-yellow-50/60 dark:from-amber-900/20 dark:to-yellow-900/10 border-s-4 border-amber-400",
          podiumClass: "bg-gradient-to-b from-amber-400 to-yellow-500",
          podiumHeight: "h-32",
          medal: "🥇"
        };
      case 2:
        return {
          icon: <Medal className="h-5 w-5 text-gray-400" />,
          badgeClass: "bg-gradient-to-br from-gray-300 to-slate-400 text-gray-800 shadow ring-2 ring-gray-300/60",
          rowClass: "bg-gradient-to-r from-gray-50/80 to-slate-50/50 dark:from-gray-800/30 dark:to-slate-800/20 border-s-4 border-gray-300",
          podiumClass: "bg-gradient-to-b from-gray-300 to-slate-400",
          podiumHeight: "h-24",
          medal: "🥈"
        };
      case 3:
        return {
          icon: <Award className="h-5 w-5 text-orange-600" />,
          badgeClass: "bg-gradient-to-br from-orange-300 to-amber-400 text-orange-900 shadow ring-2 ring-orange-300/60",
          rowClass: "bg-gradient-to-r from-orange-50/70 to-amber-50/40 dark:from-orange-900/15 dark:to-amber-900/8 border-s-4 border-orange-300",
          podiumClass: "bg-gradient-to-b from-orange-400 to-amber-500",
          podiumHeight: "h-20",
          medal: "🥉"
        };
      default:
        return {
          icon: null,
          badgeClass: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
          rowClass: "",
          podiumClass: "",
          podiumHeight: "",
          medal: null
        };
    }
  };

  const filteredLeaderboard = leaderboardData.filter(user =>
    user.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const currentUserEntry = leaderboardData.find(u => u.isCurrentUser);
  const currentUserRank = currentUserEntry ? leaderboardData.indexOf(currentUserEntry) + 1 : null;

  const totalPages = Math.max(1, Math.ceil(filteredLeaderboard.length / 10));
  const paginatedData = filteredLeaderboard.slice((currentPage - 1) * 10, currentPage * 10);

  // Top 3 for podium
  const top3 = filteredLeaderboard.slice(0, 3);

  const periodButtons = [
    { value: "weekly", label: t("leaderboard.tabs.weekly"), icon: CalendarRange },
    { value: "monthly", label: t("leaderboard.tabs.monthly"), icon: Calendar },
    { value: "allTime", label: t("leaderboard.tabs.allTime"), icon: Clock },
  ];

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto pb-12 p-4 md:p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48 rounded-xl" />
            <Skeleton className="h-4 w-64 rounded-lg" />
          </div>
          <Skeleton className="h-10 w-64 rounded-2xl" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Skeleton className="md:col-span-2 h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex gap-2">
            <Skeleton className="h-9 w-28 rounded-2xl" />
            <Skeleton className="h-9 w-28 rounded-2xl" />
            <Skeleton className="h-9 w-28 rounded-2xl" />
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-4">
                <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
                  <Skeleton className="h-4 w-32 rounded" />
                </div>
                <Skeleton className="h-4 w-12 rounded hidden sm:block" />
                <Skeleton className="h-4 w-16 rounded hidden sm:block" />
                <Skeleton className="h-4 w-10 rounded hidden md:block" />
                <Skeleton className="h-8 w-20 rounded-xl flex-shrink-0" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto pb-12" dir={isRTL ? "rtl" : "ltr"}>
      {/* Gradient Banner Header */}
      <motion.div
        className="relative overflow-hidden rounded-2xl mx-4 md:mx-6 mt-4 mb-6 shadow-xl"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-500 p-8 md:p-10">
          <div
            className="absolute inset-0 opacity-[0.08] bg-cover bg-center pointer-events-none"
            style={{ backgroundImage: "url('/images/leaderboard.jpg')" }}
          />
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_70%_30%,white_0%,transparent_60%)]" />

          <div className={`relative flex flex-col md:flex-row md:items-center md:justify-between gap-5 ${isRTL ? 'md:flex-row-reverse' : ''}`}>
            <div className={`flex items-center gap-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <div className="p-3 bg-white/20 backdrop-blur-sm rounded-2xl shadow-sm">
                <Trophy className="h-9 w-9 text-white drop-shadow" />
              </div>
              <div className={isRTL ? 'text-right' : ''}>
                <h1 className="text-2xl md:text-3xl font-bold text-white drop-shadow-sm">
                  {t("leaderboard.title")}
                </h1>
                <p className="text-white/80 mt-0.5">{t("leaderboard.subtitle")}</p>
              </div>
            </div>

            {/* Search in banner */}
            <div className="relative">
              <Search className={`absolute ${isRTL ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 h-4 w-4 text-white/60 pointer-events-none`} />
              <Input
                placeholder={t("leaderboard.search")}
                value={searchQuery}
                onChange={handleSearch}
                className={`w-full md:w-64 ${isRTL ? 'pr-9' : 'pl-9'} rounded-2xl
                  bg-white/20 backdrop-blur-sm border-white/30 text-white placeholder:text-white/50
                  focus:bg-white/30 focus:border-white/60 focus:ring-white/30`}
              />
            </div>
          </div>
        </div>
      </motion.div>

      <div className="p-4 md:p-6 pt-0 space-y-5">

        {/* Stats cards row */}
        <motion.div
          className="grid grid-cols-1 md:grid-cols-4 gap-4"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.5 }}
        >
          {/* Your rank card */}
          <Card className="md:col-span-2 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 border-purple-200 dark:border-purple-900/30 rounded-2xl shadow-sm overflow-hidden">
            <CardContent className="p-5">
              {currentUserEntry ? (
                <div className={`flex items-center gap-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <div className={`flex items-center justify-center w-14 h-14 rounded-full flex-shrink-0 ${getRankDecoration(currentUserRank).badgeClass}`}>
                    {getRankDecoration(currentUserRank).icon || (
                      <span className="text-xl font-bold">#{currentUserRank}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-semibold text-gray-900 dark:text-white">{t("leaderboard.your.rank")}</h3>
                    <div className="flex flex-wrap items-center gap-2 mt-1.5">
                      <Badge variant="outline" className="gap-1 font-normal bg-white/70 dark:bg-gray-800/50 text-xs rounded-full">
                        <Trophy className="h-3 w-3 text-amber-500" />
                        #{currentUserRank}
                      </Badge>
                      <Badge variant="outline" className="gap-1 font-normal bg-white/70 dark:bg-gray-800/50 text-xs rounded-full">
                        <Zap className="h-3 w-3 text-purple-500" />
                        {currentUserEntry.xp} XP
                      </Badge>
                      <Badge variant="outline" className="gap-1 font-normal bg-white/70 dark:bg-gray-800/50 text-xs rounded-full">
                        <BookOpen className="h-3 w-3 text-blue-500" />
                        {currentUserEntry.books} {t("leaderboard.booksCount")}
                      </Badge>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-2">
                  <p className="text-gray-600 dark:text-gray-400 text-sm">
                    {t("leaderboard.loginToSeeRank")}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border-amber-200 dark:border-amber-900/30 rounded-2xl shadow-sm overflow-hidden">
            <CardContent className="p-4 text-center">
              <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <Trophy className="h-6 w-6 text-amber-500" />
              </div>
              <h3 className="font-semibold text-base">{t("leaderboard.top.storytellers")}</h3>
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-0.5">{totalStoryTellers}</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-green-200 dark:border-green-900/30 rounded-2xl shadow-sm overflow-hidden">
            <CardContent className="p-4 text-center">
              <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <Users className="h-6 w-6 text-green-500" />
              </div>
              <h3 className="font-semibold text-base">{t("leaderboard.rising.stars")}</h3>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-0.5">
                {leaderboardData.filter(u => u.books > 0).length}
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Top 3 Podium */}
        {top3.length >= 3 && (
          <motion.div
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-purple-100/50 dark:border-purple-900/20 p-6 overflow-hidden"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.5 }}
          >
            <div className={`flex items-center gap-2 mb-5 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <Sparkles className="h-5 w-5 text-amber-500" />
              <h3 className="font-bold text-gray-900 dark:text-white">
                {t("leaderboard.top3Champions")}
              </h3>
            </div>

            {/* Podium layout: 2nd, 1st, 3rd */}
            <div className="flex items-end justify-center gap-3 md:gap-6">
              {[top3[1], top3[0], top3[2]].map((entry, podiumIndex) => {
                if (!entry) return null;
                const rank = podiumIndex === 1 ? 1 : podiumIndex === 0 ? 2 : 3;
                const dec = getRankDecoration(rank);
                const heightClass = rank === 1 ? "h-32" : rank === 2 ? "h-24" : "h-20";

                return (
                  <motion.div
                    key={entry.email}
                    className="flex flex-col items-center gap-2 flex-1 max-w-[120px]"
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 + podiumIndex * 0.1, duration: 0.5 }}
                  >
                    <span className="text-2xl">{dec.medal}</span>
                    <Avatar className={`${rank === 1 ? 'h-14 w-14' : 'h-11 w-11'} border-3 border-white shadow-lg ring-2 ${rank === 1 ? 'ring-amber-300' : rank === 2 ? 'ring-gray-300' : 'ring-orange-300'}`}>
                      {entry.avatar ? (
                        <AvatarImage src={entry.avatar} alt={entry.name} />
                      ) : (
                        <AvatarFallback className="bg-gradient-to-br from-purple-500 to-indigo-500 text-white font-bold">
                          {entry.name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      )}
                    </Avatar>
                    <div className="text-center">
                      <p className="font-semibold text-sm text-gray-900 dark:text-white truncate max-w-[100px]">
                        {entry.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{entry.xp} XP</p>
                    </div>
                    {/* Podium block */}
                    <div className={`w-full ${heightClass} ${dec.podiumClass} rounded-t-xl flex items-start justify-center pt-2 shadow-md`}>
                      <span className="text-white font-bold text-lg">#{rank}</span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Period selector + Category filter */}
        <motion.div
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-purple-100/50 dark:border-purple-900/20 overflow-hidden"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.5 }}
        >
          <div className={`p-4 border-b border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 ${isRTL ? 'sm:flex-row-reverse' : ''}`}>
            {/* Period pill buttons */}
            <div className="flex gap-2 p-1 bg-gray-100 dark:bg-gray-700/50 rounded-2xl w-fit">
              {periodButtons.map(btn => (
                <button
                  key={btn.value}
                  onClick={() => handleTimePeriodChange(btn.value)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-all duration-150
                    ${timePeriod === btn.value
                      ? "bg-gradient-to-r from-amber-400 to-orange-400 text-white shadow-md"
                      : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                    }`}
                >
                  <btn.icon className="h-4 w-4" />
                  {btn.label}
                </button>
              ))}
            </div>

            {/* Category filter */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                {t("leaderboard.filter.title")}:
              </span>
              <Select value={category} onValueChange={handleCategoryChange}>
                <SelectTrigger className="w-[160px] rounded-xl border-purple-100 dark:border-purple-900/30">
                  <SelectValue placeholder={t("leaderboard.filter.all")} />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="all">{t("leaderboard.filter.all")}</SelectItem>
                  <SelectItem value="books">{t("leaderboard.filter.books")}</SelectItem>
                  <SelectItem value="streak">{t("leaderboard.filter.streak")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Rankings Table */}
          {paginatedData.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center">
                <Trophy className="h-8 w-8 text-amber-300" />
              </div>
              <p className="text-gray-500 dark:text-gray-400">{t("leaderboard.empty")}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full table-auto">
                <thead>
                  <tr className="bg-gray-50/80 dark:bg-gray-800/50">
                    <th className="px-4 py-3 text-start text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      {t("leaderboard.rank")}
                    </th>
                    <th className="px-4 py-3 text-start text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      {t("leaderboard.user")}
                    </th>
                    <th className="px-4 py-3 text-start text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      {t("leaderboard.level")}
                    </th>
                    <th className="px-4 py-3 text-start text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      {t("leaderboard.xp")}
                    </th>
                    <th className="px-4 py-3 text-start text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      {t("leaderboard.books")}
                    </th>
                    <th className="px-4 py-3 text-start text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      {t("leaderboard.streak")}
                    </th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700/50">
                  <AnimatePresence>
                    {paginatedData.map((entry, index) => {
                      const actualRank = (currentPage - 1) * 10 + index + 1;
                      const dec = getRankDecoration(actualRank);
                      const isCurrentUser = entry.isCurrentUser;

                      return (
                        <motion.tr
                          key={entry.email}
                          initial={{ opacity: 0, x: isRTL ? 16 : -16 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.04, duration: 0.3 }}
                          className={`transition-all duration-150
                            ${isCurrentUser
                              ? "bg-gradient-to-r from-purple-50 to-indigo-50/60 dark:from-purple-900/15 dark:to-indigo-900/10 ring-1 ring-inset ring-purple-200 dark:ring-purple-800/40"
                              : dec.rowClass || "hover:bg-gray-50/70 dark:hover:bg-gray-800/50"
                            }`}
                        >
                          <td className="px-4 py-4 whitespace-nowrap">
                            <div
                              className={`inline-flex items-center justify-center w-9 h-9 rounded-full text-sm font-bold ${dec.badgeClass}`}
                            >
                              {dec.icon || <span>#{actualRank}</span>}
                            </div>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                              <Avatar className="h-9 w-9 shrink-0 shadow-sm">
                                {entry.avatar ? (
                                  <AvatarImage src={entry.avatar} alt={entry.name} />
                                ) : (
                                  <AvatarFallback className="bg-gradient-to-br from-purple-500 to-indigo-500 text-white text-sm font-semibold">
                                    {entry.name.charAt(0).toUpperCase()}
                                  </AvatarFallback>
                                )}
                              </Avatar>
                              <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                                <span className="font-medium text-gray-900 dark:text-white">{entry.name}</span>
                                {isCurrentUser && (
                                  <Badge className="text-xs bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 rounded-full px-2">
                                    {t("leaderboard.you")}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <div className="w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                                <Shield className="h-3.5 w-3.5 text-purple-500" />
                              </div>
                              <span className="font-medium text-sm">{entry.level || 1}</span>
                            </div>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-1">
                              <Zap className="h-3.5 w-3.5 text-amber-500" />
                              <span className="font-semibold text-sm">{(entry.xp || 0).toLocaleString()}</span>
                            </div>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <BookOpen className="h-3.5 w-3.5 text-blue-500" />
                              <span className="text-sm">{entry.books}</span>
                            </div>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <Flame className="h-3.5 w-3.5 text-orange-500" />
                              <span className="text-sm">{entry.streak}
                                {timePeriod !== "allTime" ? (
                                  <span className="text-xs text-gray-400 ms-1">
                                    {t("leaderboard.days")}
                                  </span>
                                ) : null}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-end whitespace-nowrap">
                            <span className="text-xs text-gray-400 dark:text-gray-500">
                              {entry.totalBooks} {t("leaderboard.books")}
                            </span>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          )}

          {totalPages > 1 && (
            <div className="p-4 border-t border-gray-100 dark:border-gray-700">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                      className={currentPage === 1 ? "pointer-events-none opacity-50" : ""}
                    />
                  </PaginationItem>

                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNumber;
                    if (totalPages <= 5) {
                      pageNumber = i + 1;
                    } else if (currentPage <= 3) {
                      pageNumber = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNumber = totalPages - 4 + i;
                    } else {
                      pageNumber = currentPage - 2 + i;
                    }

                    return (
                      <PaginationItem key={i}>
                        <PaginationLink
                          isActive={pageNumber === currentPage}
                          onClick={() => handlePageChange(pageNumber)}
                          className={pageNumber === currentPage ? "bg-gradient-to-r from-purple-500 to-indigo-500 text-white border-transparent" : ""}
                        >
                          {pageNumber}
                        </PaginationLink>
                      </PaginationItem>
                    );
                  })}

                  {totalPages > 5 && currentPage < totalPages - 2 && (
                    <>
                      <PaginationItem>
                        <PaginationEllipsis />
                      </PaginationItem>
                      <PaginationItem>
                        <PaginationLink onClick={() => handlePageChange(totalPages)}>
                          {totalPages}
                        </PaginationLink>
                      </PaginationItem>
                    </>
                  )}

                  <PaginationItem>
                    <PaginationNext
                      onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                      className={currentPage === totalPages ? "pointer-events-none opacity-50" : ""}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
