import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nContext, LANGUAGES } from '@/components/i18n/i18nProvider';
import { isPrintOrderEnabled } from '@/lib/printOrder/flag';
import { PrintOrderApiError } from '@/lib/printOrder/api';
import { OrderBookButton } from '@/components/checkout/OrderBookButton';
import { validateAddress, isValidPhone, normalizeAddress } from '@/components/checkout/validation';
import { PrintCheckoutView } from '@/pages/PrintCheckout';
import { MyOrdersView } from '@/pages/MyOrders';
import { AdminPrintOrdersView } from '@/pages/AdminPrintOrders';

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

const t = (key, values = {}) => {
  const value = key.split('.').reduce((item, part) => item?.[part], LANGUAGES.hebrew.translations);
  return typeof value === 'string' ? value.replace(/\{(\w+)\}/g, (_, name) => values[name] ?? '') : value;
};
const wrap = (ui) => render(<I18nContext.Provider value={{ t, language: 'hebrew', direction: 'rtl' }}><MemoryRouter>{ui}</MemoryRouter></I18nContext.Provider>);

const quote = {
  currency: 'ILS', presetId: 'sq22', qty: 1, method: 'ship', vatIncluded: true,
  lines: [
    { key: 'book', label_he: 'ספר מודפס', amountAgorot: 7777 },
    { key: 'shipping', label_he: 'משלוח סיפוראי', amountAgorot: 1234 },
  ],
  // deliberately NOT the sum of the lines: the UI must show what the server says
  totalAgorot: 9999,
};
const FILLED = { fullName: 'דנה לוי', phone: '050-1234567', city: 'חיפה', street: 'הנרקיסים', houseNumber: '12' };

const mkApi = (over = {}) => ({
  getConfig: vi.fn(async () => ({ enabled: true, pickup: { enabled: true, label_he: 'איסוף עצמי' }, maxQty: 5 })),
  getQuote: vi.fn(async () => quote),
  createOrder: vi.fn(async () => ({ orderId: 'o1', status: 'awaiting_payment', checkoutUrl: 'https://pay.example/x' })),
  getMyOrders: vi.fn(async () => ({ orders: [] })),
  getOrder: vi.fn(),
  adminList: vi.fn(async () => ({ orders: [], alerts: [] })),
  adminAction: vi.fn(async () => ({ ok: true })),
  ...over,
});

const checkout = (api, props = {}) =>
  wrap(<PrintCheckoutView bookId="b1" api={api} persist={false} quoteDebounceMs={0} redirect={vi.fn()} {...props} />);

describe('feature flag', () => {
  it('is off by default and the order button renders nothing', () => {
    expect(isPrintOrderEnabled()).toBe(false);
    const { container } = wrap(<OrderBookButton bookId="b1" />);
    expect(container.querySelector('a')).toBeNull();
    expect(screen.queryByText('להזמין ספר מודפס')).toBeNull();
  });
  it('only the exact string "true" turns it on', () => {
    vi.stubEnv('VITE_PRINT_ORDER_ENABLED', '1');
    expect(isPrintOrderEnabled()).toBe(false);
    vi.stubEnv('VITE_PRINT_ORDER_ENABLED', 'true');
    expect(isPrintOrderEnabled()).toBe(true);
    wrap(<OrderBookButton bookId="b1" />);
    expect(screen.getByText('להזמין ספר מודפס').closest('a').getAttribute('href')).toBe('/book/b1/order');
  });
});

describe('address validation (Hebrew messages)', () => {
  it('empty ship form -> a message per required field, none for optional', () => {
    const e = validateAddress({}, 'ship');
    expect(Object.keys(e).sort()).toEqual(['city', 'fullName', 'houseNumber', 'phone', 'street']);
    expect(e.phone).toMatch(/050-1234567/);
    expect(e.zip).toBeUndefined();
  });
  it('accepts valid mobile formats and rejects landlines', () => {
    for (const p of ['050-1234567', '0501234567', '+972501234567', '972 50 123 4567']) expect(isValidPhone(p)).toBe(true);
    for (const p of ['03-1234567', '12345', '050-12345']) expect(isValidPhone(p)).toBe(false);
  });
  it('zip is optional but must be 7 digits when given', () => {
    expect(validateAddress({ ...FILLED, zip: '' }, 'ship')).toEqual({});
    expect(validateAddress({ ...FILLED, zip: '12345' }, 'ship').zip).toMatch(/7 ספרות/);
    expect(validateAddress({ ...FILLED, zip: '1234567' }, 'ship')).toEqual({});
  });
  it('pickup needs no address; normalizeAddress trims and formats the phone', () => {
    expect(validateAddress({}, 'pickup')).toEqual({});
    expect(normalizeAddress({ ...FILLED, phone: ' 0501234567 ', notes: '  ' }).phone).toBe('050-1234567');
    expect(normalizeAddress({ ...FILLED, notes: '  ' }).notes).toBeUndefined();
  });
});

