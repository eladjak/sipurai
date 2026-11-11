import React from 'react';
import { ArrowLeft, ArrowRight, Play, Pause, RotateCcw } from 'lucide-react';
export default function ReaderControls({ index, count, go, t, tts, text, rtl = true }) {
  const play = () => tts.isPaused ? tts.resume?.() : tts.isSpeaking ? tts.pause?.() : tts.speak?.(text);
  return <nav className="reader-controls" aria-label={t('nightReader.navigation')}>
    <button className="reader-arrow" disabled={index <= 0} onClick={() => go(index - 1)} aria-label={t('nightReader.previous')}>{rtl ? <ArrowRight aria-hidden="true"/> : <ArrowLeft aria-hidden="true"/>}</button>
    <div className="reader-center"><div className="reader-dots" aria-label={`${t('nightReader.position')} ${index + 1} / ${count}`} role="status">{Array.from({length:count}, (_, i) => <span key={i} className={i === index ? 'current' : ''} />)}</div>
      <div className="reader-audio"><button className="reader-play" disabled={!text} onClick={play} aria-label={tts.isSpeaking && !tts.isPaused ? t('nightReader.pause') : t('nightReader.play')}>{tts.isSpeaking && !tts.isPaused ? <Pause aria-hidden="true"/> : <Play aria-hidden="true"/>}</button></div><button className="reader-replay" disabled={!text} onClick={() => {tts.stop?.(); tts.speak?.(text);}} aria-label={t('nightReader.replay')}><RotateCcw aria-hidden="true"/>{t('nightReader.replay')}</button></div>
    <button className="reader-arrow" disabled={index >= count - 1} onClick={() => go(index + 1)} aria-label={t('nightReader.next')}>{rtl ? <ArrowLeft aria-hidden="true"/> : <ArrowRight aria-hidden="true"/>}</button>
  </nav>;
}
