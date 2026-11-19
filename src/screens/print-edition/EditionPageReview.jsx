import { useEffect, useState } from 'react';
import { AlignCenter, Check, ChevronLeft, ChevronRight, Sparkles, SpellCheck2 } from 'lucide-react';
import { createNikudClient } from '@/lib/printEdition/localNikudClient';
import { BLEED_MM, PRINT_PRESETS } from '@/lib/printSpec';
import {
  canApproveNikud, editPageText, EDIT_INSTRUCTION_LIMIT, isReviewCurrent, isSafeStoryText,
  needsPageReview, pageDraft, reviewSource, STORY_TEXT_LIMIT, TEXT_ZONES,
} from '@/lib/printEdition/model';
import { EditionArtField } from './EditionArtField';
import { actionClass, textClass } from './labels';

const markKeys = ['ְ', 'ֱ', 'ֲ', 'ֳ', 'ִ', 'ֵ', 'ֶ', 'ַ', 'ָ', 'ֹ', 'ֻ', 'ּ', 'ׁ', 'ׂ'];
const markNames = ['שווא', 'חטף סגול', 'חטף פתח', 'חטף קמץ', 'חיריק', 'צירה', 'סגול', 'פתח', 'קמץ', 'חולם', 'קובוץ', 'דגש', 'שין ימנית', 'שין שמאלית'];