describe('checkout states', () => {
  it('shows a loading skeleton, then step 1 with limits explained in words', async () => {
    let release;
    const api = mkApi({ getConfig: vi.fn(() => new Promise((r) => (release = r))) });
    checkout(api);
    expect(screen.getByRole('status', { name: 'טוענים' })).toBeTruthy();
    release({ enabled: true, pickup: { enabled: true, label_he: 'איסוף עצמי' }, maxQty: 2 });
    await screen.findByText('כמה עותקים להדפיס?');
    fireEvent.click(screen.getByLabelText('הוספת עותק'));
    expect(screen.getByLabelText('הוספת עותק')).toBeDisabled();
    expect(screen.getByTestId('qty-hint').textContent).toMatch(/הכמות המקסימלית/);
    expect(screen.getByText('משלוח סיפוראי')).toBeTruthy();
    expect(screen.getByText('איסוף עצמי')).toBeTruthy();
    expect(screen.getByText(/שלב 1 מתוך 3/)).toBeTruthy();
  });

  it('config error -> message with retry that works', async () => {
    const getConfig = vi.fn().mockRejectedValueOnce(new PrintOrderApiError({ code: 'network', message_he: 'אין חיבור' })).mockResolvedValue({ enabled: true, pickup: { enabled: false }, maxQty: 5 });
    checkout(mkApi({ getConfig }));
    await screen.findByText('אין חיבור לאינטרנט כרגע. בדקו את החיבור ונסו שוב.');
    fireEvent.click(screen.getByText('נסו שוב'));
    await screen.findByText('כמה עותקים להדפיס?');
    expect(screen.queryByText('איסוף עצמי')).toBeNull(); // pickup hidden when config disables it
  });

  it('feature disabled server-side -> calm message, no form', async () => {
    checkout(mkApi({ getConfig: vi.fn(async () => ({ enabled: false })) }));
    await screen.findByText(/עדיין לא זמינה/);
    expect(screen.queryByText('המשך')).toBeNull();
  });

  it('step 2: empty continue shows human errors next to fields and blocks the step', async () => {
    checkout(mkApi(), { initialStep: 2 });
    await screen.findByLabelText('טלפון נייד');
    expect(screen.getByLabelText('טלפון נייד').getAttribute('dir')).toBe('ltr');
    expect(screen.getByLabelText('טלפון נייד').getAttribute('inputmode')).toBe('tel');
    expect(screen.getByLabelText(/מיקוד/).getAttribute('inputmode')).toBe('numeric');
    fireEvent.click(screen.getByText('המשך'));
    expect(screen.getByTestId('addr-phone-error').textContent).toMatch(/050-1234567/);
    expect(screen.getByTestId('addr-fullName-error').textContent).toMatch(/שם פרטי ושם משפחה/);
    expect(screen.getByLabelText('טלפון נייד').getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByText(/שלב 2 מתוך 3/)).toBeTruthy();
  });

  it('step 3: price lines and total come from the quote only, plus the VAT/timing notes', async () => {
    checkout(mkApi(), { initialStep: 3, initialAddress: FILLED });
    await screen.findByTestId('price-lines');
    const text = screen.getByTestId('price-lines').textContent;
    expect(text).toMatch(/77\.77|77,77/); // 7777 agorot, straight from the quote
    expect(text).toMatch(/12\.34|12,34/);
    expect(screen.getByTestId('price-total').textContent).toMatch(/99\.99|99,99/); // not the 90.11 sum
    expect(screen.getByText('המחיר סופי, ללא תוספות')).toBeTruthy();
    expect(screen.getByText('ההדפסה מתחילה אחרי אישור התשלום.')).toBeTruthy();
    expect(screen.getByText(/הנרקיסים 12/)).toBeTruthy();
  });

  it('step 3: pay button is disabled with a written reason while there is no price', async () => {
    const api = mkApi({ getQuote: vi.fn(() => new Promise(() => {})) });
    checkout(api, { initialStep: 3, initialAddress: FILLED });
    await waitFor(() => expect(screen.getByTestId('disabled-reason').textContent).toMatch(/מחשבים את המחיר/));
    expect(screen.getByTestId('pay-button')).toBeDisabled();
  });

  it('step 3: quote failure -> alert with retry, button disabled with reason', async () => {
    const api = mkApi({ getQuote: vi.fn(async () => { throw new PrintOrderApiError({ message_he: 'לא הצלחנו לחשב מחיר כרגע.' }); }) });
    checkout(api, { initialStep: 3, initialAddress: FILLED });
    await screen.findByText('משהו השתבש. נסו שוב בעוד רגע.');
    expect(screen.getByTestId('pay-button')).toBeDisabled();
    expect(screen.getByTestId('disabled-reason').textContent).toMatch(/נסו שוב/);
  });
});

