import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { BookOpen, Plus, RotateCw, AlertCircle } from 'lucide-react';
import { useI18n } from '@/components/i18n/i18nProvider';
import { useShelf } from './useShelf';
import ShelfGrid from './ShelfGrid';
import BookSheet from './BookSheet';
const chip = 'min-h-11 rounded-sp-pill border px-4 font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-sp-violet-600 active:scale-[0.98]';
function recentIds() { try { return JSON.parse(localStorage.getItem('sipurai-shelf-recent') || '[]'); } catch { return []; } }
export default function Shelf() {
  const { t } = useI18n();
  const { books, loading, error, offline, retry } = useShelf();
  const [params, setParams] = useSearchParams();
  const [selected, setSelected] = useState(null);
  const [recent, setRecent] = useState(recentIds);
  const filter = params.get('filter') || 'all';
  const heroes = [...new Set(books.map(book => book.child_name).filter(Boolean))].sort();
  const filtered = books.filter(book => filter === 'all' || (filter === 'recent' ? recent.includes(book.id) : book.child_name === heroes[Number(filter.replace('hero-', ''))] && filter.startsWith('hero-'))).sort((a, b) => (b.created_date || '').localeCompare(a.created_date || ''));
  const setFilter = value => { const next = new URLSearchParams(params); if (value === 'all') next.delete('filter'); else next.set('filter', value); setParams(next); };
  const saveRead = () => { const next = [selected.id, ...recent.filter(id => id !== selected.id)].slice(0, 30); setRecent(next); try { localStorage.setItem('sipurai-shelf-recent', JSON.stringify(next)); } catch { /* reading still works */ } };
  return <main className="mx-auto max-w-6xl px-4 py-8 text-sp-ink-900 sm:px-8">
    <header className="mb-8 flex flex-wrap items-center justify-between gap-4"><div><h1 className="font-sp-display text-sp-3xl font-semibold">{t('shelf.title')}</h1><p className="mt-1 text-sp-ink-600">{t('shelf.subtitle')}</p></div>{(loading || error || offline || books.length > 0) && <Link to="/new" className="inline-flex min-h-11 items-center gap-2 rounded-sp-sm bg-sp-violet-600 px-4 font-semibold text-white hover:bg-sp-violet-700 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sp-violet-600"><Plus aria-hidden="true" className="h-5 w-5" />{t('shelf.newStory')}</Link>}</header>
    {offline || error ? <div role={offline ? 'status' : 'alert'} className="rounded-sp-lg border border-sp-line bg-sp-card p-8 text-center"><AlertCircle aria-hidden="true" className="mx-auto mb-4 h-12 w-12 text-sp-violet-700" /><p>{offline ? t('shelf.offline') : t('shelf.error')}</p><button onClick={retry} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-sp-sm bg-sp-violet-600 px-4 font-semibold text-white hover:bg-sp-violet-700 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sp-violet-600"><RotateCw aria-hidden="true" className="h-5 w-5" />{t('shelf.retry')}</button></div> : loading ? <div role="status" aria-label={t('shelf.loading')} className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">{[0,1,2,3].map(n => <div key={n} className="aspect-[3/4] rounded-sp-md bg-sp-violet-100" />)}</div> : books.length === 0 ? <div className="rounded-sp-lg border border-sp-line bg-sp-card p-8 text-center"><BookOpen aria-hidden="true" className="mx-auto mb-4 h-20 w-20 rounded-sp-lg bg-sp-violet-50 p-4 text-sp-violet-700" /><p>{t('shelf.empty')}</p><Link to="/new" className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-sp-sm bg-sp-violet-600 px-4 font-semibold text-white hover:bg-sp-violet-700 active:scale-[0.98] focus-visible:outline focus-visible:outline-2"><Plus aria-hidden="true" className="h-5 w-5" />{t('shelf.first')}</Link></div> : <><nav aria-label={t('shelf.filters')} className="mb-6 flex gap-2 overflow-x-auto pb-2">{[['all', t('shelf.all')], ...heroes.map((hero, index) => [`hero-${index}`, hero]), ...(recent.length ? [['recent', t('shelf.recent')]] : [])].map(([value, label]) => <button key={value} onClick={() => setFilter(value)} aria-pressed={filter === value} className={`${chip} shrink-0 ${value === 'recent' ? 'ms-4' : ''} ${filter === value ? 'border-sp-violet-600 bg-sp-violet-100 text-sp-violet-700' : 'border-sp-line bg-sp-card hover:bg-sp-violet-50'}`}>{label}</button>)}</nav>{filtered.length ? <ShelfGrid books={filtered} onSelect={setSelected} /> : <p>{t('shelf.noMatches')}</p>}</>}
    <BookSheet book={selected} open={!!selected} onOpenChange={open => { if (!open) setSelected(null); }} onRead={saveRead} />
  </main>;
}
