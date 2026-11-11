import React from 'react';
import { BookOpen } from 'lucide-react';
import { useI18n } from '@/components/i18n/i18nProvider';
export default function ShelfGrid({ books, onSelect }) {
  const { t } = useI18n();
  return <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">{books.map(book => <button key={book.id} type="button" onClick={() => onSelect(book)} className="min-w-0 rounded-sp-sm text-start focus-visible:outline focus-visible:outline-2 focus-visible:outline-sp-violet-600 motion-safe:transition-transform motion-safe:duration-200 hover:-translate-y-1 active:scale-[0.98]">
    <div className="relative aspect-[3/4] overflow-hidden rounded-s-sp-md rounded-e-sp-sm bg-sp-violet-100 shadow-sp-1">{book.cover_image ? <img src={book.cover_image} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center"><BookOpen aria-hidden="true" className="h-12 w-12 text-sp-violet-700" /></div>}{book.status !== 'complete' && <span className="absolute bottom-2 start-2 rounded-sp-pill bg-sp-card px-3 py-1 text-sp-xs font-medium text-sp-ink-900">{t(`shelf.${book.status}`)}</span>}</div>
    <span className="mt-2 block break-words font-sp-display text-sp-base font-semibold">{book.title || t('shelf.untitled')}</span>{book.child_name && <span className="block text-sp-sm text-sp-ink-600">{book.child_name}</span>}
  </button>)}</div>;
}
