
import { useState, useEffect, memo } from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useI18n } from "@/components/i18n/i18nProvider";
import { useAuth } from "@/lib/AuthContext";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import useGamification from "@/hooks/useGamification";
import GamificationOverlay from "@/components/gamification/GamificationOverlay";
import NotificationBell from "@/components/social/NotificationBell";
import ErrorBoundary from "@/components/ErrorBoundary";
import InstallPrompt from "@/components/shared/InstallPrompt";

import {
  Settings,
  Home,
  Menu,
  X,
  Library,
  LogOut,
  Moon,
  Sun,
  Users,
  User as UserIcon,
  Users2,
  Trophy,
  Sparkles,
  PenTool,
  Globe,
  Mail
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

/**
 * NavLink — Sidebar navigation item.
 * Defined outside Layout so it is not re-created on every Layout render,
 * preventing unnecessary re-renders of all sidebar items.
 */
const NavLink = memo(function NavLink({ item, currentPath, isRTL }) {
  const isActive = currentPath === item.href;
  return (
    <Link to={createPageUrl(item.pageName)} className="w-full">
      <Button
        variant="ghost"
        className={`w-full ${isRTL ? 'justify-end flex-row-reverse' : 'justify-start'} py-6 px-4 rounded-xl transition-all duration-200 relative ${
          isActive
            ? 'bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 text-purple-700 dark:text-purple-300 shadow-sm'
            : 'hover:bg-gray-50 dark:hover:bg-gray-700/50 text-gray-700 dark:text-gray-200'
        }`}
      >
        {isActive && (
          <span className={`absolute ${isRTL ? 'right-0' : 'left-0'} top-1/2 -translate-y-1/2 w-1 h-8 rounded-full bg-purple-600 dark:bg-purple-400`} />
        )}
        <item.icon className={`h-5 w-5 ${isRTL ? 'ms-3' : 'me-3'} ${
          isActive ? 'text-purple-600 dark:text-purple-400' : 'text-gray-400 dark:text-gray-300'
        }`} />
        {item.label}
      </Button>
    </Link>
  );
});

export default function Layout({ children, currentPageName }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem("darkMode") === "true";
  });
  const location = useLocation();
  const { t: i18nT, isRTL: i18nIsRTL, language: i18nLanguage } = useI18n();
  // Use i18n context as single source of truth for language/RTL
  const currentLanguage = i18nLanguage;
  const isRTL = i18nIsRTL;
  const { logout: authLogout } = useAuth();
  const { user } = useCurrentUser();
  const gamification = useGamification();

  // Sync dark mode from user preferences
  useEffect(() => {
    try {
      const userDarkMode = user?.dark_mode;
      const storedDarkMode = localStorage.getItem("darkMode") === "true";
      const shouldUseDarkMode = userDarkMode ?? storedDarkMode;

      setDarkMode(shouldUseDarkMode);
      localStorage.setItem("darkMode", shouldUseDarkMode.toString());

      if (shouldUseDarkMode) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    } catch {
      const storedDarkMode = localStorage.getItem("darkMode") === "true";
      setDarkMode(storedDarkMode);
      if (storedDarkMode) {
        document.documentElement.classList.add("dark");
      }
    }
  }, [user]);

  // Sync dir attribute from i18n context (single source of truth)
  useEffect(() => {
    if (isRTL) {
      document.documentElement.dir = "rtl";
      document.body.classList.add("rtl");
      document.body.classList.remove("ltr");
    } else {
      document.documentElement.dir = "ltr";
      document.body.classList.remove("rtl");
      document.body.classList.add("ltr");
    }
  }, [isRTL]);

  const t = i18nT;

  const navItems = {
    main: [
      { href: "/", label: t("common.home"), icon: Home, pageName: "Home" },
    ],
    create: [
      { href: "/BookWizard", label: t("common.createBook"), icon: Sparkles, pageName: "BookWizard" },
      { href: "/BookCreation", label: t("common.advancedEditor"), icon: PenTool, pageName: "BookCreation" },
      { href: "/Characters", label: t("common.characters"), icon: Users2, pageName: "Characters" },
    ],
    mySpace: [
      { href: "/Library", label: t("common.library"), icon: Library, pageName: "Library" },
      { href: "/Profile", label: t("common.myProfile"), icon: UserIcon, pageName: "Profile" },
    ],
    community: [
      { href: "/Community", label: t("common.community"), icon: Users, pageName: "Community" },
      { href: "/Leaderboard", label: t("common.leaderboard"), icon: Trophy, pageName: "Leaderboard" },
    ],
    system: [
      { href: "/Settings", label: t("common.settings"), icon: Settings, pageName: "Settings" },
      { href: "/Contact", label: t("common.contact"), icon: Mail, pageName: "Contact" }
    ]
  };

  const handleLogout = async () => {
    try {
      const currentPreferences = {
        language: currentLanguage,
        darkMode: darkMode
      };

      localStorage.setItem("lastUserPreferences", JSON.stringify(currentPreferences));
      // authLogout calls clerk.signOut() which properly ends the Clerk session
      authLogout(true);
    } catch (error) {
      // silently handled — fall back to a hard reload
      window.location.href = '/';
    }
  };

  const toggleDarkMode = () => {
    const newDarkMode = !darkMode;
    setDarkMode(newDarkMode);
    localStorage.setItem("darkMode", newDarkMode.toString());

    if (newDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  const getLocalizedPageName = (pageName) => {
    const localized = i18nT(`pageTitles.${pageName}`);
    return localized !== `pageTitles.${pageName}` ? localized : pageName;
  };

  const getCurrentPageFromPath = () => {
    const path = location.pathname;
    if (path === "/" || path === "") return "Home";

    const pagePath = path.split("?")[0];
    const pageName = pagePath.replace(/^\/+/, "");
    switch (pageName.toLowerCase()) {
      case "library": return "Library";
      case "community": return "Community";
      case "profile": return "Profile";
      case "characters": return "Characters";
      case "leaderboard": return "Leaderboard";
      case "bookwizard": return "BookWizard";
      case "bookcreation": return "BookCreation";
      case "settings": return "Settings";
      default: return pageName.charAt(0).toUpperCase() + pageName.slice(1);
    }
  };

  const displayPageName = getLocalizedPageName(currentPageName || getCurrentPageFromPath());

  // Map user font_size and text_density settings to Tailwind classes
  const fontSizeClass = {
    small: 'text-sm',
    medium: '',
    large: 'text-lg',
    'x-large': 'text-xl',
  }[user?.font_size] ?? '';

  const textDensityClass = {
    low: 'leading-relaxed space-y-3',
    medium: '',
    high: 'leading-tight space-y-1',
  }[user?.text_density] ?? '';

  return (
    <div className={`min-h-screen w-full bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 font-sans transition-colors duration-300 ${fontSizeClass} ${textDensityClass}`.trim()}>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:bg-purple-600 focus:text-white focus:px-4 focus:py-2 focus:rounded-lg"
      >
        {t("common.skipToMainContent")}
      </a>
      <div className={isRTL ? 'pr-64 max-lg:pr-0' : 'pl-64 max-lg:pl-0'}>
        <aside className={`fixed top-0 ${isRTL ? 'right-0 border-l' : 'left-0 border-r'} h-full w-64 bg-gradient-to-b from-white via-white to-purple-50/30 dark:from-gray-800 dark:via-gray-800 dark:to-purple-950/20 border-gray-200 dark:border-gray-700 flex flex-col transition-transform duration-300 z-50 ${sidebarOpen ? 'translate-x-0' : (isRTL ? 'translate-x-full' : '-translate-x-full')} lg:translate-x-0`}>
          <div className="p-6 flex items-center justify-between border-b border-gray-100 dark:border-gray-700">
            <Link to={createPageUrl("Home")} className="flex items-center gap-3">
              <img src="/icons/icon-192x192.jpg" alt="Sipurai" className="h-10 w-10 rounded-xl shadow-lg" width="40" height="40" loading="eager" />
              <span className="font-bold text-xl bg-gradient-to-r from-purple-400 to-indigo-400 dark:from-purple-300 dark:to-indigo-300 bg-clip-text text-transparent">
                Sipurai
              </span>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden h-11 w-11 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"
              onClick={() => setSidebarOpen(false)}
              aria-label="Close sidebar"
            >
              <X className="h-5 w-5 dark:text-gray-300" />
            </Button>
          </div>

          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            <div className="mb-6">
              <h2 className="px-4 text-xs font-semibold text-gray-400 dark:text-gray-300 uppercase tracking-wider mb-2">
                {t("common.main")}
              </h2>
              <div className="space-y-1">
                {navItems.main.map(item => <NavLink key={item.href} item={item} currentPath={location.pathname} isRTL={isRTL} />)}
              </div>
            </div>

            <div className="mb-6">
              <h2 className="px-4 text-xs font-semibold text-gray-400 dark:text-gray-300 uppercase tracking-wider mb-2">
                {t("common.create")}
              </h2>
              <div className="space-y-1">
                {navItems.create.map(item => <NavLink key={item.href} item={item} currentPath={location.pathname} isRTL={isRTL} />)}
              </div>
            </div>

            <div className="mb-6">
              <h2 className="px-4 text-xs font-semibold text-gray-400 dark:text-gray-300 uppercase tracking-wider mb-2">
                {t("common.mySpace")}
              </h2>
              <div className="space-y-1">
                {navItems.mySpace.map(item => <NavLink key={item.href} item={item} currentPath={location.pathname} isRTL={isRTL} />)}
              </div>
            </div>

            <div className="mb-6">
              <h2 className="px-4 text-xs font-semibold text-gray-400 dark:text-gray-300 uppercase tracking-wider mb-2">
                {t("common.communitySection")}
              </h2>
              <div className="space-y-1">
                {navItems.community.map(item => <NavLink key={item.href} item={item} currentPath={location.pathname} isRTL={isRTL} />)}
              </div>
            </div>

            <div className="mb-6">
              <h2 className="px-4 text-xs font-semibold text-gray-400 dark:text-gray-300 uppercase tracking-wider mb-2">
                {t("common.system")}
              </h2>
              <div className="space-y-1">
                {navItems.system.map(item => <NavLink key={item.href} item={item} currentPath={location.pathname} isRTL={isRTL} />)}
              </div>
            </div>
          </nav>

          <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <Link to={createPageUrl("Profile")} className="w-full">
              <div className={`flex items-center gap-3 p-2 hover:bg-gray-100 dark:hover:bg-gray-700/50 rounded-lg transition-colors ${isRTL ? 'flex-row-reverse' : ''}`}>
                <Avatar className="h-10 w-10 border-2 border-white dark:border-gray-700 shadow-md">
                  {user?.avatar_url ? (
                    <AvatarImage src={user.avatar_url} alt={user.full_name} />
                  ) : (
                    <AvatarFallback className="bg-gradient-to-br from-purple-500 to-indigo-500 text-white">
                      {user?.full_name?.charAt(0) || "G"}
                    </AvatarFallback>
                  )}
                </Avatar>
                <div className={`flex-1 min-w-0 ${isRTL ? 'text-right' : ''}`}>
                  <p className="font-medium text-gray-900 dark:text-gray-100 truncate">
                    {user?.full_name || t("common.guest")}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                    {t("common.myProfile")}
                  </p>
                </div>
              </div>
            </Link>

            <div className="space-y-1 mt-4">
              <Button
                variant="ghost"
                className={`w-full ${isRTL ? 'justify-end flex-row-reverse' : 'justify-start'} py-5 px-4 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700/50 text-gray-700 dark:text-gray-200`}
                onClick={toggleDarkMode}
              >
                {darkMode ? (
                  <>
                    <Sun className={`h-5 w-5 ${isRTL ? 'ms-3' : 'me-3'} text-amber-400`} />
                    {t("common.lightMode")}
                  </>
                ) : (
                  <>
                    <Moon className={`h-5 w-5 ${isRTL ? 'ms-3' : 'me-3'} text-gray-400 dark:text-gray-300`} />
                    {t("common.darkMode")}
                  </>
                )}
              </Button>

              <Link to="/welcome" className="w-full">
                <Button
                  variant="ghost"
                  className={`w-full ${isRTL ? 'justify-end flex-row-reverse' : 'justify-start'} py-5 px-4 rounded-xl hover:bg-purple-50 dark:hover:bg-purple-900/20 text-gray-500 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-300`}
                >
                  <Globe className={`h-4 w-4 ${isRTL ? 'ms-3' : 'me-3'} opacity-70`} />
                  <span className="text-sm">sipurai.ai</span>
                </Button>
              </Link>

              <Button
                variant="ghost"
                className={`w-full ${isRTL ? 'justify-end flex-row-reverse' : 'justify-start'} py-5 px-4 rounded-xl text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20`}
                onClick={handleLogout}
              >
                <LogOut className={`h-5 w-5 ${isRTL ? 'ms-3' : 'me-3'}`} />
                {t("common.logout")}
              </Button>
            </div>
          </div>
        </aside>

        <div className={`lg:hidden fixed top-0 inset-x-0 z-40 h-16 bg-white/95 dark:bg-gray-800/95 backdrop-blur-md border-b border-gray-200/80 dark:border-gray-700/80 shadow-sm`}>
          <div className="px-4 h-full flex items-center justify-between" dir={isRTL ? "rtl" : "ltr"}>
            <Button
              variant="ghost"
              size="icon"
              className="h-11 w-11 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5 dark:text-gray-300" />
            </Button>

            <Link to={createPageUrl("Home")} className="flex items-center gap-2">
              <img src="/icons/icon-192x192.jpg" alt="Sipurai" className="h-8 w-8 rounded-lg" width="32" height="32" loading="eager" />
              <span className="font-bold text-base text-gray-900 dark:text-white">Sipurai</span>
            </Link>

            <div className="flex items-center gap-1">
              <NotificationBell />
              <Link to={createPageUrl("Settings")} aria-label={t("common.settings")}>
                <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
                  <Settings className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                </Button>
              </Link>
              <Link to={createPageUrl("Profile")} aria-label="View profile">
                <Avatar className="h-10 w-10 border-2 border-white dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow">
                  {user?.avatar_url ? (
                    <AvatarImage src={user.avatar_url} alt={user.full_name} />
                  ) : (
                    <AvatarFallback className="bg-gradient-to-br from-purple-500 to-indigo-500 text-white">
                      {user?.full_name?.charAt(0) || "G"}
                    </AvatarFallback>
                  )}
                </Avatar>
              </Link>
            </div>
          </div>
        </div>

        <div className={`min-h-screen pt-16 lg:pt-0`}>
          <main id="main-content" className="p-4">
            <ErrorBoundary>
              {children}
            </ErrorBoundary>
          </main>
        </div>
      </div>

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
          role="presentation"
          aria-hidden="true"
        />
      )}

      {/* Global gamification celebrations - available on all pages */}
      <GamificationOverlay
        pendingCelebrations={gamification.pendingCelebrations}
        onDismiss={gamification.dismissCelebration}
        isRTL={isRTL}
        isHebrew={currentLanguage === "hebrew"}
        isYiddish={currentLanguage === "yiddish"}
      />

      <InstallPrompt />
    </div>
  );
}
