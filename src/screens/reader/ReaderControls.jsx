import React from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
export default function ReaderControls({ index, count, go, t, rtl = true }) {
  return <nav className="reader-controls" aria-label={t('nightReader.navigation')}>
    <button className="reader-arrow" disabled={index <= 0} onClick={() => go(index - 1)} aria-label={t('nightReader.previous')}>{rtl ? <ArrowRight aria-hidden="true"/> : <ArrowLeft aria-hidden="true"/>}</button>
    <div className="reader-center"><div className="reader-dots" aria-label={`${t('nightReader.position')} ${index + 1} / ${count}`} role="status">{Array.from({length:count}, (_, i) => <span key={i} className={i === index ? 'current' : ''} />)}</div></div>
    <button className="reader-arrow" disabled={index >= count - 1} onClick={() => go(index + 1)} aria-label={t('nightReader.next')}>{rtl ? <ArrowLeft aria-hidden="true"/> : <ArrowRight aria-hidden="true"/>}</button>
  </nav>;
}
