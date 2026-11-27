import { Link } from 'react-router-dom';
import { useI18n } from '@/components/i18n/i18nProvider';
import { isNewShell } from '@/lib/flags';

export default function HeroSection() {
  const { t, isRTL } = useI18n();

  return (
    <section
      dir={isRTL ? 'rtl' : 'ltr'}
      className="relative overflow-hidden border-b border-[#edc89c]/15 bg-[#1d2b38] text-[#fff8eb]"
    >
      <div className="mx-auto grid max-w-7xl items-center gap-8 px-5 pb-14 pt-28 sm:px-8 sm:pb-20 sm:pt-36 lg:grid-cols-2 lg:gap-12">
        <div className="max-w-2xl">
          <p className="inline-flex items-center rounded-full border border-[#edc89c]/30 bg-[#edc89c]/10 px-3.5 py-1 text-xs font-bold tracking-widest text-[#f5d4a5] sm:text-sm">
            {t('spxLibrary.heroEyebrow')}
          </p>
          <h1 className="mt-4 font-serif text-3xl font-bold leading-tight tracking-tight text-[#fff8eb] sm:text-5xl lg:text-6xl">
            {t('spxLibrary.heroTitle')}
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-[#e9e0d2] sm:mt-6 sm:text-lg">
            {t('spxLibrary.heroBody')}
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
            <a
              href="#showcase"
              className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#f5d4a5] px-7 py-3 text-base font-bold text-[#1d2b38] shadow-lg shadow-black/20 hover:bg-[#fae0ba] focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-white motion-safe:transition-colors motion-safe:duration-200"
            >
              {t('spxLibrary.heroRead')}
            </a>
            <Link
              to={isNewShell() ? '/new' : '/BookWizard'}
              className="inline-flex min-h-12 items-center justify-center rounded-full border-2 border-[#edc89c]/50 bg-[#263747]/70 px-7 py-3 text-base font-semibold text-[#fff8eb] hover:border-[#f5d4a5] hover:bg-[#2c3f52] focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-white motion-safe:transition-colors motion-safe:duration-200"
            >
              {t('spxLibrary.heroCreate')}
            </Link>
          </div>
        </div>
        <div className="relative mx-auto w-full max-w-xl lg:max-w-none">
          <div className="rounded-[2rem] border border-[#edc89c]/30 bg-[#263747]/60 p-2.5 shadow-2xl shadow-black/40 sm:p-3.5">
            <img
              src="/images/spx/hearth.webp"
              alt=""
              loading="eager"
              decoding="async"
              className="aspect-[4/3] w-full rounded-[1.5rem] object-cover ring-1 ring-[#fff8eb]/15"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
