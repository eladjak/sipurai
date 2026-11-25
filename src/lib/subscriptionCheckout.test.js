import { afterEach, expect, it, vi } from 'vitest';
import handler from '../../api/payments/checkout.js';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

function checkout() {
  const response = {
    setHeader: vi.fn(),
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
  };
  const request = { method: 'POST', body: { productId: 'unit-test-product' } };
  return handler(request, response).then(() => response);
}

it.each([undefined, 'false', '1', 'TRUE'])('rejects checkout before contacting Creem when the flag is %s', async (flag) => {
  vi.stubEnv('SUBSCRIPTION_CHECKOUT_ENABLED', flag);
  vi.stubEnv('CREEM_API_KEY', 'unit-test-key');
  const provider = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ checkout_url: 'https://example.invalid/checkout' }),
  });
  vi.stubGlobal('fetch', provider);

  const response = await checkout();

  expect(response.status).toHaveBeenCalledWith(503);
  expect(provider).not.toHaveBeenCalled();
});

it('rejects disabled checkout even when credentials are absent', async () => {
  vi.stubEnv('SUBSCRIPTION_CHECKOUT_ENABLED', undefined);
  vi.stubEnv('CREEM_API_KEY', undefined);
  const provider = vi.fn();
  vi.stubGlobal('fetch', provider);

  const response = await checkout();

  expect(response.status).toHaveBeenCalledWith(503);
  expect(provider).not.toHaveBeenCalled();
});

it.each([undefined, 'false', '1', 'TRUE'])('does not request checkout on the client when the flag is %s', async (flag) => {
  vi.stubEnv('VITE_SUBSCRIPTION_CHECKOUT_ENABLED', flag);
  vi.stubEnv('VITE_CREEM_PRODUCT_LITE', 'unit-test-product');
  const request = vi.fn();
  vi.stubGlobal('fetch', request);
  const { openCheckout, PLANS } = await import('./creem.js');

  expect(PLANS.lite.creemProductId).toBe('unit-test-product');
  await openCheckout('lite', 'fixture@example.invalid');

  expect(request).not.toHaveBeenCalled();
});

it('preserves checkout when explicitly enabled', async () => {
  vi.stubEnv('SUBSCRIPTION_CHECKOUT_ENABLED', 'true');
  vi.stubEnv('CREEM_API_KEY', 'unit-test-key');
  const provider = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ checkout_url: 'https://example.invalid/checkout' }),
  });
  vi.stubGlobal('fetch', provider);

  const response = await checkout();

  expect(provider).toHaveBeenCalledTimes(1);
  expect(response.status).toHaveBeenCalledWith(200);
  expect(response.json).toHaveBeenCalledWith({ checkout_url: 'https://example.invalid/checkout' });
});
