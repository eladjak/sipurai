// The entry bundle may be missing during an upgrade. Run independently of it.
(() => {
  const startup = document.getElementById('sp-startup');
  const message = document.getElementById('sp-startup-message');
  const retry = startup.querySelector('a');
  retry.addEventListener('click', (event) => {
    event.preventDefault();
    window.location.reload();
  });

  let english = navigator.language?.toLowerCase().startsWith('en');
  try {
    const savedLanguage = localStorage.getItem('language');
    if (savedLanguage) english = savedLanguage === 'english';
  } catch { /* Use the default language when storage is unavailable. */ }

  if (english) {
    startup.lang = 'en';
    startup.dir = 'ltr';
    message.textContent = 'Opening Sipurai…';
    retry.textContent = 'Refresh the page';
  }

  function showRetry() {
    if (!startup.isConnected) return;
    message.textContent = english
      ? 'Sipurai is taking longer to open. Try refreshing the page.'
      : 'סיפוראי מתעכבת בפתיחה. נסו לרענן את העמוד.';
  }

  // Capture errors from the module tag, including failures in its import graph.
  document.addEventListener('error', (event) => {
    if (event.target instanceof HTMLScriptElement && event.target.type === 'module') showRetry();
  }, true);
  window.setTimeout(showRetry, 10000);

  if (startup.dataset.production === 'true' && 'serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).catch(() => {});
    // The older worker may still control this first load. Clear its obsolete
    // API cache without waiting for the app bundle or touching local drafts.
    if ('caches' in window) {
      caches.keys().then(names => Promise.all(
        names.filter(name => /^sipurai-.*-api$/.test(name)).map(name => caches.delete(name))
      )).catch(() => {});
    }
  }
})();
