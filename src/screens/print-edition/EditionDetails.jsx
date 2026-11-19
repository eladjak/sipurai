import { useLayoutEffect, useRef, useState } from 'react';
import { BookHeart, PenLine, Sparkles } from 'lucide-react';
import { TEXT_LIMITS } from '@/lib/printEdition/model';
import { canSuggestEditionMatter, suggestEditionMatter } from '@/lib/printEdition/rewrite';
import { actionClass, textClass } from './labels';
import { EditionArtField } from './EditionArtField';

export function EditionDetails({ book, edition, change, changeArtwork, onBusy, busy, labels, suggestEnabled = false }) {
  const aboutExample = edition.creator.trim() ? labels.aboutExample(edition.creator.trim()) : '';
  const [suggestion, setSuggestion] = useState(null);
  const active = useRef(null);
  const seed = {
    blurb: (book.description || edition.printTitle || book.title || '').slice(0, TEXT_LIMITS.blurb),
    aboutAuthor: edition.creator,
    copyright: edition.creator,
  };
  const scope = JSON.stringify(suggestEnabled ? [book.id, book.language, edition.revision, edition.blurb,
    edition.aboutAuthor, edition.copyright, seed.blurb, seed.aboutAuthor] : []);
  const clearSuggestion = () => {
    active.current = null;
    setSuggestion(null);
  };
  useLayoutEffect(() => {
    // Invalidate a reply if the book, input or opt-in changes while it is pending.
    return () => { active.current = null; };
  }, [scope]);

  const request = async field => {
    if (!suggestEnabled || busy || !canSuggestEditionMatter(field, edition[field], seed[field]) || !onBusy(1)) return;
    const ticket = { field, scope };
    active.current = ticket;
    setSuggestion({ ticket, phase: 'pending' });
    try {
      const text = await suggestEditionMatter({ field, text: edition[field], seed: seed[field], language: book.language });
      if (active.current === ticket) setSuggestion({ ticket, phase: 'ready', text });
    } catch {
      if (active.current === ticket) setSuggestion({ ticket, phase: 'error' });
    } finally {
      onBusy(-1);
    }
  };

  const suggestionControls = (field, label) => {
    if (!suggestEnabled) return null;
    const state = suggestion?.ticket === active.current && suggestion.ticket.scope === scope && suggestion.ticket.field === field
      ? suggestion : null;
    return (
      <div className="mt-2 space-y-2">
        <button type="button" className={actionClass} disabled={busy || !canSuggestEditionMatter(field, edition[field], seed[field])}
          onClick={() => request(field)}>
          <Sparkles aria-hidden="true" size={17} />{labels.suggestMatter(label)}
        </button>
        {state?.phase === 'pending' && <p className="text-sm text-sp-ink-600">{labels.rewriteWorking}</p>}
        {state?.phase === 'error' && <p role="alert" className="text-sm text-sp-danger">{labels.rewriteFailed}</p>}
        {state?.phase === 'ready' && <div className="space-y-2 rounded-sp-sm bg-sp-violet-50 p-3" role="region" aria-label={labels.matterSuggestion}>
          <p role="status" className="font-semibold">{labels.matterSuggestion}</p>
          <p dir="auto" className="whitespace-pre-wrap break-words">{state.text}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={actionClass} disabled={busy} onClick={() => {
              if (active.current !== state.ticket) return;
              change(field, state.text);
              clearSuggestion();
            }}>{labels.useRewrite}</button>
            <button type="button" className={actionClass} onClick={clearSuggestion}>{labels.discardMatterSuggestion}</button>
          </div>
        </div>}
      </div>
    );
  };

  return (
    <>
      <section className="edition-panel space-y-4" onFocusCapture={event => {
        if (active.current && event.target.closest('[data-suggestion-field]')?.getAttribute('data-suggestion-field') !== active.current.field) clearSuggestion();
      }} onBlurCapture={event => {
        if (active.current && event.relatedTarget instanceof Node && !event.currentTarget.contains(event.relatedTarget)) clearSuggestion();
      }}>
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
        <div data-suggestion-field="blurb">
          <label className="font-semibold" htmlFor="edition-blurb">{labels.blurb}</label>
          <textarea id="edition-blurb" dir="auto" className={textClass} rows={3} maxLength={TEXT_LIMITS.blurb} value={edition.blurb} onChange={e => change('blurb', e.target.value, true)} />
          {!edition.blurb && book.description && <button type="button" className={actionClass} onClick={() => change('blurb', book.description.slice(0, TEXT_LIMITS.blurb))}>{labels.useDescription}</button>}
          {suggestionControls('blurb', labels.blurb)}
        </div>
        <div data-suggestion-field="aboutAuthor">
          <label className="font-semibold" htmlFor="edition-author">{labels.about}</label>
          <p id="edition-author-hint" className="text-sm text-sp-ink-600">{labels.aboutPrompt}</p>
          <textarea id="edition-author" aria-describedby="edition-author-hint" dir="auto" className={textClass} rows={2} maxLength={TEXT_LIMITS.aboutAuthor} value={edition.aboutAuthor} onChange={e => change('aboutAuthor', e.target.value, true)} />
          {!edition.aboutAuthor && aboutExample && <button type="button" className={actionClass} onClick={() => change('aboutAuthor', aboutExample)}>{labels.aboutExampleAction}</button>}
          {suggestionControls('aboutAuthor', labels.about)}
        </div>
        <div data-suggestion-field="copyright">
          <label className="font-semibold" htmlFor="edition-copyright">{labels.copyright}</label>
          <textarea id="edition-copyright" dir="auto" className={textClass} rows={2} maxLength={TEXT_LIMITS.copyright} value={edition.copyright} onChange={e => change('copyright', e.target.value, true)} />
          {suggestionControls('copyright', labels.copyright)}
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