export function EditionPageReview({ book, pages, edition, changePage, onBusy, busy, labels, isRTL, index, setIndex, capabilities, basePages, onAddPage, canAddPage, onRemovePage }) {
  const [nikud] = useState(createNikudClient);
  useEffect(() => () => nikud.close(), [nikud]);
  const currentIndex = Math.min(index, pages.length - 1);
  const page = pages[currentIndex];
  const next = pages[currentIndex + 1];
  const previous = pages[currentIndex - 1];
  const reviewed = pages.filter((item, n) => {
    const draft = pageDraft(edition, item, n);
    return isSafeStoryText(draft.text) && (!needsPageReview(draft, book.language) || isReviewCurrent(draft));
  }).length;
  const Next = isRTL ? ChevronLeft : ChevronRight;
  const Prev = isRTL ? ChevronRight : ChevronLeft;
  if (!page) return null;
  const draft = pageDraft(edition, page, currentIndex);
  const previousDraft = previous && pageDraft(edition, previous, currentIndex - 1);
  const nextDraft = next && pageDraft(edition, next, currentIndex + 1);
  const isSecond = previousDraft?.layout === 'spread';
  const scene = isSecond ? previousDraft : draft;
  const sceneId = isSecond ? previous.id : page.id;
  const isWide = scene.layout === 'spread';
  const preset = PRINT_PRESETS.find(item => item.id === book.print_size) || PRINT_PRESETS[0];
  const spreadRatio = (2 * preset.widthMm + 2 * BLEED_MM) / (preset.heightMm + 2 * BLEED_MM);
  const reference = edition.artwork.characterSheet || book.cover_image || edition.artwork.coverArt;
  const generateArt = capabilities.illustrationGeneration && reference && isSafeStoryText(draft.text) && (!isWide || (next && isSafeStoryText(nextDraft.text))) ? async instruction => {
    const { makeSceneArt, makeSpreadArt } = await import('@/lib/printEdition/assets');
    const scenePage = { ...page, text_content: draft.text };
    return isWide
      ? makeSpreadArt(book, scenePage, { ...next, text_content: nextDraft.text }, reference, spreadRatio, instruction)
      : makeSceneArt(book, scenePage, reference, instruction);
  } : null;
  return (
    <section className="edition-panel space-y-4" aria-labelledby="edition-story">
      <h2 id="edition-story" className="edition-heading"><SpellCheck2 aria-hidden="true" size={22} />{labels.story}</h2>
      {book.language === 'hebrew' && <p className="text-sm leading-relaxed text-sp-ink-600">{labels.storyHelp}</p>}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          <button className={`${actionClass} min-w-11`} type="button" aria-label={labels.previous} disabled={busy || currentIndex === 0} onClick={() => setIndex(currentIndex - 1)}><Prev aria-hidden="true" size={20} /></button>
          <button className={`${actionClass} min-w-11`} type="button" aria-label={labels.next} disabled={busy || currentIndex + 1 >= pages.length} onClick={() => setIndex(currentIndex + 1)}><Next aria-hidden="true" size={20} /></button>
        </div>
        <div className="text-sm leading-tight text-sp-ink-600" aria-live="polite">{labels.page} <bdi>{currentIndex + 1}/{pages.length}</bdi> · {labels.reviewed} <bdi>{reviewed}/{pages.length}</bdi></div>
      </div>
      {(onAddPage || page.extra) && <div className="flex flex-wrap items-center gap-2">
        {onAddPage && <button className={actionClass} type="button" disabled={!canAddPage || busy} onClick={onAddPage}>{labels.addPrintPage}</button>}
        {onAddPage && !canAddPage && <p role="status" className="text-sm text-sp-ink-600">{labels.maxPrintPages}</p>}
        {page.extra && <button className={actionClass} type="button" disabled={busy} onClick={() => onRemovePage(page.id)}>{labels.removePrintPage}</button>}
      </div>}
      {page.extra && <p className="text-sm text-sp-ink-600">{labels.extraPageHelp}</p>}
      <div className="grid items-start gap-6 grid-cols-[repeat(auto-fit,minmax(min(100%,17rem),1fr))]">
        <StoryText key={page.id} nikud={nikud} busy={busy} book={book} draft={draft} labels={labels} isRTL={isRTL} rewriteEnabled={capabilities.rewriteSuggestions} onBusy={onBusy} onChange={(patch, key) => changePage(page.id, patch, key)} />
        <div className="min-w-0 space-y-4">
          <div>
            <label className="block font-semibold" htmlFor="edition-zone">{labels.zone}</label>
            <select id="edition-zone" className={textClass} value={draft.zone} onChange={e => changePage(page.id, { zone: e.target.value })}>
              {TEXT_ZONES.map((zone, n) => <option key={zone} value={zone}>{labels.zones[n]}</option>)}
            </select>
            <p className="mt-1 text-sm text-sp-ink-600">{labels.safeZoneHelp}</p>
          </div>
          {capabilities.advancedLayout && <Framing scene={scene} isSecond={isSecond} isWide={isWide} maxWidth={Math.round(preset.widthMm * 0.8)} draft={draft} defaultPanel={edition.defaultPanel} aspectRatio={`${preset.widthMm} / ${preset.heightMm}`} artwork={scene.printArt || scene.spread || page.image_url} labels={labels} onChange={(patch, key) => changePage(sceneId, { printSettings: { ...scene.printSettings, ...patch } }, key)} />}
          <div>
            {isSecond ? <button id="edition-scene-layout" className={actionClass} type="button" disabled={busy} onClick={() => setIndex(currentIndex - 1)}>{labels.spreadSecond}</button> :
              (isWide || (next && nextDraft?.layout !== 'spread')) && <>
                <label className="block font-semibold" htmlFor="edition-scene-layout">{labels.layout}</label>
                <select id="edition-scene-layout" className={textClass} value={draft.layout} onChange={e => changePage(page.id, { layout: e.target.value })}>
                  <option value="single">{labels.single}</option>
                  <option value="spread">{labels.spread}</option>
                </select>
              </>}
          </div>
          {!isSecond && <SceneArtwork key={`${page.id}:${isWide}`} draft={draft} original={page.image_url} artOptions={page.extra && !isWide ? basePages.filter(item => item.image_url) : []} isWide={isWide} spreadRatio={spreadRatio} labels={labels} busy={busy} onBusy={onBusy} generateArt={generateArt} generationEnabled={capabilities.illustrationGeneration && !reference} onChange={patch => changePage(page.id, patch)} />}
        </div>
      </div>
    </section>
  );
}

