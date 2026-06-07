import { useState, useEffect, useCallback, useRef } from "react";
import { User } from "@/entities/User";
import { Book } from "@/entities/Book";
import { UserBadge } from "@/entities/UserBadge";
import { trackEvent } from "@/lib/analytics";
import { captureError } from "@/lib/errorTracking";

// XP rewards for different actions
const XP_EVENTS = {
  book_created: 100,
  book_read: 25,       // Reading a complete book awards XP (fired from BookView on last page)
  page_edited: 10,
  character_created: 50,
  community_share: 30,
  streak_day: 20,
  book_completed: 50,  // Fired when book status transitions to "complete" (BookWizard/BookCreation)
  first_login: 10
};

// Level thresholds - index = level, value = total XP needed
const LEVEL_THRESHOLDS = [0, 200, 500, 1000, 2000, 5000, 10000, 20000, 40000, 75000, 150000];

// Badge definitions with conditions
const BADGE_DEFINITIONS = {
  first_book: {
    id: "first_book",
    nameEn: "First Book",
    nameHe: "הספר הראשון",
    descEn: "Create your first book",
    descHe: "צור את הספר הראשון שלך",
    category: "books",
    check: (stats) => stats.totalBooks >= 1,
    progress: (stats) => Math.min(stats.totalBooks, 1),
    maxProgress: 1,
    xpReward: 50
  },
  storyteller: {
    id: "storyteller",
    nameEn: "Storyteller",
    nameHe: "מספר סיפורים",
    descEn: "Create 5 books",
    descHe: "צור 5 ספרים",
    category: "books",
    check: (stats) => stats.totalBooks >= 5,
    progress: (stats) => Math.min(stats.totalBooks, 5),
    maxProgress: 5,
    xpReward: 100
  },
  prolific_author: {
    id: "prolific_author",
    nameEn: "Prolific Author",
    nameHe: "סופר פורה",
    descEn: "Create 10 books",
    descHe: "צור 10 ספרים",
    category: "books",
    check: (stats) => stats.totalBooks >= 10,
    progress: (stats) => Math.min(stats.totalBooks, 10),
    maxProgress: 10,
    xpReward: 200
  },
  character_creator: {
    id: "character_creator",
    nameEn: "Character Creator",
    nameHe: "יוצר דמויות",
    descEn: "Create 5 characters",
    descHe: "צור 5 דמויות",
    category: "creativity",
    check: (stats) => stats.totalCharacters >= 5,
    progress: (stats) => Math.min(stats.totalCharacters, 5),
    maxProgress: 5,
    xpReward: 80
  },
  community_star: {
    id: "community_star",
    nameEn: "Community Star",
    nameHe: "כוכב הקהילה",
    descEn: "Share 3 books with the community",
    descHe: "שתף 3 ספרים עם הקהילה",
    category: "community",
    check: (stats) => stats.communityShares >= 3,
    progress: (stats) => Math.min(stats.communityShares, 3),
    maxProgress: 3,
    xpReward: 100
  },
  streak_master: {
    id: "streak_master",
    nameEn: "Streak Master",
    nameHe: "אלוף הרצף",
    descEn: "7-day activity streak",
    descHe: "רצף פעילות של 7 ימים",
    category: "activity",
    check: (stats) => stats.streakDays >= 7,
    progress: (stats) => Math.min(stats.streakDays, 7),
    maxProgress: 7,
    xpReward: 75
  },
  genre_explorer: {
    id: "genre_explorer",
    nameEn: "Genre Explorer",
    nameHe: "חוקר ז'אנרים",
    descEn: "Create books in 3 different genres",
    descHe: "צור ספרים ב-3 ז'אנרים שונים",
    category: "creativity",
    check: (stats) => stats.uniqueGenres >= 3,
    progress: (stats) => Math.min(stats.uniqueGenres, 3),
    maxProgress: 3,
    xpReward: 80
  },
  multilingual: {
    id: "multilingual",
    nameEn: "Multilingual",
    nameHe: "רב-לשוני",
    descEn: "Create books in 2 different languages",
    descHe: "צור ספרים ב-2 שפות שונות",
    category: "creativity",
    check: (stats) => stats.uniqueLanguages >= 2,
    progress: (stats) => Math.min(stats.uniqueLanguages, 2),
    maxProgress: 2,
    xpReward: 100
  }
};

/**
 * Calculate level from total XP
 */
function getLevelFromXP(xp) {
  let level = 0;
  for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
    if (xp >= LEVEL_THRESHOLDS[i]) {
      level = i;
    } else {
      break;
    }
  }
  return level;
}

