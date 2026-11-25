import { useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useI18n } from '@/components/i18n/i18nProvider';
import { useShelf } from './useShelf';
import EmptyState from '@/components/library/EmptyState';
import ShelfGrid from './ShelfGrid';
import BookSheet from './BookSheet';
const chip = 'min-h-11 rounded-sp-pill border px-4 font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-sp-violet-600 motion-safe:active:scale-[0.98]';
// The legacy key has no owner, so it cannot safely be attributed to any family.
function recentIds(ownerId) { try { const value = ownerId && JSON.parse(localStorage.getItem(`sipurai-shelf-recent:${ownerId}`) || '[]'); return Array.isArray(value) ? value.filter(id => typeof id === 'string').slice(0, 30) : []; } catch { return []; } }
export default function Shelf() {
  const { user } = useCurrentUser();
  return <FamilyShelf key={user?.id ?? ''} ownerId={user?.id} />;
}

function FamilyShelf({ ownerId }) {
  const { t } = useI18n();
  const { books, loading, error, offline, retry } = useShelf();
  const [params, setParams] = useSearchParams();
  const [selectedId, setSelectedId] = useState(null);
  const selectedTrigger = useRef(null);
  const selected = books.find(book => book.id === selectedId);
  const [recent, setRecent] = useState(() => recentIds(ownerId));
  const filter = params.get('filter') || 'all';
  const heroes = [...new Set(books.map(book => book.child_name).filter(Boolean))].sort();
  const filtered = books.filter(book => filter === 'all' || (filter === 'recent' ? recent.includes(book.id) : book.child_name === heroes[Number(filter.replace('hero-', ''))] && filter.startsWith('hero-'))).sort((a, b) => (b.created_date || '').localeCompare(a.created_date || ''));
  const setFilter = value => { const next = new URLSearchParams(params); if (value === 'all') next.delete('filter'); else next.set('filter', value); setParams(next); };
  const saveRead = () => { if (!ownerId || !selected) return; const next = [selected.id, ...recent.filter(id => id !== selected.id)].slice(0, 30); setRecent(next); try { localStorage.setItem(`sipurai-shelf-recent:${ownerId}`, JSON.stringify(next)); } catch { /* reading still works */ } };
  return <main className="sp-shell mx-auto max-w-6xl px-4 py-8 text-sp-ink-900 sm:px-8">
    <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 className="font-sp-display text-sp-3xl font-semibold">{t('shelf.title')}</h1>
        <p className="mt-1 text-sp-ink-600">{t('shelf.subtitle')}</p>
      </div>
      {(loading || error || offline || books.length > 0) && (
        <Link to="/new" className="inline-flex min-h-11 items-center gap-2 rounded-sp-sm bg-sp-violet-700 px-4 font-semibold text-white hover:bg-purple-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sp-violet-700 motion-safe:transition-colors">
          <Plus aria-hidden="true" className="h-5 w-5" />{t('shelf.newStory')}
        </Link>
      )}
    </header>
    {offline || error ? (
      <EmptyState title={offline ? t('shelf.offlineTitle') : t('shelf.errorTitle')}
        description={offline ? t('shelf.offline') : t('shelf.error')} status={offline ? 'status' : 'alert'}
        actionLabel={t('shelf.retry')} onAction={retry} />
    ) : loading ? (
      <EmptyState title={t('shelf.loading')} status="status" />
    ) : books.length === 0 ? (
      <EmptyState title={t('shelf.emptyTitle')} description={t('shelf.empty')} actionLabel={t('shelf.first')} actionLink="/new" />
    ) : (
      <>
        <nav aria-label={t('shelf.filters')} className="mb-6 flex gap-2 overflow-x-auto pb-2">
          {[['all', t('shelf.all')], ...heroes.map((hero, index) => [`hero-${index}`, hero]), ...(recent.length ? [['recent', t('shelf.recent')]] : [])].map(([value, label]) => (
            <button key={value} type="button" onClick={() => setFilter(value)} aria-pressed={filter === value}
              className={`${chip} shrink-0 ${value === 'recent' ? 'ms-4' : ''} ${filter === value ? 'border-sp-violet-600 bg-sp-violet-100 text-sp-violet-700' : 'border-sp-line bg-sp-card hover:bg-sp-violet-50'}`}>
              {label}
            </button>
          ))}
        </nav>
        {filtered.length ? <ShelfGrid books={filtered} onSelect={(book, trigger) => { selectedTrigger.current = trigger; setSelectedId(book.id); }} /> : (
          <EmptyState title={t('shelf.noMatchesTitle')} description={t('shelf.noMatches')} status="status"
            actionLabel={t('shelf.clearFilters')} onAction={() => setFilter('all')} />
        )}
      </>
    )}
    <BookSheet book={selected} open={!!selected} onOpenChange={open => { if (!open) setSelectedId(null); }} onRead={saveRead} onChanged={retry} onCloseAutoFocus={event => {
      if (selectedTrigger.current?.isConnected) {
        event.preventDefault();
        selectedTrigger.current.focus();
      }
    }} />
  </main>;
}
