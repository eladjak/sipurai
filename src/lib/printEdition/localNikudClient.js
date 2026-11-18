// The review owns one lazy worker. Keeping it alive lets successive pages
// reuse the same loaded model and avoids repeating first-use setup.
export function createNikudClient() {
  let worker;
  let cancel;
  const close = () => {
    cancel?.();
    worker?.terminate();
    worker = undefined;
  };

  return {
    close,
    suggest(text) {
      if (cancel) return Promise.reject(new Error('Nikud request already in progress'));
      try {
        worker ??= new Worker(new URL('./nakdimon.worker.js', import.meta.url), { type: 'module' });
      } catch (error) {
        return Promise.reject(error);
      }
      return new Promise((resolve, reject) => {
        const active = worker;
        const done = () => {
          clearTimeout(timer);
          active.removeEventListener('message', onResult);
          active.removeEventListener('error', onFailure);
          cancel = undefined;
        };
        const onFailure = () => {
          done();
          active.terminate();
          if (worker === active) worker = undefined;
          reject(new Error('Nikud unavailable'));
        };
        const onResult = ({ data }) => {
          if (!data.ok) {
            onFailure();
            return;
          }
          done();
          resolve(data.text);
        };
        const timer = setTimeout(onFailure, 90_000);
        cancel = onFailure;
        active.addEventListener('message', onResult);
        active.addEventListener('error', onFailure);
        active.postMessage(text);
      });
    },
  };
}
