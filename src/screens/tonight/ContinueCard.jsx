import React from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, ArrowLeft, Moon, Star } from 'lucide-react';
import { useI18n } from '@/components/i18n/i18nProvider';
export default function ContinueCard({ book, page }) {
  const { t } = useI18n();
  return <section aria-labelledby="tonight-card-title" className="relative overflow-hidden rounded-sp-lg bg-sp-night-800 p-6 text-sp-on-night shadow-sp-2 sm:p-8">
    <Moon aria-hidden="true" className="pointer-events-none absolute end-6 top-6 h-12 w-12 text-sp-gold-300 opacity-40" />
    <Star aria-hidden="true" className="pointer-events-none absolute end-20 top-5 h-3 w-3 text-sp-gold-300 opacity-60" />
    <Star aria-hidden="true" className="pointer-events-none absolute end-8 top-24 h-3 w-3 text-sp-gold-300 opacity-40" />
    <p id="tonight-card-title" className="relative flex items-center gap-2 text-sp-sm font-semibold text-sp-gold-300"><Star aria-hidden="true" className="h-4 w-4" />{t('tonight.cardTitle')}</p>
    <div className="relative mt-5 flex items-center gap-5 sm:gap-8">
      <div className="flex h-40 w-28 shrink-0 items-center justify-center overflow-hidden rounded-s-sp-md rounded-e-sp-sm bg-sp-night-700 sm:h-52 sm:w-36">{book.cover_image ? <img src={book.cover_image} alt="" className="h-full w-full object-cover" /> : <BookOpen aria-hidden="true" className="h-12 w-12" />}</div>
      <div className="min-w-0"><h2 className="break-words font-sp-display text-sp-2xl font-semibold">{book.title || t('tonight.untitled')}</h2>{page && <p className="mt-2 text-sp-on-night-muted">{t('tonight.progress', { page })}</p>}</div>
    </div>
    <Link to={`/BookView?id=${encodeURIComponent(book.id)}`} className="relative mt-6 flex min-h-11 w-full items-center justify-center gap-2 rounded-sp-sm bg-sp-gold-400 px-4 py-3 font-semibold text-sp-night-900 hover:bg-sp-gold-300 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sp-gold-400">{page ? t('tonight.continueReading') : t('tonight.readAgain')}<ArrowLeft aria-hidden="true" className="h-5 w-5 rtl:rotate-0 ltr:rotate-180" /></Link>
    <Link to="/new" className="relative mt-2 flex min-h-11 items-center justify-center rounded-sp-sm px-4 py-2 text-sp-on-night hover:underline active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sp-gold-400">{t('tonight.quietNew')}</Link>
  </section>;
}