describe('creating the order', () => {
  it('double click sends ONE create call, with an idempotency key, then redirects', async () => {
    const redirect = vi.fn();
    const api = mkApi();
    checkout(api, { initialStep: 3, initialAddress: FILLED, redirect });
    const btn = await waitFor(() => {
      const b = screen.getByTestId('pay-button');
      expect(b).not.toBeDisabled();
      return b;
    });
    fireEvent.click(btn);
    fireEvent.click(btn);
    fireEvent.click(btn);
    await waitFor(() => expect(redirect).toHaveBeenCalledWith('https://pay.example/x'));
    expect(api.createOrder).toHaveBeenCalledTimes(1);
    const arg = api.createOrder.mock.calls[0][0];
    expect(arg.idempotencyKey).toMatch(/\S{8,}/);
    expect(arg).toMatchObject({ bookId: 'b1', qty: 1, method: 'ship', address: { fullName: 'דנה לוי', phone: '050-1234567' } });
    expect(redirect).toHaveBeenCalledTimes(1);
  });

  it('two activations in the same tick (before any re-render) still send ONE create call', async () => {
    const api = mkApi({ createOrder: vi.fn(() => new Promise(() => {})) });
    checkout(api, { initialStep: 3, initialAddress: FILLED });
    const btn = await waitFor(() => {
      const b = screen.getByTestId('pay-button');
      expect(b).not.toBeDisabled();
      return b;
    });
    act(() => {
      btn.click();
      btn.click();
    });
    expect(api.createOrder).toHaveBeenCalledTimes(1);
  });

  it('creating state: spinner text and disabled button while the request is pending', async () => {
    const api = mkApi({ createOrder: vi.fn(() => new Promise(() => {})) });
    checkout(api, { initialStep: 3, initialAddress: FILLED });
    const btn = await waitFor(() => {
      const b = screen.getByTestId('pay-button');
      expect(b).not.toBeDisabled();
      return b;
    });
    fireEvent.click(btn);
    await screen.findByText('מעבירים לתשלום…');
    expect(screen.getByTestId('pay-button')).toBeDisabled();
  });

  it('failure shows the error, and a retry reuses the SAME idempotency key', async () => {
    const createOrder = vi
      .fn()
      .mockRejectedValueOnce(new PrintOrderApiError({ code: 'network', message_he: 'אין חיבור לאינטרנט כרגע.' }))
      .mockResolvedValue({ orderId: 'o1', status: 'awaiting_payment', checkoutUrl: 'https://pay.example/x' });
    const api = mkApi({ createOrder });
    checkout(api, { initialStep: 3, initialAddress: FILLED });
    const btn = await waitFor(() => {
      const b = screen.getByTestId('pay-button');
      expect(b).not.toBeDisabled();
      return b;
    });
    fireEvent.click(btn);
    await screen.findByText('אין חיבור לאינטרנט כרגע. בדקו את החיבור ונסו שוב.');
    expect(screen.getByRole('alert').textContent).toMatch(/לא חויבתם|לא הצלחנו/);
    fireEvent.click(screen.getByTestId('pay-button'));
    await waitFor(() => expect(createOrder).toHaveBeenCalledTimes(2));
    expect(createOrder.mock.calls[1][0].idempotencyKey).toBe(createOrder.mock.calls[0][0].idempotencyKey);
  });
});

