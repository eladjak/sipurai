import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CreditCard, Globe, HelpCircle, Package, ShieldCheck } from 'lucide-react';
import { useI18n } from '@/components/i18n/i18nProvider';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import useSubscription from '@/hooks/useSubscription';
import { User } from '@/entities/User';
import { PLANS } from '@/lib/creem';
import { CURRENT_POLICY_VERSION, fetchConsentStatus } from '@/lib/privacyConsent';
import AccountDataControls from '@/components/settings/AccountDataControls';

const card = 'rounded-sp-lg border border-sp-line bg-sp-card p-5 shadow-sp-1 sm:p-6';
const action = 'inline-flex min-h-12 items-center gap-2 rounded-sp-sm px-3 text-sp-violet-700 underline hover:bg-sp-violet-50 active:scale-[.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-sp-violet-700';
function Section({ icon: Icon, title, children }) { return <section className={card}><h2 className="flex items-center gap-3 font-sp-display text-sp-xl font-semibold"><Icon size={21} aria-hidden="true" className="text-sp-violet-700" />{title}</h2><div className="mt-3 space-y-3 text-sp-ink-600">{children}</div></section>; }
export default function ParentsHub({ printEnabled = import.meta.env.VITE_PRINT_ORDER_ENABLED === 'true' }) {
  const { t, language, isRTL, changeLanguage, languages } = useI18n();
  const { user } = useCurrentUser();
  const { plan, isLoading } = useSubscription();
  const consent = useQuery({ queryKey: ['privacy-consent', user?.id, CURRENT_POLICY_VERSION], queryFn: () => fetchConsentStatus(), enabled: !!user?.id, staleTime: Infinity, retry: false });
  const [dark, setDark] = useState(() => user?.dark_mode ?? (localStorage.getItem('darkMode') === 'true'));
  const [themeError, setThemeError] = useState(false);
  const [saving, setSaving] = useState(false);
  async function changeTheme(value) {
    setSaving(true); setThemeError(false);
    try { await User.updateMyUserData({ dark_mode: value }); localStorage.setItem('darkMode', String(value)); document.documentElement.classList.toggle('dark', value); setDark(value); }
    catch { setThemeError(true); } finally { setSaving(false); }
  }
  const lang = language === 'english' ? 'en' : 'he';
  return <main dir={isRTL ? 'rtl' : 'ltr'} className="mx-auto max-w-4xl space-y-5 px-4 py-8 text-start text-sp-ink-900 sm:px-6 sm:py-12">
    <header className="space-y-2"><p className="text-sp-sm font-semibold text-sp-violet-700">{t('parents.eyebrow')}</p><h1 className="font-sp-display text-sp-3xl font-semibold">{t('parents.title')}</h1><p className="max-w-2xl leading-relaxed text-sp-ink-600">{t('parents.intro')}</p></header>
    <div className="grid gap-4 md:grid-cols-2">
      <Section icon={CreditCard} title={t('parents.plan')}><p>{isLoading ? t('parents.loading') : (PLANS[plan]?.name[lang] || t('parents.planUnknown'))}</p><p>{t('parents.giftDetail')}</p><Link className={action} to="/pricing">{t('parents.plansLink')}</Link></Section>
      {printEnabled && <Section icon={Package} title={t('parents.ordersTitle')}><p>{t('parents.ordersDetail')}</p><Link className={action} to="/orders">{t('parents.orders')}</Link></Section>}
      <Section icon={Globe} title={t('parents.look')}><p>{t('parents.lookDetail')}</p><label className="block font-medium text-sp-ink-900" htmlFor="parents-language">{t('parents.language')}</label><select id="parents-language" className="min-h-12 w-full rounded-sp-sm border border-sp-line bg-sp-card px-3 text-sp-ink-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sp-violet-700" value={language} onChange={e => changeLanguage(e.target.value)}>{Object.keys(languages).map(code => <option key={code} value={code}>{languages[code].name}</option>)}</select><button type="button" disabled={saving} onClick={() => changeTheme(!dark)} aria-pressed={dark} className={action}>{dark ? t('parents.useLight') : t('parents.useDark')}</button>{themeError && <p role="alert">{t('parents.saveError')}</p>}</Section>
      <Section icon={ShieldCheck} title={t('parents.privacy')}><p>{consent.isPending ? t('parents.consentLoading') : consent.isError ? t('parents.consentUnknown') : consent.data?.hasConsent ? t('parents.consentAccepted') : t('parents.consentUnknown')}</p><Link className={action} to="/privacy">{t('parents.privacyLink')}</Link><AccountDataControls language={language} isRTL={isRTL} onDeleted={() => window.location.assign('/')} /></Section>
      <Section icon={HelpCircle} title={t('parents.help')}><p>{t('parents.helpDetail')}</p><Link className={action} to="/help">{t('parents.helpLink')}</Link></Section>
    </div>
  </main>;
}
