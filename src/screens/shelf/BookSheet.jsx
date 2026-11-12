import React from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Pencil, Printer } from 'lucide-react';
import { Sheet } from '@/components/ds/Sheet';
import { useI18n } from '@/components/i18n/i18nProvider';
import BookControls from '@/components/bookControls/BookControls';

export default function BookSheet({ book, open, onOpenChange, onRead, onChanged }) {
  const { t } = useI18n();
  if (!book) return null;
  const ready = book.status === 'complete';
  const readable = ready || book.status === 'partial';
  const statuses = { generating: t('shelf.generating'), failed: t('shelf.failed'), partial: t('shelf.partial'), draft: t('shelf.draft') };
  const actions = [
    readable && { label: t('shelf.read'), to: `/BookView?id=${encodeURIComponent(book.id)}`, icon: BookOpen, onClick: onRead },
    book.status !== 'generating' && { label: t('shelf.edit'), to: `/BookCreation?id=${encodeURIComponent(book.id)}`, icon: Pencil },
    ready && import.meta.env.VITE_PRINT_ORDER_ENABLED === 'true' && { label: t('shelf.print'), to: `/book/${encodeURIComponent(book.id)}/order`, icon: Printer },
  ].filter(Boolean);
  const title = <span className="flex items-center gap-4">
    {book.cover_image ? <img src={book.cover_image} alt="" className="h-24 w-16 shrink-0 rounded-sp-sm object-cover" /> : <span className="flex h-24 w-16 shrink-0 items-center justify-center rounded-sp-sm bg-sp-violet-100"><BookOpen aria-hidden="true" /></span>}
    <span className="min-w-0 break-words">
      <span className="block">{book.title || t('shelf.untitled')}</span>
      {book.child_name && <span className="mt-1 block font-sp-body text-sp-sm font-normal text-sp-ink-600">{book.child_name}</span>}
      {book.status !== 'complete' && <span className="mt-1 block font-sp-body text-sp-sm font-normal text-sp-ink-600">{Object.hasOwn(statuses, book.status) ? statuses[book.status] : t('shelf.inProgress')}</span>}
    </span>
  </span>;
  return <Sheet open={open} onOpenChange={onOpenChange} title={title} description={t('shelf.chooseAction')}>
    {(book.status === 'partial' || book.status === 'failed') && <p className="mb-4 text-sp-sm text-sp-ink-600">{t('shelf.stoppedHint')}</p>}
    <div className="grid gap-2">{actions.map(({ label, to, icon: Icon, onClick }) => <Link key={to} to={to} onClick={onClick} className="flex min-h-12 items-center gap-3 rounded-sp-sm border border-sp-line bg-sp-card px-4 font-medium text-sp-ink-900 hover:bg-sp-violet-50 active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-sp-violet-600"><Icon aria-hidden="true" className="h-5 w-5" />{label}</Link>)}</div>
    {onChanged && book.status !== 'generating' && <BookControls book={book} className="mt-6 border-t border-sp-line pt-6" onChanged={kind => { onOpenChange(false); onChanged(kind); }} />}
  </Sheet>;
}