function StoryText({ nikud, busy, book, draft, labels, isRTL, rewriteEnabled, onBusy, onChange }) {
  const [work, setWork] = useState('');
  const [rewriteWork, setRewriteWork] = useState('');
  const [instruction, setInstruction] = useState('');
  const [candidate, setCandidate] = useState(null);
  const [editor, setEditor] = useState(null);
  const source = reviewSource(draft);
  const reviewNeeded = needsPageReview(draft, book.language);
  const approved = isReviewCurrent(draft);
  const activeCandidate = candidate?.original === draft.text ? candidate.text : null;
  const edit = (text, grouped = false) => {
    if (text === draft.text) return;
    setCandidate(null);
    onChange(editPageText(draft, text), grouped ? 'text' : undefined);
  };
  const suggest = async () => {
    if (!onBusy(1)) return;
    setWork('working');
    try {
      const suggested = await nikud.suggest(source);
      if (!canApproveNikud({ ...draft, text: suggested })) throw new Error('Invalid nikud response');
      edit(suggested);
      setWork('');
    } catch {
      setWork('failed');
    } finally {
      onBusy(-1);
    }
  };
  const rewrite = async () => {
    if (!rewriteEnabled || busy || !instruction.trim() || !isSafeStoryText(draft.text)) return;
    if (!onBusy(1)) return;
    setRewriteWork('rewriteWorking');
    setCandidate(null);
    try {
      const { suggestEditionRewrite } = await import('@/lib/printEdition/rewrite');
      const text = await suggestEditionRewrite({ text: draft.text, instruction, language: book.language });
      setCandidate({ text, original: draft.text });
      setRewriteWork('');
    } catch {
      setRewriteWork('rewriteFailed');
    } finally {
      onBusy(-1);
    }
  };
  const insertMark = mark => {
    if (!editor) return;
    const caret = editor.selectionStart;
    edit(draft.text.slice(0, caret) + mark + draft.text.slice(editor.selectionEnd));
    requestAnimationFrame(() => {
      editor.focus();
      editor.setSelectionRange(caret + mark.length, caret + mark.length);
    });
  };
  return (
    <div className="min-w-0 space-y-3">
      {reviewNeeded && <div role="status" className={`flex min-h-7 items-center gap-1.5 text-sm font-semibold ${approved ? 'text-green-800' : 'text-sp-ink-600'}`}>{approved && <Check aria-hidden="true" size={17} />}{approved ? labels.reviewed : labels.needsReview}</div>}
      <div>
        <label className="block font-semibold" htmlFor="edition-story-text">{labels.text}</label>
        <textarea ref={setEditor} id="edition-story-text" dir={book.language === 'hebrew' ? 'rtl' : 'auto'} aria-describedby="edition-story-text-hint" rows={5} maxLength={STORY_TEXT_LIMIT} value={draft.text} onChange={e => edit(e.target.value, true)} className={`edition-print-font ${textClass} leading-relaxed`} disabled={busy} />
        <p id="edition-story-text-hint" className="text-sm leading-relaxed text-sp-ink-600">{reviewNeeded ? labels.nikudChanged : labels.storyChangeHelp}</p>
      </div>
      {reviewNeeded && <>
        <div className="flex flex-wrap gap-1" dir="rtl">
          {markKeys.map((mark, n) => <button key={mark} type="button" className={`${actionClass} edition-print-font min-w-11 text-xl`} aria-label={isRTL ? markNames[n] : `${labels.insertMark} ${markNames[n]}`} disabled={busy} onClick={() => insertMark(mark)}>{`◌${mark}`}</button>)}
        </div>
        <button type="button" className={actionClass} onClick={suggest} disabled={busy || !isSafeStoryText(source)}><AlignCenter aria-hidden="true" size={17} />{labels.nikud}</button>
        {work === 'working' && <p role="status" className="text-sm text-sp-ink-600">{labels.nikudWorking}</p>}
        {work === 'failed' && <p role="alert" className="text-sm text-sp-danger">{labels.nikudFailed}</p>}
        <div className="flex flex-wrap gap-2">
          <button type="button" className={actionClass} disabled={busy || !canApproveNikud(draft)} onClick={() => onChange({ approval: { mode: 'approved', text: draft.text } })}>{labels.approve}</button>
          <button type="button" className={actionClass} disabled={busy || !isSafeStoryText(source)} onClick={() => { setCandidate(null); onChange({ text: source, approval: { mode: 'unpointed', text: source } }); }}>{labels.unpointed}</button>
        </div>
      </>}
      {rewriteEnabled && <details className="rounded-sp-sm border border-sp-line px-3">
        <summary className="min-h-11 cursor-pointer py-3 font-semibold">{labels.rewriteWithAI}</summary>
        <div className="space-y-2 pb-3">
          <label className="block text-sm font-semibold" htmlFor="edition-rewrite-instruction">{labels.rewriteInstruction}</label>
          <textarea id="edition-rewrite-instruction" className={textClass} maxLength={EDIT_INSTRUCTION_LIMIT} rows={2} dir="auto" value={instruction} onChange={e => setInstruction(e.target.value)} disabled={busy} placeholder={labels.rewriteExample} />
          <button type="button" className={actionClass} disabled={busy || !instruction.trim() || !isSafeStoryText(draft.text)} onClick={rewrite}><Sparkles aria-hidden="true" size={17} />{labels.requestRewrite}</button>
          {(rewriteWork || activeCandidate) && <p role={rewriteWork === 'rewriteFailed' ? 'alert' : 'status'} className="text-sm text-sp-ink-600">{rewriteWork ? labels[rewriteWork] : labels.rewriteResult}</p>}
          {activeCandidate && <div className="space-y-2 rounded-sp-sm bg-sp-violet-50 p-3" role="region" aria-label={labels.rewriteResult}>
            <p dir="auto" className="whitespace-pre-wrap break-words text-sm">{activeCandidate}</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={actionClass} disabled={busy || activeCandidate === draft.text} onClick={() => edit(activeCandidate)}>{labels.useRewrite}</button>
              <button type="button" className={actionClass} disabled={busy} onClick={() => setCandidate(null)}>{labels.discardRewrite}</button>
            </div>
          </div>}
        </div>
      </details>}
    </div>
  );
}

