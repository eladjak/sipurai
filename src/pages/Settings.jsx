
import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useI18n } from '@/components/i18n/i18nProvider';
import { useToast } from '@/components/ui/use-toast';
import { User } from '@/entities/User';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';


import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Settings as SettingsIcon,
  User as UserIcon,
  Palette,
  Globe,
  Volume2,
  Sparkles,
  CreditCard,
  Shield,
  Bell,
  Loader2,
  LogOut,
  Sun,
  Moon,
  Clock,
  Check,
  Crown,
  Type,
  AlignJustify,
} from 'lucide-react';
import AIStudio from '../components/ai/AIStudio';
import AIProvidersPanel from '../components/ai/AIProvidersPanel';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import ParentalControls from '../components/settings/ParentalControls';
import { PLANS, openCheckout } from '@/lib/creem';
import useSubscription from '@/hooks/useSubscription';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';

// Language option with flag
const LANGUAGE_OPTIONS = [
  { value: "english", flag: "🇺🇸" },
  { value: "hebrew", flag: "🇮🇱" },
  { value: "yiddish", flag: "🟡" },
];

function SettingRow({ label, children, isRTL }) {
  return (
    <div className={`flex items-center justify-between gap-4 py-3 border-b last:border-0 border-purple-50 dark:border-purple-900/30 ${isRTL ? "flex-row-reverse" : ""}`}>
      <span className={`text-sm font-medium text-gray-700 dark:text-gray-300 ${isRTL ? "text-right" : "text-left"}`}>{label}</span>
      {children}
    </div>
  );
}

function SettingCard({ title, icon, children, isRTL, className = "" }) {
  return (
    <Card className={`rounded-2xl border-0 shadow-md bg-white dark:bg-gray-900 overflow-hidden ${className}`}>
      <CardHeader className={`pb-2 pt-5 px-5 ${isRTL ? "text-right" : "text-left"}`}>
        <CardTitle className={`flex items-center gap-2 text-base font-bold ${isRTL ? "flex-row-reverse" : ""}`}>
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-5 pb-5">
        {children}
      </CardContent>
    </Card>
  );
}

