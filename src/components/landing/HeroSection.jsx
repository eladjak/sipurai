import { Link } from 'react-router-dom';
import { useI18n } from '@/components/i18n/i18nProvider';
import { isNewShell } from '@/lib/flags';

export default function HeroSection() {
  const { t, isRTL } = useI18n();
  return <section dir={isRTL ? 'rtl' : 'ltr'} className="bg-[#202f3d] text-[#fff8eb]"><div className="mx-auto grid max-w-7xl items-center gap-8 px-5 pb-12 pt-28 sm:px-8 sm:pb-20 sm:pt-36 lg:grid-cols-2"><div className="max-w-2xl"><p className="text-sm font-bold tracking-widest text-[#edc89c]">{t('spxLibrary.heroEyebrow')}</p><h1 className="mt-4 text-4xl font-bold leading-tight sm:text-6xl">{t('spxLibrary.heroTitle')}</h1><p className="mt-6 max-w-xl text-lg leading-relaxed text-[#e9e0d2]">{t('spxLibrary.heroBody')}</p><div className="mt-8 flex flex-wrap gap-3"><a href="#showcase" className="inline-flex min-h-12 items-center rounded-full bg-[#f5d4a5] px-6 font-bold text-[#23313b] focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-white">{t('spxLibrary.heroRead')}</a><Link to={isNewShell() ? '/new' : '/BookWizard'} className="inline-flex min-h-12 items-center rounded-full border border-[#d3c7b6] px-6 font-semibold focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-white">{t('spxLibrary.heroCreate')}</Link></div></div><img src="/images/spx/hearth.webp" alt="" className="aspect-[4/3] w-full rounded-[2rem] object-cover shadow-2xl" /></div></section>;
}
