import React from 'react';
export default function BlogLoadError({isRTL, onRetry}) {
  return <div role="alert" dir={isRTL?'rtl':'ltr'} className="rounded-2xl border border-purple-200 bg-purple-50 p-8 text-center text-gray-900"><h2 className="text-xl font-bold">{isRTL?'לא הצלחנו לטעון את המאמרים':'We could not load the articles'}</h2><p className="mt-3">{isRTL?'כדאי לבדוק את החיבור ולנסות שוב.':'Check your connection and try again.'}</p><button type="button" onClick={onRetry} className="mt-5 min-h-11 rounded-full bg-purple-700 px-6 font-semibold text-white">{isRTL?'לנסות שוב':'Try again'}</button></div>;
}
