import React, { useState, useEffect } from 'react';
import { MoonStar } from 'lucide-react';
export default function ReaderPage({ page, t, word = -1 }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [page?.image_url]);
  return <article className="reader-page">
    <div className="reader-art">{page?.image_url && !broken ? <img src={page.image_url} alt="" onError={() => setBroken(true)} /> : <div className="reader-placeholder"><MoonStar size={64} aria-hidden="true"/><span>{t('nightReader.missingArt')}</span></div>}</div>
    <p className="reader-text">{(page?.text_content || '').split(/(\s+)/).map((part, i, all) => { const n = all.slice(0, i).filter(x => x.trim()).length; return <span key={i} className={part.trim() && n === word ? 'reader-word' : undefined}>{part}</span>; })}</p>
  </article>;
}
