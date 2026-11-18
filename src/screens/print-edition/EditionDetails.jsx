import { BookHeart, PenLine } from 'lucide-react';
import { TEXT_LIMITS } from '@/lib/printEdition/model';
import { actionClass, textClass } from './labels';
import { EditionArtField } from './EditionArtField';

export function EditionDetails({ book, edition, change, changeArtwork, onBusy, busy, labels }) {
  const aboutExample = edition.creator.trim() ? labels.aboutExample(edition.creator.trim()) : '';
  return (
    <>
      <section className="edition-panel space-y-4">
        <h2 className="edition-heading"><PenLine aria-hidden="true" size={22} />{labels.identity}</h2>
        <div>
          <label className="font-semibold" htmlFor="edition-print-title">{labels.printTitle}</label>
          <input id="edition-print-title" dir="auto" className={textClass} maxLength={TEXT_LIMITS.printTitle} value={edition.printTitle} placeholder={book.title} onChange={e => change('printTitle', e.target.value, true)} />
        </div>
        <div>
          <label className="font-semibold" htmlFor="edition-creator">{labels.creator}</label>
          <p id="edition-creator-hint" className="text-sm text-sp-ink-600">{labels.creatorHint}</p>
          <input id="edition-creator" aria-describedby="edition-creator-hint" autoComplete="off" dir="auto" className={textClass} maxLength={TEXT_LIMITS.creator} value={edition.creator} onChange={e => change('creator', e.target.value, true)} />
        </div>
        <div>
          <label className="font-semibold" htmlFor="edition-blurb">{labels.blurb}</label>
          <textarea id="edition-blurb" dir="auto" className={textClass} rows={3} maxLength={TEXT_LIMITS.blurb} value={edition.blurb} onChange={e => change('blurb', e.target.value, true)} />
          {!edition.blurb && book.description && <button type="button" className={actionClass} onClick={() => change('blurb', book.description.slice(0, TEXT_LIMITS.blurb))}>{labels.useDescription}</button>}
        </div>
        <div>
          <label className="font-semibold" htmlFor="edition-author">{labels.about}</label>
          <p id="edition-author-hint" className="text-sm text-sp-ink-600">{labels.aboutPrompt}</p>
          <textarea id="edition-author" aria-describedby="edition-author-hint" dir="auto" className={textClass} rows={2} maxLength={TEXT_LIMITS.aboutAuthor} value={edition.aboutAuthor} onChange={e => change('aboutAuthor', e.target.value, true)} />
          {!edition.aboutAuthor && aboutExample && <button type="button" className={actionClass} onClick={() => change('aboutAuthor', aboutExample)}>{labels.aboutExampleAction}</button>}
        </div>
        <div>
          <label className="font-semibold" htmlFor="edition-copyright">{labels.copyright}</label>
          <textarea id="edition-copyright" dir="auto" className={textClass} rows={2} maxLength={TEXT_LIMITS.copyright} value={edition.copyright} onChange={e => change('copyright', e.target.value, true)} />
        </div>
        <EditionArtField inputId="edition-cover-art" label={labels.coverArt} labels={labels} src={edition.artwork.coverArt} fallback={book.cover_image} disabled={busy} onChange={src => changeArtwork('coverArt', src)} onBusy={onBusy} />
      </section>
      <section className="edition-panel">
        <div className="space-y-3">
          <h2 className="edition-heading"><BookHeart aria-hidden="true" size={22} />{labels.dedicationTitle}</h2>
          <div>
            <label className="font-semibold" htmlFor="edition-dedication">{labels.dedication}</label>
            <textarea id="edition-dedication" dir="auto" className={textClass} rows={3} maxLength={TEXT_LIMITS.dedication} value={edition.dedication} onChange={e => change('dedication', e.target.value, true)} />
          </div>
          <div className="flex flex-wrap gap-2">
            {!edition.dedication && <button type="button" className={actionClass} onClick={() => change('dedication', labels.dedicationExample)}>{labels.dedicationExampleAction}</button>}
            {!!edition.dedication && <button type="button" className={actionClass} onClick={() => change('dedication', '')}>{labels.skip}</button>}
          </div>
        </div>
      </section>
    </>
  );
}
