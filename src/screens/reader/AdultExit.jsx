import React, { useEffect, useRef, useState } from 'react';
export default function AdultExit({t, onExit}) {
  const timer = useRef(null); const [holding, setHolding] = useState(false);
  const cancel = () => { clearTimeout(timer.current); timer.current = null; setHolding(false); };
  useEffect(() => () => clearTimeout(timer.current), []);
  const start = () => { if (timer.current) return; setHolding(true); timer.current = setTimeout(() => { timer.current = null; setHolding(false); onExit(); }, 2000); };
  return <div className="reader-exit-wrap"><button className={`reader-exit ${holding ? 'holding' : ''}`} aria-label={t('nightReader.exit')} aria-describedby="reader-exit-instruction" onPointerDown={start} onPointerUp={cancel} onPointerCancel={cancel} onPointerLeave={cancel} onKeyDown={e => {if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {e.preventDefault(); start();}}} onKeyUp={e => {if (e.key === ' ' || e.key === 'Enter') cancel();}} onBlur={cancel}>{t('nightReader.exit')}<span id="reader-exit-instruction">{t('nightReader.hold')}</span></button></div>;
}
