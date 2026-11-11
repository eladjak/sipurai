import React, { useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useI18n } from '@/components/i18n/i18nProvider';
import { useTTS } from '@/hooks/useTTS';
import { getStoredTTSEngine } from '@/components/bookReader/TTSControls';
import { useNightReader } from './useNightReader';
import ReaderPage from './ReaderPage';
import ReaderControls from './ReaderControls';
import AdultExit from './AdultExit';
import '@/styles/sp-tokens.css';
import '@/styles/sp-fonts.css';

const readerStyles = `
      body:has(.night-reader) .sp-shell:has(#main-content) > a,body:has(.night-reader) .sp-shell:has(#main-content) > nav,body:has(.night-reader) .sp-shell:has(#main-content) aside,body:has(.night-reader) .sp-shell:has(#main-content) header:not(.reader-top){display:none}
      body:has(.night-reader) .sp-shell:has(#main-content) > div{max-width:none}body:has(.night-reader) #main-content{min-height:100dvh}body:has(.night-reader) div:has(> #main-content){padding-bottom:0}body:has(.night-reader) #main-content > .night-reader{width:100%}
      .night-reader{min-height:100dvh;background:radial-gradient(ellipse at 50% 0%,var(--sp-night-700),var(--sp-night-900) 75%);color:var(--sp-on-night);display:flex;flex-direction:column;padding:12px 16px max(16px,env(safe-area-inset-bottom));gap:12px}
      .reader-top{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:52px}.reader-title{font-family:var(--sp-font-display),sans-serif;font-size:1.15rem;margin:0}.reader-exit-wrap{flex:none}.reader-exit span{display:block;font-size:.75rem;line-height:1.3}
      .reader-exit{position:relative;min-width:112px;min-height:48px;padding:6px 12px;border:1px solid var(--sp-on-night-muted);border-radius:var(--sp-r-pill);background:transparent;color:var(--sp-on-night);cursor:pointer}.reader-exit.holding{background:conic-gradient(var(--sp-gold-400) var(--reader-progress),var(--sp-night-800) 0);animation:reader-hold 2s linear forwards}@property --reader-progress{syntax:'<percentage>';inherits:false;initial-value:0%}@keyframes reader-hold{to{--reader-progress:100%;color:var(--sp-night-900)}}
      .reader-page{width:min(100%,760px);margin:auto;display:flex;flex-direction:column;gap:18px}.reader-art{height:min(43dvh,440px);min-height:160px;border-radius:var(--sp-r-lg);overflow:hidden;background:var(--sp-night-800);display:grid;place-items:center}.reader-art img{width:100%;height:100%;object-fit:cover;object-position:center}.reader-placeholder{display:grid;justify-items:center;gap:12px;color:var(--sp-on-night-muted);text-align:center}.reader-text{font-size:clamp(1.25rem,3vw,1.8rem);line-height:1.65;text-align:center;white-space:pre-wrap;margin:0}.reader-word{color:var(--sp-gold-400);text-decoration:underline;text-underline-offset:4px}
      .reader-controls{width:min(100%,760px);margin: auto auto 0;display:flex;align-items:end;justify-content:space-between;gap:12px}.reader-arrow,.reader-play,.reader-replay{display:grid;place-items:center;border:0;border-radius:50%;cursor:pointer}.reader-arrow,.reader-play{width:64px;height:64px;background:var(--sp-cream-100);color:var(--sp-night-900)}.reader-arrow:disabled,.reader-replay:disabled,.reader-play:disabled{opacity:.35;cursor:default}.reader-center{display:grid;justify-items:center;gap:10px}.reader-dots{display:flex;gap:6px;justify-content:center;flex-wrap:wrap;max-width:180px}.reader-dots span{width:8px;height:8px;border-radius:50%;background:var(--sp-on-night-muted)}.reader-dots .current{background:var(--sp-gold-400);transform:scale(1.35)}.reader-audio{display:flex;align-items:center;gap:8px}.reader-replay{min-height:44px;padding:4px 8px;display:flex;gap:6px;background:transparent;color:var(--sp-on-night);font-size:.875rem;border-radius:var(--sp-r-pill)}.reader-replay svg{width:18px;height:18px}
      .night-reader button:focus-visible{outline:3px solid var(--sp-gold-400);outline-offset:3px}.night-reader button:not(:disabled):hover{filter:brightness(1.12)}.night-reader button:not(:disabled):active{transform:scale(.96)}.reader-status{text-align:center;color:var(--sp-on-night-muted)}.reader-empty{margin:auto;text-align:center}.reader-empty h2{font-size:1.5rem}
      @media (max-height:500px) and (orientation:landscape){.reader-page{flex-direction:row;align-items:center}.reader-art{width:50%;height:42dvh;min-height:100px}.reader-text{width:50%;font-size:1.15rem}.reader-top{min-height:44px}.night-reader{gap:4px}.reader-controls{margin-top:0}}
      @media(prefers-reduced-motion:reduce){.reader-exit.holding{animation:none;outline:3px solid var(--sp-gold-400)}}
    `;

export default function NightReader() {
  const { id } = useParams(), navigate = useNavigate(), { t, language, isRTL } = useI18n();
  const { book, pages, index, setIndex, state } = useNightReader(id);
  const tts = useTTS({ language: book?.language || language, engine: getStoredTTSEngine() });
  const startX = useRef(null);
  const go = (i) => { if (i >= 0 && i < pages.length && i !== index) { tts.stop(); setIndex(i); } };
  const status = state === 'loading' ? 'loading' : state === 'failed' || state === 'missing' ? 'failed' : state === 'starting' ? 'building' : state === 'empty' ? 'failed' : state === 'interrupted' ? 'paused' : state === 'building' ? 'building' : null;
  return <main className="sp-shell night-reader" dir={isRTL ? 'rtl' : 'ltr'} onTouchStart={e => {startX.current = e.touches[0]?.clientX;}} onTouchEnd={e => {const delta = e.changedTouches[0]?.clientX - startX.current; if (Math.abs(delta) > 60) go(index + ((delta > 0) === isRTL ? 1 : -1)); startX.current = null;}}>
    <style dangerouslySetInnerHTML={{ __html: readerStyles }} />
    <header className="reader-top"><h1 className="reader-title">{book?.title || t('nightReader.title')}</h1><AdultExit t={t} onExit={() => {tts.stop(); navigate('/shelf');}} /></header>
    {status && <div className={pages.length ? 'reader-status' : 'reader-empty'} role="status"><h2>{({loading: t('nightReader.loading'), building: t('nightReader.building'), paused: t('nightReader.paused'), failed: t('nightReader.failed')})[status]}</h2>{!pages.length && <p>{t('nightReader.askAdult')}</p>}</div>}
    {pages.length > 0 && <><ReaderPage page={pages[index]} t={t} word={tts.currentWordIndex}/><ReaderControls index={index} count={pages.length} go={go} t={t} tts={tts} text={pages[index]?.text_content} rtl={isRTL}/></>}
  </main>;
}