describe('my orders', () => {
  it('loading -> skeleton; empty -> illustration + guidance; error -> retry', async () => {
    let release;
    const api = mkApi({ getMyOrders: vi.fn(() => new Promise((r) => (release = r))) });
    wrap(<MyOrdersView api={api} />);
    expect(screen.getByRole('status', { name: 'טוענים את ההזמנות' })).toBeTruthy();
    release({ orders: [] });
    await screen.findByTestId('orders-empty');
    expect(screen.getByText('עדיין לא הזמנתם ספר מודפס')).toBeTruthy();
    cleanup();

    const bad = mkApi({ getMyOrders: vi.fn().mockRejectedValueOnce(new PrintOrderApiError({ message_he: 'אין חיבור' })).mockResolvedValue({ orders: [] }) });
    wrap(<MyOrdersView api={bad} />);
    await screen.findByText('אין חיבור');
    fireEvent.click(screen.getByText('נסו שוב'));
    await screen.findByTestId('orders-empty');
  });

  it('list shows Hebrew status labels and price; never the vendor', async () => {
    const orders = [
      { id: 'a', status: 'in_production', bookId: 'b', bookTitle: 'המסע', qty: 2, method: 'ship', totalAgorot: 18700, createdAt: '2026-11-06T09:00:00Z' },
      { id: 'b', status: 'ready_for_pickup', bookId: 'b', bookTitle: 'הדרקון', qty: 1, method: 'pickup', totalAgorot: 7900, createdAt: '2026-11-05T09:00:00Z' },
      { id: 'c', status: 'shipped', bookId: 'b', bookTitle: 'הגן', qty: 1, method: 'ship', totalAgorot: 10800, createdAt: '2026-11-04T09:00:00Z', trackingUrl: 'https://t.example/1' },
    ];
    wrap(<MyOrdersView api={mkApi({ getMyOrders: vi.fn(async () => ({ orders })) })} />);
    await screen.findByTestId('orders-list');
    expect(screen.getByText('בהדפסה')).toBeTruthy();
    expect(screen.getByText('מוכנה לאיסוף')).toBeTruthy();
    expect(screen.getByText('נשלחה אליך')).toBeTruthy();
    expect(screen.getByText('מעקב אחרי המשלוח').closest('a').getAttribute('href')).toBe('https://t.example/1');
    expect(document.body.textContent.toLowerCase()).not.toContain(['book', 'pod'].join(''));
  });

  it('return from payment: checking state, then success once the order is submitted', async () => {
    const getOrder = vi
      .fn()
      .mockResolvedValueOnce({ id: 'o1', status: 'awaiting_payment', createdAt: '2026-11-06T09:00:00Z', qty: 1, method: 'ship', totalAgorot: 100 })
      .mockResolvedValue({ id: 'o1', status: 'submitted', createdAt: '2026-11-06T09:00:00Z', qty: 1, method: 'ship', totalAgorot: 100 });
    wrap(<MyOrdersView api={mkApi({ getOrder })} paid orderId="o1" pollMs={20} />);
    await screen.findByTestId('payment-checking');
    expect(screen.getByText('מאמתים את התשלום…')).toBeTruthy();
    await screen.findByTestId('payment-success');
    expect(screen.getByText('התשלום התקבל, תודה!')).toBeTruthy();
  });
});

describe('admin', () => {
  it('403 -> polite message, no order controls', async () => {
    const api = mkApi({ adminList: vi.fn(async () => { throw new PrintOrderApiError({ code: 'forbidden', status: 403, message_he: 'x' }); }) });
    wrap(<AdminPrintOrdersView api={api} />);
    await screen.findByTestId('admin-403');
    expect(screen.getByText('אין לחשבון הזה הרשאת ניהול')).toBeTruthy();
    expect(screen.queryByTestId('admin-list')).toBeNull();
  });

  it('shows alerts banner, filters by status, runs actions; cancel needs explicit confirmation', async () => {
    const orders = [{ id: 'o9', status: 'failed_needs_attention', bookId: 'b', bookTitle: 'ספר', qty: 1, method: 'ship', totalAgorot: 10800, createdAt: '2026-11-06T09:00:00Z' }];
    const api = mkApi({ adminList: vi.fn(async () => ({ orders, alerts: ['הזמנה שולמה ולא נשלחה'] })) });
    wrap(<AdminPrintOrdersView api={api} />);
    await screen.findByTestId('admin-alerts');
    expect(screen.getByTestId('admin-alerts').textContent).toMatch(/הזמנה שולמה ולא נשלחה/);

    fireEvent.change(screen.getByLabelText('סינון לפי מצב'), { target: { value: 'paid' } });
    await waitFor(() => expect(api.adminList).toHaveBeenLastCalledWith('paid'));

    fireEvent.change(screen.getByLabelText(/הערה לפעולה/), { target: { value: 'בדקתי' } });
    fireEvent.click(await screen.findByText('לנסות שוב להעביר להדפסה'));
    await waitFor(() => expect(api.adminAction).toHaveBeenCalledWith({ id: 'o9', action: 'retry_submit', note: 'בדקתי' }));

    fireEvent.click(screen.getByText('ביטול ההזמנה'));
    expect(api.adminAction).toHaveBeenCalledTimes(1); // nothing cancelled yet
    expect(screen.getByTestId('cancel-confirm')).toBeTruthy();
    fireEvent.click(screen.getByText('כן, לבטל'));
    await waitFor(() => expect(api.adminAction).toHaveBeenLastCalledWith(expect.objectContaining({ action: 'cancel' })));
  });
});
