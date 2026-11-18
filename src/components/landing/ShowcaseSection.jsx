import { Link } from 'react-router-dom';
import { useI18n } from '@/components/i18n/i18nProvider';
import demoBooks from '@/data/demoBooks';

export default function ShowcaseSection() {
  const { language, isRTL, t } = useI18n();
  const en = language === 'english' || language === 'en';
  return <section id="showcase" dir={isRTL ? 'rtl' : 'ltr'} className="bg-[#f8f1e3] px-5 py-20 text-[#202b3c] sm:py-28"><div className="mx-auto max-w-6xl"><p className="text-sm font-bold tracking-widest text-[#8a6244]">{t('spxLibrary.shelfEyebrow')}</p><h2 className="mt-3 text-3xl font-bold sm:text-5xl">{t('spxLibrary.shelfTitle')}</h2><p className="mt-4 max-w-2xl text-lg leading-relaxed">{t('spxLibrary.shelfBody')}</p><div className="mt-10 grid gap-6 sm:grid-cols-3">{demoBooks.map(book => <Link key={book.id} to={`/samples/${book.id}`} className="group block overflow-hidden rounded-2xl bg-white shadow-md transition-shadow hover:shadow-xl focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-[#a57043]"><div className="aspect-[4/5] overflow-hidden bg-[#e7dfd0]"><img src={book.cover_image} alt="" loading="lazy" className="h-full w-full object-cover motion-safe:transition-transform motion-safe:duration-200 motion-safe:group-hover:scale-[1.03] motion-safe:group-focus-visible:scale-[1.03]" /></div><div className="p-5"><h3 className="text-xl font-bold">{en ? book.title.en : book.title.he}</h3><span className="mt-3 inline-block min-h-11 content-center font-semibold underline underline-offset-4">{t('spxLibrary.shelfRead')}</span></div></Link>)}</div></div></section>;
}