/**
 * Get XP needed for next level
 */
function getNextLevelXP(level) {
  if (level + 1 < LEVEL_THRESHOLDS.length) {
    return LEVEL_THRESHOLDS[level + 1];
  }
  return LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1] * 2;
}

/**
 * useGamification - Central gamification engine hook.
 * Manages XP, levels, streaks, and badges.
 */
export default function useGamification() {
  const [user, setUser] = useState(null);
  const [xp, setXP] = useState(0);
  const [level, setLevel] = useState(1);
  const [nextLevelXP, setNextLevelXP] = useState(200);
  const [streakDays, setStreakDays] = useState(0);
  const [badges, setBadges] = useState([]);
  const [earnedBadges, setEarnedBadges] = useState([]);
  const [stats, setStats] = useState({
    totalBooks: 0,
    totalCharacters: 0,
    communityShares: 0,
    streakDays: 0,
    uniqueGenres: 0,
    uniqueLanguages: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [pendingCelebrations, setPendingCelebrations] = useState([]);

  // Ref so the streak effect can call awardXP without it being a dependency
  const awardXPRef = useRef(null);

  // Load user data and compute gamification state
  const loadGamificationData = useCallback(async () => {
    try {
      setIsLoading(true);
      const currentUser = await User.me().catch(() => null);
      if (!currentUser) {
        setIsLoading(false);
        return; // Not authenticated yet — skip silently
      }
      setUser(currentUser);

      // Load books for stats
      const books = await Book.filter({ created_by: currentUser.id });

      // Compute stats from real data
      const genres = new Set(books.map(b => b.genre).filter(Boolean));
      const languages = new Set(books.map(b => b.language).filter(Boolean));

      const computedStats = {
        totalBooks: books.length,
        totalCharacters: currentUser.total_characters || 0,
        communityShares: currentUser.community_shares || 0,
        streakDays: currentUser.streak_days || 0,
        uniqueGenres: genres.size,
        uniqueLanguages: languages.size
      };
      setStats(computedStats);

      // Load user XP from entity (or default to computed)
      const userXP = currentUser.xp || books.length * XP_EVENTS.book_created;
      setXP(userXP);

      const computedLevel = getLevelFromXP(userXP);
      setLevel(computedLevel || 1);
      setNextLevelXP(getNextLevelXP(computedLevel));
      setStreakDays(computedStats.streakDays);

      // Load earned badges from entity
      let userBadges = [];
      try {
        userBadges = await UserBadge.filter({ user_id: currentUser.id || currentUser.email });
      } catch {
        // UserBadge might not have data yet
      }
      setEarnedBadges(userBadges);

      // Compute badge states
      const badgeStates = Object.values(BADGE_DEFINITIONS).map(def => {
        const earned = userBadges.find(b => b.badge_id === def.id);
        return {
          ...def,
          earned: !!earned || def.check(computedStats),
          earnedDate: earned?.earned_date || null,
          currentProgress: def.progress(computedStats)
        };
      });
      setBadges(badgeStates);

    } catch (err) {
      captureError(err, { context: 'useGamification.loadGamificationData' });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadGamificationData();
  }, [loadGamificationData]);

  // Update streak on load
  useEffect(() => {
    if (!user) return;

    const updateStreak = async () => {
      const lastActive = localStorage.getItem(`streak_last_active_${user.email}`);
      const today = new Date().toDateString();

      if (lastActive === today) return; // Already counted today

      const yesterday = new Date(Date.now() - 86400000).toDateString();
      let newStreak = streakDays;

      if (lastActive === yesterday) {
        newStreak = streakDays + 1;
      } else if (lastActive !== today) {
        newStreak = 1; // Reset streak
      }

      localStorage.setItem(`streak_last_active_${user.email}`, today);

      if (newStreak !== streakDays) {
        setStreakDays(newStreak);
        try {
          await User.updateMyUserData({ streak_days: newStreak });
        } catch {
          // silently handled
        }
        // Award streak XP for continuing or starting a streak
        if (awardXPRef.current) {
          await awardXPRef.current("streak_day");
        }
      }
    };

    updateStreak();
  }, [user, streakDays]);

  /**
   * Award XP for an action and check for level-up + new badges
   */
  const awardXP = useCallback(async (eventType, customAmount) => {
    const amount = customAmount || XP_EVENTS[eventType] || 0;
    if (!amount) return { xpGained: 0 };

    const newXP = xp + amount;
    const oldLevel = level;
    const newLevel = getLevelFromXP(newXP);

    setXP(newXP);
    setLevel(newLevel || 1);
    setNextLevelXP(getNextLevelXP(newLevel));

    const celebrations = [];

    // XP toast
    celebrations.push({
      type: "xp",
      amount,
      eventType
    });

    // Level up check
    if (newLevel > oldLevel) {
      celebrations.push({
        type: "level_up",
        oldLevel,
        newLevel
      });
    }

    // Persist XP to user entity
    try {
      await User.updateMyUserData({
        xp: newXP,
        level: newLevel || 1,
        next_level_xp: getNextLevelXP(newLevel)
      });
    } catch (err) {
      captureError(err, { context: 'useGamification.awardXP.persistXP' });
    }

    // Check for newly earned badges
    const newBadges = await checkNewBadges();
    for (const badge of newBadges) {
      celebrations.push({
        type: "badge",
        badge
      });
    }

    setPendingCelebrations(prev => [...prev, ...celebrations]);

    return {
      xpGained: amount,
      newXP,
      leveledUp: newLevel > oldLevel,
      newLevel,
      newBadges
    };
  }, [xp, level]);

  // Keep the ref in sync so streak effect can call awardXP safely
  useEffect(() => {
    awardXPRef.current = awardXP;
  }, [awardXP]);

  /**
   * Check and award any newly earned badges
   */
  const checkNewBadges = useCallback(async () => {
    const newlyEarned = [];

    for (const def of Object.values(BADGE_DEFINITIONS)) {
      const alreadyEarned = earnedBadges.some(b => b.badge_id === def.id);
      if (alreadyEarned) continue;

      if (def.check(stats)) {
        try {
          await UserBadge.create({
            user_id: user?.id || user?.email,
            badge_id: def.id,
            earned_date: new Date().toISOString(),
            progress: def.maxProgress
          });

          newlyEarned.push(def);
          trackEvent('badge_earned', { badge_id: def.id, badge_name: def.nameEn });

          // Award badge XP bonus
          const bonusXP = def.xpReward || 0;
          if (bonusXP) {
            const updatedXP = xp + bonusXP;
            setXP(updatedXP);
            try {
              await User.updateMyUserData({ xp: updatedXP });
            } catch (err) {
              captureError(err, { context: 'useGamification.checkNewBadges.persistBadgeXP', badge_id: def.id });
            }
          }
        } catch (err) {
          captureError(err, { context: 'useGamification.checkNewBadges.createBadge', badge_id: def.id });
        }
      }
    }

    if (newlyEarned.length > 0) {
      setEarnedBadges(prev => [
        ...prev,
        ...newlyEarned.map(def => ({
          badge_id: def.id,
          earned_date: new Date().toISOString(),
          progress: def.maxProgress
        }))
      ]);

      // Refresh badge states
      setBadges(prev =>
        prev.map(b => {
          const justEarned = newlyEarned.find(n => n.id === b.id);
          if (justEarned) {
            return { ...b, earned: true, earnedDate: new Date().toISOString() };
          }
          return b;
        })
      );
    }

    return newlyEarned;
  }, [earnedBadges, stats, user, xp]);

  /**
   * Increment a stat and re-check badges
   */
  const incrementStat = useCallback(async (statKey, amount = 1) => {
    setStats(prev => {
      const updated = { ...prev, [statKey]: (prev[statKey] || 0) + amount };
      return updated;
    });
  }, []);

  /**
   * Dismiss a celebration from the pending queue
   */
  const dismissCelebration = useCallback(() => {
    setPendingCelebrations(prev => prev.slice(1));
  }, []);

  /**
   * Get progress percentage to next level
   */
  const progressPercent = level > 0
    ? ((xp - LEVEL_THRESHOLDS[level]) / (nextLevelXP - LEVEL_THRESHOLDS[level])) * 100
    : (xp / nextLevelXP) * 100;

  return {
    // State
    user,
    xp,
    level,
    nextLevelXP,
    streakDays,
    badges,
    earnedBadges,
    stats,
    isLoading,
    progressPercent: Math.min(100, Math.max(0, progressPercent)),
    pendingCelebrations,

    // Actions
    awardXP,
    checkNewBadges,
    incrementStat,
    dismissCelebration,
    reload: loadGamificationData,

    // Constants (for external use)
    XP_EVENTS,
    LEVEL_THRESHOLDS,
    BADGE_DEFINITIONS
  };
}

// Named exports for use outside the hook
export { XP_EVENTS, LEVEL_THRESHOLDS, BADGE_DEFINITIONS, getLevelFromXP, getNextLevelXP };
