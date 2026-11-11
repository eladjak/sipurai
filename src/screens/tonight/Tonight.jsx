import React from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, BookOpen, Plus, RotateCw, Star } from 'lucide-react';
import { useI18n } from '@/components/i18n/i18nProvider';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import InstallPrompt from '@/components/shared/InstallPrompt';
import { useTonight } from './useTonight';
import ContinueCard from './ContinueCard';
const action = 'inline-flex min-h-11 items-center gap-2 rounded-sp-sm px-4 py-2 font-semibold hover:bg-sp-violet-100 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sp-violet-600';
export default function Tonight() {
  const { t } = useI18n();
  const { user } = useCurrentUser();
  const { books, readable, page, loading, error, offline, retry } = useTonight();
  return <main className="mx-auto max-w-5xl px-4 py-8 text-sp-ink-900 sm:px-8"><header className="mb-7"><p className="text-sp-ink-600">{t('tonight.subtitle')}</p><h1 className="mt-1 font-sp-display text-sp-3xl font-semibold">{t('tonight.title')}</h1></header>
    {offline || error ? <section role={offline ? 'status' : 'alert'} className="rounded-sp-lg border border-sp-line bg-sp-card p-8"><AlertCircle aria-hidden="true" className="mb-4 h-8 w-8 text-sp-violet-700" /><p>{t(offline ? 'tonight.offline' : 'tonight.error')}</p><button onClick={retry} className={`${action} mt-4 bg-sp-violet-50 text-sp-violet-700`}><RotateCw aria-hidden="true" className="h-5 w-5" />{t('tonight.retry')}</button></section> : loading ? <div role="status" aria-label={t('tonight.loading')} className="grid gap-4"><div className="h-56 rounded-sp-lg bg-sp-violet-100" /><div className="h-32 rounded-sp-lg bg-sp-violet-50" /></div> : !books.length ? <section className="rounded-sp-lg border border-sp-line bg-sp-card p-8"><BookOpen aria-hidden="true" className="mb-5 h-12 w-12 text-sp-violet-700" /><h2 className="font-sp-display text-sp-2xl font-semibold">{t('tonight.firstTitle')}</h2><p className="mt-2 text-sp-ink-600">{t('tonight.firstBody')}</p><Link to="/new" className={`${action} mt-5 bg-sp-violet-600 text-white hover:bg-sp-violet-700`}><Plus aria-hidden="true" className="h-5 w-5" />{t('tonight.firstAction')}</Link></section> : <>
      {!readable.length && <section className="rounded-sp-lg border border-sp-line bg-sp-card p-8"><BookOpen aria-hidden="true" className="mb-4 h-10 w-10 text-sp-violet-700" /><p>{t('tonight.noReadable')}</p><Link to="/shelf" className={`${action} mt-4 bg-sp-violet-50 text-sp-violet-700`}>{t('tonight.openShelf')}</Link></section>}
      {readable[0] && <ContinueCard book={readable[0]} page={page} />}
      {readable.length > 1 && <section className="mt-8"><h2 className="font-sp-display text-sp-xl font-semibold">{t('tonight.favourites')}</h2><div className="mt-4 flex flex-wrap gap-4">{readable.slice(1, 3).map(book => <Link key={book.id} to={`/BookView?id=${encodeURIComponent(book.id)}`} className="w-28 rounded-sp-sm text-start focus-visible:outline focus-visible:outline-2 focus-visible:outline-sp-violet-600 motion-safe:transition-transform motion-safe:duration-200 hover:-translate-y-1 active:scale-[0.98]"><div className="flex h-36 items-center justify-center overflow-hidden rounded-sp-sm bg-sp-violet-100">{book.cover_image ? <img src={book.cover_image} alt="" className="h-full w-full object-cover" /> : <BookOpen aria-hidden="true" className="h-10 w-10 text-sp-violet-700" />}</div><span className="mt-2 block break-words font-medium">{book.title || t('tonight.untitled')}</span></Link>)}</div></section>}
      <Link to="/new" className={`${action} mt-8 border border-sp-line text-sp-violet-700`}><Plus aria-hidden="true" className="h-5 w-5" />{t('tonight.newStory')}</Link>
      {typeof user?.xp === 'number' && <div className="mt-8 flex items-center gap-2 text-sp-ink-600"><Star aria-hidden="true" className="h-5 w-5 text-sp-violet-700" /><span>{t('tonight.points', { count: user.xp })}</span><span className="text-sp-sm">{t('tonight.pointsHelp')}</span></div>}
    </>}
    <InstallPrompt />
  </main>;
}