function BillingTab({ currentPlan, userEmail, isRTL, toast }) {
  const { t } = useI18n();
  const [upgrading, setUpgrading] = useState(null); // planId being upgraded
  const [confirmPlan, setConfirmPlan] = useState(null); // plan awaiting confirmation
  const lang = isRTL ? 'he' : 'en';

  const handleUpgrade = (planId) => {
    setConfirmPlan(planId);
  };

  const confirmAndCheckout = async () => {
    const planId = confirmPlan;
    setConfirmPlan(null);
    setUpgrading(planId);
    try {
      await openCheckout(planId, userEmail);
    } catch {
      toast({
        title: t('settings.billing.checkoutError'),
        description: t('settings.billing.checkoutErrorDesc'),
        variant: 'destructive',
      });
    } finally {
      setUpgrading(null);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="space-y-5">

      {/* Current plan summary */}
      <SettingCard
        title={t('settings.billing.currentPlanLabel')}
        icon={<CreditCard className="h-5 w-5 text-purple-500" />}
        isRTL={isRTL}
      >
        <div className={`flex items-center gap-3 mt-2 ${isRTL ? "flex-row-reverse" : ""}`}>
          <Badge className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white border-0 px-3 py-1 text-sm shadow-md">
            {PLANS[currentPlan]?.name[lang] || t('settings.billing.free')}
          </Badge>
          {currentPlan !== 'free' && (
            <span className="text-sm text-gray-500">
              {PLANS[currentPlan]?.priceDisplay?.[lang] || PLANS[currentPlan]?.priceDisplay?.en}
            </span>
          )}
        </div>
      </SettingCard>

      {/* Plan cards */}
      <div className="grid md:grid-cols-4 gap-4">
        {Object.values(PLANS).map((planDef) => {
          const isCurrent = currentPlan === planDef.id;
          const isPaid = planDef.id !== 'free';
          const isLoadingThis = upgrading === planDef.id;

          return (
            <Card
              key={planDef.id}
              className={`relative overflow-hidden rounded-2xl border-0 shadow-md transition-all ${
                isCurrent ? 'ring-2 ring-purple-500 ring-offset-2' : ''
              } ${planDef.popular ? 'md:scale-105 shadow-lg shadow-purple-200/50 dark:shadow-purple-900/30' : ''}`}
            >
              {planDef.popular && (
                <div className="absolute top-0 left-0 right-0 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-center text-xs py-1 font-semibold">
                  {t('settings.billing.mostPopular')}
                </div>
              )}
              <CardHeader className={`${planDef.popular ? 'pt-8' : 'pt-5'} px-5 pb-3`}>
                <CardTitle className={`flex items-center gap-2 text-base ${isRTL ? "flex-row-reverse text-right" : "text-left"}`}>
                  {isPaid && <Crown className="h-5 w-5 text-purple-500" />}
                  {planDef.name[lang]}
                  {isCurrent && (
                    <Badge className="bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 border-0 text-xs">
                      {t('settings.billing.activeBadge')}
                    </Badge>
                  )}
                </CardTitle>
                <div className={`text-2xl font-bold bg-gradient-to-r from-purple-700 to-indigo-600 bg-clip-text text-transparent ${isRTL ? 'text-right' : 'text-left'}`}>
                  {planDef.priceDisplay?.[lang] || planDef.priceDisplay?.en}
                </div>
              </CardHeader>
              <CardContent className="px-5 pb-5">
                <ul className="space-y-1.5 mb-4">
                  {planDef.features[lang].map((feature, j) => (
                    <li key={j} className={`flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 ${isRTL ? "flex-row-reverse" : ""}`}>
                      <Check className="h-4 w-4 text-green-500 shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
                {isCurrent ? (
                  <Button className="w-full rounded-xl" variant="outline" disabled>
                    {t('settings.billing.currentPlanBtn')}
                  </Button>
                ) : isPaid ? (
                  <Button
                    className="w-full rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white border-0 shadow-md"
                    onClick={() => handleUpgrade(planDef.id)}
                    disabled={!!upgrading}
                  >
                    {isLoadingThis ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      t('settings.billing.upgradeNow')
                    )}
                  </Button>
                ) : (
                  <Button className="w-full rounded-xl" variant="outline" disabled>
                    {t('settings.billing.free')}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Hebrew confirmation dialog before redirecting to Creem (English checkout) */}
      <AlertDialog open={!!confirmPlan} onOpenChange={(open) => !open && setConfirmPlan(null)}>
        <AlertDialogContent dir={isRTL ? 'rtl' : 'ltr'}>
          <AlertDialogHeader>
            <AlertDialogTitle className={isRTL ? 'text-right' : 'text-left'}>
              {isRTL ? 'מעבר לדף תשלום מאובטח' : 'Redirecting to Secure Checkout'}
            </AlertDialogTitle>
            <AlertDialogDescription className={`space-y-2 ${isRTL ? 'text-right' : 'text-left'}`}>
              <span className="block">
                {isRTL
                  ? `את/ה עומד/ת לשדרג לתוכנית ${PLANS[confirmPlan]?.name?.he || ''} (${PLANS[confirmPlan]?.priceDisplay?.he || ''}).`
                  : `You are about to upgrade to the ${PLANS[confirmPlan]?.name?.en || ''} plan (${PLANS[confirmPlan]?.priceDisplay?.en || ''}).`}
              </span>
              <span className="block">
                {isRTL
                  ? 'תועבר/י לדף תשלום מאובטח של Creem. דף התשלום מוצג באנגלית — אל דאגה, זה תקין ומאובטח לחלוטין.'
                  : 'You will be redirected to a secure Creem checkout page.'}
              </span>
              <span className="block text-xs text-gray-500">
                {isRTL
                  ? '🔒 התשלום מעובד באופן מאובטח. לא נשמרים פרטי כרטיס אשראי.'
                  : '🔒 Payment is processed securely. No credit card details are stored.'}
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className={isRTL ? 'flex-row-reverse' : ''}>
            <AlertDialogCancel>{isRTL ? 'ביטול' : 'Cancel'}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmAndCheckout}
              className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white"
            >
              {isRTL ? 'המשך לתשלום' : 'Continue to Checkout'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}

export default function Settings() {
  const { t, language, isRTL } = useI18n();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const { user: hookUser } = useCurrentUser();
  const { plan: currentPlan, refetch: refetchSubscription } = useSubscription();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState({
    language: "english",
    dark_mode: false,
    text_density: "medium",
    font_size: "medium",
    notifications_enabled: true,
    audio_enabled: true,
    audio_speed: "1",
    default_story_language: "english"
  });
  const [tempSettings, setTempSettings] = useState({});

  // Handle checkout success redirect
  useEffect(() => {
    const checkoutStatus = searchParams.get('checkout');
    const upgradedPlan = searchParams.get('plan');

    if (checkoutStatus === 'success') {
      toast({
        title: t('settings.upgradeSuccess'),
        description: t('settings.upgradeSuccessDesc').replace('{plan}', upgradedPlan || 'Premium'),
      });
      refetchSubscription();
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [searchParams, refetchSubscription, toast, isRTL]);

  useEffect(() => {
    loadSettings();
     
  }, [hookUser]);

  const loadSettings = () => {
    try {
      setIsLoading(true);
      const currentUser = hookUser;
      if (!currentUser) { setIsLoading(false); return; }
      setUser(currentUser);

      const settings = {
        language: currentUser.language || "english",
        dark_mode: currentUser.dark_mode || false,
        text_density: currentUser.text_density || "medium",
        font_size: currentUser.font_size || "medium",
        notifications_enabled: currentUser.notifications_enabled !== false,
        audio_enabled: currentUser.audio_enabled !== false,
        audio_speed: currentUser.audio_speed || "1",
        default_story_language: currentUser.default_story_language || "english"
      };

      setUserData(settings);
      setTempSettings(settings);
    } catch (error) {
      toast({
        variant: "destructive",
        title: t("settings.errorLoadTitle"),
        description: t("settings.errorLoadDesc"),
      });
    } finally {
      setIsLoading(false);
    }
  };

  const saveSettings = async () => {
    try {
      setIsSaving(true);
      await User.updateMyUserData(tempSettings);
      setUserData(tempSettings);

      if (tempSettings.language !== language) {
        localStorage.setItem("language", tempSettings.language);
        window.location.reload();
      }

      if (tempSettings.dark_mode !== userData.dark_mode) {
        localStorage.setItem("darkMode", tempSettings.dark_mode.toString());
        if (tempSettings.dark_mode) {
          document.documentElement.classList.add("dark");
        } else {
          document.documentElement.classList.remove("dark");
        }
      }

      toast({
        title: t("settings.savedTitle"),
        description: t("settings.savedDesc"),
        className: "bg-green-100 text-green-900 dark:bg-green-900/50 dark:text-green-100",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: t("settings.errorSaveTitle"),
        description: t("settings.errorSaveDesc"),
      });
    } finally {
      setIsSaving(false);
    }
  };

  const updateTempSetting = (key, value) => {
    setTempSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleLogout = async () => {
    await User.logout();
    window.location.href = "/";
  };

  const logoutConfirmTitle = t("settings.logoutConfirmTitle");
  const logoutConfirmDesc = t("settings.logoutConfirmDesc");

  const TAB_CONFIG = [
    { value: "general", icon: <SettingsIcon className="h-4 w-4" />, label: t("settings.tabs.general") },
    { value: "appearance", icon: <Palette className="h-4 w-4" />, label: t("settings.tabs.appearance") },
    { value: "ai", icon: <Sparkles className="h-4 w-4" />, label: t("settings.tabs.ai") },
    { value: "account", icon: <UserIcon className="h-4 w-4" />, label: t("settings.tabs.account") },
    { value: "billing", icon: <CreditCard className="h-4 w-4" />, label: t("settings.tabs.billing") },
    { value: "parental", icon: <Shield className="h-4 w-4" />, label: t("settings.tabs.parental") },
  ];

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]" dir={isRTL ? "rtl" : "ltr"}>
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-purple-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-300">{t("settings.loading")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto pb-12 space-y-6" dir={isRTL ? "rtl" : "ltr"}>
      {/* Gradient header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative rounded-2xl overflow-hidden shadow-lg"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-purple-600 via-indigo-600 to-violet-700" />
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-white via-transparent to-transparent" />
        <Sparkles className="absolute top-4 right-8 h-5 w-5 text-white/20" />
        <div className={`relative flex items-center justify-between gap-4 p-6 ${isRTL ? "flex-row-reverse" : ""}`}>
          <div className={isRTL ? "text-right" : "text-left"}>
            <h1 className={`text-2xl font-bold text-white flex items-center gap-3 ${isRTL ? "flex-row-reverse" : ""}`}>
              <SettingsIcon className="h-6 w-6 text-white/80" />
              {t("settings.title")}
            </h1>
            <p className="text-purple-100 mt-1 text-sm">{t("settings.subtitle")}</p>
          </div>

          <Button
            onClick={saveSettings}
            disabled={isSaving}
            className="relative bg-white text-purple-700 hover:bg-purple-50 shadow-lg rounded-2xl px-5 gap-2 overflow-hidden group flex-shrink-0"
          >
            <span className="absolute inset-0 bg-gradient-to-r from-transparent via-purple-100/50 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
            {isSaving ? (
              <>
                <Loader2 className="relative h-4 w-4 animate-spin" />
                {t("settings.saving")}
              </>
            ) : (
              <>
                <Check className="relative h-4 w-4" />
                {t("settings.save")}
              </>
            )}
          </Button>
        </div>
      </motion.div>

      <Tabs defaultValue="general" className="space-y-5">
        {/* Gradient tab navigation */}
        <motion.div
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.1 }}
        >
          <TabsList className={`bg-purple-50 dark:bg-gray-900 p-1.5 rounded-2xl gap-1 flex flex-wrap h-auto border border-purple-100 dark:border-purple-900 shadow-sm ${isRTL ? "flex-row-reverse" : ""}`}>
            {TAB_CONFIG.map(tab => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className={`rounded-xl flex items-center gap-1.5 px-3 py-2 text-sm transition-all ${isRTL ? "flex-row-reverse" : ""}
                  data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-indigo-600
                  data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-purple-500/20`}
              >
                {tab.icon}
                <span className="hidden sm:inline">{tab.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </motion.div>

        {/* GENERAL TAB */}
        <TabsContent value="general">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="grid md:grid-cols-2 gap-5"
          >
            {/* Language card */}
            <SettingCard
              title={t("settings.general.languageSettings")}
              icon={<Globe className="h-5 w-5 text-blue-500" />}
              isRTL={isRTL}
            >
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label className={`text-xs font-semibold text-gray-500 uppercase tracking-wide ${isRTL ? "text-right block" : ""}`}>{t("settings.language")}</Label>
                  {/* Flag pill selector */}
                  <div className={`flex gap-2 flex-wrap ${isRTL ? "flex-row-reverse" : ""}`}>
                    {LANGUAGE_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => updateTempSetting("language", opt.value)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium border transition-all ${
                          tempSettings.language === opt.value
                            ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white border-transparent shadow-md"
                            : "bg-white dark:bg-gray-800 border-purple-200 dark:border-purple-800 text-gray-600 dark:text-gray-300 hover:border-purple-400"
                        }`}
                      >
                        <span className="text-base">{opt.flag}</span>
                        <span>{t(`common.languageNames.${opt.value}`)}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className={`text-xs font-semibold text-gray-500 uppercase tracking-wide ${isRTL ? "text-right block" : ""}`}>{t("settings.defaultStoryLanguage")}</Label>
                  <div className={`flex gap-2 flex-wrap ${isRTL ? "flex-row-reverse" : ""}`}>
                    {LANGUAGE_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => updateTempSetting("default_story_language", opt.value)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium border transition-all ${
                          tempSettings.default_story_language === opt.value
                            ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white border-transparent shadow-md"
                            : "bg-white dark:bg-gray-800 border-purple-200 dark:border-purple-800 text-gray-600 dark:text-gray-300 hover:border-purple-400"
                        }`}
                      >
                        <span className="text-base">{opt.flag}</span>
                        <span>{t(`common.languageNames.${opt.value}`)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </SettingCard>

            {/* Audio card */}
            <SettingCard
              title={t("settings.audio")}
              icon={<Volume2 className="h-5 w-5 text-green-500" />}
              isRTL={isRTL}
            >
              <div className="space-y-1 pt-2">
                <SettingRow label={t("settings.audioEnabled")} isRTL={isRTL}>
                  <Switch
                    checked={tempSettings.audio_enabled}
                    onCheckedChange={(checked) => updateTempSetting("audio_enabled", checked)}
                    className="data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-purple-600 data-[state=checked]:to-indigo-600"
                  />
                </SettingRow>

                <div className="space-y-2 pt-2">
                  <Label className={`text-xs font-semibold text-gray-500 uppercase tracking-wide ${isRTL ? "text-right block" : ""}`}>{t("settings.audioSpeed")}</Label>
                  <div className={`flex gap-2 flex-wrap ${isRTL ? "flex-row-reverse" : ""}`}>
                    {[
                      { value: "0.75", label: t("settings.audioSpeeds.slow") },
                      { value: "1", label: t("settings.audioSpeeds.normal") },
                      { value: "1.25", label: t("settings.audioSpeeds.fast") },
                      { value: "1.5", label: t("settings.audioSpeeds.veryFast") },
                    ].map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => updateTempSetting("audio_speed", opt.value)}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-sm font-medium border transition-all ${
                          tempSettings.audio_speed === opt.value
                            ? "bg-gradient-to-r from-green-500 to-emerald-600 text-white border-transparent shadow-md"
                            : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-green-400"
                        }`}
                      >
                        <Clock className="h-3 w-3" />
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </SettingCard>

            {/* Notifications card */}
            <SettingCard
              title={t("settings.notifications")}
              icon={<Bell className="h-5 w-5 text-orange-500" />}
              isRTL={isRTL}
            >
              <div className="pt-2">
                <SettingRow label={t("settings.notification.enable")} isRTL={isRTL}>
                  <Switch
                    checked={tempSettings.notifications_enabled}
                    onCheckedChange={(checked) => updateTempSetting("notifications_enabled", checked)}
                    className="data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-orange-500 data-[state=checked]:to-amber-500"
                  />
                </SettingRow>
              </div>
            </SettingCard>
          </motion.div>
        </TabsContent>

        {/* APPEARANCE TAB */}
        <TabsContent value="appearance">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
          >
            <SettingCard
              title={t("settings.appearance.title")}
              icon={<Palette className="h-5 w-5 text-purple-500" />}
              isRTL={isRTL}
            >
              <p className={`text-sm text-gray-500 mb-4 ${isRTL ? "text-right" : "text-left"}`}>{t("settings.appearance.desc")}</p>

              <div className="space-y-5">
                {/* Dark mode — visual sun/moon toggle */}
                <div className={`flex items-center justify-between gap-4 ${isRTL ? "flex-row-reverse" : ""}`}>
                  <div className={`${isRTL ? "text-right" : "text-left"}`}>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{t("settings.darkMode")}</p>
                    <p className="text-xs text-gray-400">{tempSettings.dark_mode ? t("settings.appearance.darkModeOn") : t("settings.appearance.darkModeOff")}</p>
                  </div>
                  <button
                    onClick={() => updateTempSetting("dark_mode", !tempSettings.dark_mode)}
                    className={`relative w-16 h-8 rounded-full transition-all duration-300 flex items-center px-1 ${
                      tempSettings.dark_mode
                        ? "bg-gradient-to-r from-indigo-700 to-violet-800 shadow-inner"
                        : "bg-gradient-to-r from-amber-300 to-yellow-400 shadow-inner"
                    }`}
                  >
                    <span
                      className={`absolute w-6 h-6 rounded-full flex items-center justify-center shadow-md transition-all duration-300 ${
                        tempSettings.dark_mode
                          ? "translate-x-8 bg-gray-900"
                          : "translate-x-0 bg-white"
                      }`}
                    >
                      {tempSettings.dark_mode
                        ? <Moon className="h-3.5 w-3.5 text-indigo-300" />
                        : <Sun className="h-3.5 w-3.5 text-amber-500" />
                      }
                    </span>
                  </button>
                </div>

                {/* Text density — pill selector */}
                <div className="space-y-2">
                  <Label className={`text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5 ${isRTL ? "flex-row-reverse" : ""}`}>
                    <AlignJustify className="h-3.5 w-3.5" />
                    {t("settings.textDensity")}
                  </Label>
                  <div className={`flex gap-2 ${isRTL ? "flex-row-reverse" : ""}`}>
                    {[
                      { value: "low", label: t("settings.appearance.density.low") },
                      { value: "medium", label: t("settings.appearance.density.medium") },
                      { value: "high", label: t("settings.appearance.density.high") },
                    ].map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => updateTempSetting("text_density", opt.value)}
                        className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-all ${
                          tempSettings.text_density === opt.value
                            ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white border-transparent shadow-md"
                            : "bg-white dark:bg-gray-800 border-purple-200 dark:border-purple-800 text-gray-600 dark:text-gray-300 hover:border-purple-400"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Font size — pill selector */}
                <div className="space-y-2">
                  <Label className={`text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5 ${isRTL ? "flex-row-reverse" : ""}`}>
                    <Type className="h-3.5 w-3.5" />
                    {t("settings.fontSize")}
                  </Label>
                  <div className={`flex gap-2 flex-wrap ${isRTL ? "flex-row-reverse" : ""}`}>
                    {[
                      { value: "small", label: t("settings.appearance.fontSize.small") },
                      { value: "medium", label: t("settings.appearance.fontSize.medium") },
                      { value: "large", label: t("settings.appearance.fontSize.large") },
                      { value: "x-large", label: t("settings.appearance.fontSize.xLarge") },
                    ].map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => updateTempSetting("font_size", opt.value)}
                        className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
                          tempSettings.font_size === opt.value
                            ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white border-transparent shadow-md"
                            : "bg-white dark:bg-gray-800 border-purple-200 dark:border-purple-800 text-gray-600 dark:text-gray-300 hover:border-purple-400"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </SettingCard>
          </motion.div>
        </TabsContent>

        {/* AI TAB */}
        <TabsContent value="ai">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
            <AIProvidersPanel isRTL={isRTL} />
            <div className="h-4" />
            <AIStudio
              currentModel={null}
              onModelChange={() => {}}
              userTier={user?.tier || user?.subscription_tier || "free"}
              credits={{ used: user?.credits_used ?? 0, total: user?.credits_total ?? 100 }}
              currentLanguage={language}
            />
          </motion.div>
        </TabsContent>

        {/* ACCOUNT TAB */}
        <TabsContent value="account">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
            <SettingCard
              title={t("settings.account.title")}
              icon={<UserIcon className="h-5 w-5 text-gray-500" />}
              isRTL={isRTL}
            >
              <p className={`text-sm text-gray-500 mb-5 ${isRTL ? "text-right" : "text-left"}`}>{t("settings.account.desc")}</p>

              <div className={`flex items-center gap-4 mb-6 ${isRTL ? "flex-row-reverse" : ""}`}>
                <div className="relative flex-shrink-0">
                  <div className="absolute -inset-1 rounded-full bg-gradient-to-br from-purple-400 via-indigo-400 to-violet-500 opacity-60 blur-sm" />
                  <Avatar className="relative h-16 w-16 border-2 border-white shadow-lg">
                    <AvatarImage src={user?.avatar_url} />
                    <AvatarFallback className="bg-gradient-to-br from-purple-500 to-indigo-600 text-white text-xl font-bold">
                      {user?.full_name?.[0] || 'U'}
                    </AvatarFallback>
                  </Avatar>
                </div>
                <div className="flex-1 space-y-2">
                  <div>
                    <Label htmlFor="fullName" className={`text-xs font-semibold text-gray-500 uppercase tracking-wide ${isRTL ? "text-right block" : ""}`}>{t("settings.account.name")}</Label>
                    <Input id="fullName" value={user?.full_name || ''} readOnly className={`mt-1 rounded-xl border-purple-100 dark:border-purple-900 bg-purple-50/50 dark:bg-purple-900/10 ${isRTL ? "text-right" : "text-left"}`} />
                  </div>
                  <div>
                    <Label htmlFor="email" className={`text-xs font-semibold text-gray-500 uppercase tracking-wide ${isRTL ? "text-right block" : ""}`}>{t("settings.account.email")}</Label>
                    <Input id="email" value={user?.email || ''} readOnly className={`mt-1 rounded-xl border-purple-100 dark:border-purple-900 bg-purple-50/50 dark:bg-purple-900/10 ${isRTL ? "text-right" : "text-left"}`} />
                  </div>
                </div>
              </div>

              <div className={`flex ${isRTL ? "flex-row-reverse" : ""} justify-between items-center pt-4 border-t border-purple-50 dark:border-purple-900/30`}>
                <Button variant="outline" disabled className="rounded-xl border-purple-200 dark:border-purple-800 text-gray-400 gap-2">
                  <CreditCard className="h-4 w-4" />
                  {t("settings.account.manageSub")}
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" className="rounded-xl gap-2">
                      <LogOut className="h-4 w-4" />
                      {t("settings.account.logout")}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent dir={isRTL ? "rtl" : "ltr"}>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{logoutConfirmTitle}</AlertDialogTitle>
                      <AlertDialogDescription>{logoutConfirmDesc}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className={isRTL ? "flex-row-reverse" : ""}>
                      <AlertDialogCancel>{t("settings.logoutCancel")}</AlertDialogCancel>
                      <AlertDialogAction onClick={handleLogout} className="bg-red-600 hover:bg-red-700 text-white">
                        {t("settings.logoutConfirmBtn")}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </SettingCard>
          </motion.div>
        </TabsContent>

        {/* BILLING TAB */}
        <TabsContent value="billing">
          <BillingTab
            currentPlan={currentPlan}
            userEmail={hookUser?.email || user?.email}
            isRTL={isRTL}
            toast={toast}
          />
        </TabsContent>

        {/* PARENTAL TAB */}
        <TabsContent value="parental">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
            <ParentalControls currentLanguage={language} isRTL={isRTL} />
          </motion.div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
