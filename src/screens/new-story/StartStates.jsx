import Theatre from './Theatre';
import { Link } from 'react-router-dom';
import { printEditionUrl } from '@/lib/printEdition/model';
import { editionLabels } from '@/screens/print-edition/labels';
import GenerationWaiting from '@/components/bookReader/GenerationWaiting';
import { BookOpen, RefreshCw } from 'lucide-react';

function stageMessage(stage, t) {
  switch (stage) {
    case 'outline': return t('spxWizard.waiting.outline');
    case 'editing': return t('spxWizard.waiting.editing');
    case 'pages': return t('spxWizard.waiting.pages');
    case 'writing': return t('spxWizard.waiting.writing');
    case 'storyWritten': return t('spxWizard.waiting.storyWritten');
    case 'drawing': return t('spxWizard.waiting.drawing');
    default: return t('newStory.queued');
  }
}

export default function StartStates({ state, t, retry, bookId, quotaError, isRTL, waiting = null }) {
  const active = state === 'queued' || state === 'slow';
  const shelfLink = <Link to="/shelf" className="inline-flex min-h-12 items-center text-sp-violet-700 underline">{t('newStory.shelf')}</Link>;

  return <>
    {active ? (
      <div>
        <GenerationWaiting
          t={t}
          title={state === 'slow' ? t('newStory.slow') : ''}
          message={state === 'slow' && !waiting?.stage ? t('newStory.slowDetail') : stageMessage(waiting?.stage, t)}
          counts={waiting?.counts}
        />
        <div className="mt-3 text-sp-ink-600">
          {state === 'queued' && <p>{t('newStory.queuedDetail')}</p>}
          {state === 'slow' && waiting?.stage && <p>{t('newStory.slowDetail')}</p>}
          {state === 'slow' && shelfLink}
        </div>
      </div>
    ) : (
      <section role="status" className="rounded-sp-lg border border-sp-line bg-sp-card p-6 shadow-sp-1">
        <BookOpen aria-hidden="true" className="text-sp-violet-700" size={32} />
        <h2 className="mt-4 font-sp-display text-sp-2xl font-semibold">{({
          limited: t('newStory.limited'),
          disconnected: t('newStory.disconnected'),
          failed: t('newStory.failed'),
          partial: t('spxWizard.partial'),
          success: bookId ? t('newStory.theatreFinished') : t('newStory.success'),
        })[state]}</h2>
        {state === 'limited' && <>
          <p className="mt-3 text-sp-ink-600">{quotaError?.message}</p>
          {(quotaError?.resetsLabel || quotaError?.resetsOn) &&
            <p className="mt-3 text-sp-ink-600"><span>{t('newStory.resets')}</span> <span>{quotaError.resetsLabel || quotaError.resetsOn}</span></p>}
        </>}
        {state === 'disconnected' && <p className="mt-3 text-sp-ink-600">{t('newStory.disconnectedDetail')}</p>}
        {state === 'failed' && <p className="mt-3 text-sp-ink-600">{t('newStory.failedDetail')}</p>}
        <div className="mt-6 flex flex-wrap gap-3">
          {state === 'limited' && quotaError?.canUpgrade && <Link to="/pricing" className="inline-flex min-h-12 items-center rounded-sp-sm px-4 text-sp-violet-700 underline focus-visible:outline focus-visible:outline-2">{t('newStory.upgrade')}</Link>}
          {state === 'failed' && retry && <button onClick={retry} className="inline-flex min-h-12 items-center gap-2 rounded-sp-sm bg-sp-violet-700 px-4 text-white hover:bg-sp-violet-600 focus-visible:outline focus-visible:outline-2"><RefreshCw aria-hidden="true" size={18} />{t('newStory.retry')}</button>}
          {(state === 'failed' || state === 'disconnected') && shelfLink}
          {state === 'partial' && bookId && <Link to={`/BookView?id=${encodeURIComponent(bookId)}`} className="inline-flex min-h-12 items-center text-sp-violet-700 underline">{t('spxWizard.repair')}</Link>}
          {state === 'success' && bookId && <Link to={`/book/${encodeURIComponent(bookId)}/read`} className="inline-flex min-h-12 items-center text-sp-violet-700 underline">{t('newStory.open')}</Link>}
          {state === 'success' && bookId && <Link to={printEditionUrl(bookId)} className="inline-flex min-h-12 items-center rounded-sp-sm border border-sp-line px-4 text-sp-violet-700 hover:bg-sp-violet-50">{editionLabels(isRTL).title}</Link>}
        </div>
      </section>
    )}
    {state !== 'limited' && <Theatre state={state} bookId={bookId} t={t} />}
  </>;
}