export function Framing({ scene, isSecond, isWide, maxWidth, draft, defaultPanel, aspectRatio, artwork, labels, onChange }) {
  const settings = scene.printSettings || {};
  const panel = settings.panel || defaultPanel || 'cream';
  const anchor = settings.anchor || [0.5, 0.5];
  const widthCount = isWide ? 2 : 1;
  const widths = settings.panelWidthsMm?.length === widthCount ? settings.panelWidthsMm : Array(widthCount).fill(maxWidth);
  const side = isSecond ? 1 : 0;
  return (
    <details className="rounded-sp-sm border border-sp-line px-3">
      <summary className="min-h-11 cursor-pointer py-3 font-semibold">{labels.advancedLayout}</summary>
      <div className="space-y-3 pb-3">
        {isWide && <p className="text-sm text-sp-ink-600">{labels.sharedFraming}</p>}
        <div>
          <label htmlFor="edition-panel-style" className="block text-sm font-semibold">{labels.panelStyle}</label>
          <select id="edition-panel-style" className={textClass} value={panel} onChange={e => onChange({ panel: e.target.value })}>
            <option value="cream">{labels.creamPanel}</option>
            <option value="integrated">{labels.integratedPanel}</option>
            <option value="dark">{labels.darkPanel}</option>
          </select>
        </div>
        {panel === 'integrated' && artwork && <div>
          <p className="text-sm text-sp-ink-600">{labels.integratedPreview}</p>
          <div className="relative mt-2 overflow-hidden" style={{ aspectRatio, background: '#f5e8d7' }}>
            <img src={artwork} alt="" className="h-full w-full object-cover" />
            <div className="absolute inset-x-0 px-[8%] py-[8%]" style={{ [draft.zone.startsWith('top') ? 'top' : 'bottom']: 0, background: `linear-gradient(to ${draft.zone.startsWith('top') ? 'bottom' : 'top'}, rgba(255,244,225,.97) 65%, transparent)` }}><div dir="auto" className="whitespace-pre-wrap text-right text-sm font-semibold leading-relaxed text-[#24243b]" style={{ maxWidth: '80%', marginLeft: draft.zone.endsWith('left') ? 0 : 'auto', marginRight: draft.zone.endsWith('right') ? 0 : 'auto' }}>{draft.text}</div></div>
          </div>
        </div>}
        {['anchorX', 'anchorY'].map((axis, n) => <label key={axis} className="block text-sm font-semibold">{labels[axis]}
          <input type="range" min="0" max="100" value={Math.round(anchor[n] * 100)} dir="ltr" className="block h-11 w-full accent-sp-violet-700" onChange={e => onChange({ anchor: anchor.map((value, i) => n === i ? Number(e.target.value) / 100 : value) }, axis)} />
        </label>)}
        <label className="block text-sm font-semibold">{labels.panelWidth}
          <input type="range" min="55" max={maxWidth} value={Math.min(widths[side], maxWidth)} dir="ltr" className="block h-11 w-full accent-sp-violet-700" onChange={e => onChange({ panelWidthsMm: widths.map((width, i) => side === i ? Number(e.target.value) : width) }, 'panelWidth')} />
        </label>
      </div>
    </details>
  );
}

