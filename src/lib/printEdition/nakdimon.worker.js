import { addNikud } from './nakdimon';

self.addEventListener('message', async ({ data }) => {
  try {
    self.postMessage({ ok: true, text: await addNikud(data) });
  } catch {
    self.postMessage({ ok: false });
  }
});
