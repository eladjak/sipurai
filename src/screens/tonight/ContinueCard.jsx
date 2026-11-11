import React from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, ArrowLeft } from 'lucide-react';
import { useI18n } from '@/components/i18n/i18nProvider';
export default function ContinueCard({ book, page }) {
  const { t } = useI18n();
  return <section className="rounded-sp-lg bg-sp-night-800 p-6 text-sp-on-night shadow-sp-2 sm:p-8"><div className="flex items-center gap-5 sm:gap-8">
    <div className="h-40 w-28 shrink-0 overflow-hidden rounded-s-sp-md rounded-e-sp-sm bg-sp-night-700 sm:h-52 sm:w-36">{book.cover_image ? <img src={book.cover_image} alt="" className="h-full w-full object-cover" /> : <BookOpen aria-hidden="true" className="m-auto mt-12 h-12 w-12" />}</div>
    <div className="min-w-0"><p className="text-sp-sm text-sp-on-night-muted">{t('tonight.subtitle')}</p><h2 className="mt-2 break-words font-sp-display text-sp-2xl font-semibold">{book.title || t('tonight.untitled')}</h2>
    <Link to={`/BookView?id=${encodeURIComponent(book.id)}`} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-sp-sm bg-sp-gold-400 px-4 py-2 font-semibold text-sp-night-900 hover:bg-sp-gold-300 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sp-gold-400">{page ? t('tonight.continue', { page }) : t('tonight.readAgain')}<ArrowLeft aria-hidden="true" className="h-5 w-5 rtl:rotate-0 ltr:rotate-180" /></Link></div>
  </div></section>;
}