function SceneArtwork({ draft, original, artOptions, isWide, spreadRatio, labels, busy, onBusy, generateArt, generationEnabled, onChange }) {
  const [instruction, setInstruction] = useState('');
  const [work, setWork] = useState('');
  const overridden = isWide ? draft.spread : draft.printArt;
  const artKey = isWide ? 'spread' : 'printArt';
  const generate = async () => {
    if (busy || !generateArt || (!isWide && !instruction.trim())) return;
    if (!onBusy(1)) return;
    setWork('imageWorking');
    try {
      onChange({ [artKey]: await generateArt(instruction) });
      setWork('');
    } catch {
      setWork('imageFailed');
    } finally {
      onBusy(-1);
    }
  };
  return (
    <div className="space-y-3">
      {isWide && <p className="text-sm text-sp-ink-600">{labels.spreadHint}</p>}
      <EditionArtField inputId="edition-story-art" label={isWide ? labels.imageInput : labels.replaceIllustration} labels={labels} src={overridden} fallback={!isWide ? original : undefined} disabled={busy} spreadRatio={isWide ? spreadRatio : undefined} onChange={src => onChange({ [artKey]: src })} onBusy={onBusy} />
      {artOptions.length > 0 && <div>
        <label className="block text-sm font-semibold" htmlFor="edition-reuse-art">{labels.reuseArt}</label>
        <select id="edition-reuse-art" className={textClass} value={artOptions.find(item => item.image_url === overridden)?.id || ''} onChange={e => {
          const art = artOptions.find(item => item.id === e.target.value);
          if (art) onChange({ [artKey]: art.image_url });
        }}>
          <option value="" disabled>{labels.chooseExistingArt}</option>
          {artOptions.map(item => <option key={item.id} value={item.id}>{labels.artFromPage(item.page_number)}</option>)}
        </select>
      </div>}
      {generateArt ? <details className="rounded-sp-sm border border-sp-line px-3">
        <summary className="min-h-11 cursor-pointer py-3 font-semibold">{isWide ? labels.generateSpread : labels.regenerateArt}</summary>
        <div className="space-y-2 pb-3">
          <p className="text-sm text-sp-ink-600">{labels.referenceHelp}</p>
          <label htmlFor="edition-art-instruction" className="block text-sm font-semibold">{labels.imageInstruction}</label>
          <textarea id="edition-art-instruction" maxLength={EDIT_INSTRUCTION_LIMIT} rows={2} className={textClass} dir="auto" value={instruction} placeholder={labels.imageExample} onChange={e => setInstruction(e.target.value)} disabled={busy} />
          <button className={actionClass} type="button" disabled={busy || (!isWide && !instruction.trim())} onClick={generate}><Sparkles aria-hidden="true" size={17} />{isWide ? labels.generateSpreadAction : labels.regenerateArtAction}</button>
          {work && <p className="text-sm text-sp-ink-600" role={work === 'imageFailed' ? 'alert' : 'status'}>{labels[work]}</p>}
        </div>
      </details> : generationEnabled && <p className="text-sm text-sp-ink-600">{labels.imageReferenceMissing}</p>}
    </div>
  );
}
