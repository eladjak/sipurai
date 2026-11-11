import { afterEach, describe, it, expect } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { I18nContext, LANGUAGES } from '@/components/i18n/i18nProvider';
import { MemoryRouter } from 'react-router-dom';
import { Stepper } from '../Stepper';
import { MethodCards } from '../MethodCards';
import { PriceLines, PaymentNotes } from '../SummaryCard';
import { PaymentReturn } from '../PaymentReturn';

const t = (key, values = {}) => {
  const value = key.split('.').reduce((v, part) => v?.[part], LANGUAGES.english.translations);
  return typeof value === 'string' ? value.replace(/\{(\w+)\}/g, (_, k) => values[k] ?? '') : value;
};
const wrap = (ui) => render(<I18nContext.Provider value={{ t, language: 'english', direction: 'ltr' }}><MemoryRouter>{ui}</MemoryRouter></I18nContext.Provider>);
afterEach(cleanup);
describe('English checkout copy', () => {
  it('translates the step indicator', () => { wrap(<Stepper current={1} />); expect(screen.getByRole('navigation', { name: 'Order steps' })).toBeInTheDocument(); });
  it('translates delivery choices', () => { wrap(<MethodCards value="ship" pickup={{ enabled: true, label_he: 'איסוף עצמי' }} onChange={() => {}} />); expect(screen.getByText('Home delivery')).toBeInTheDocument(); expect(screen.getByText('Pickup')).toBeInTheDocument(); });
  it('translates quote labels and notes', () => { wrap(<><PriceLines quote={{ qty: 1, method: 'ship', totalAgorot: 100, lines: [{ key: 'book', label_he: 'ספר מודפס', amountAgorot: 100 }] }} /><PaymentNotes /></>); expect(screen.getByText('Printed book')).toBeInTheDocument(); expect(screen.getByText('Total to pay')).toBeInTheDocument(); });
  it('translates the payment return waiting state', () => { wrap(<PaymentReturn api={{getOrder: () => new Promise(() => {})}} orderId="1" />); expect(screen.getByText('Checking your payment…')).toBeInTheDocument(); });
});

it('renders checkout and its unknown server errors in English', async () => {
  const { PrintCheckoutView } = await import('@/pages/PrintCheckout');
  wrap(<PrintCheckoutView bookId="b" persist={false} api={{ getConfig: async () => { throw { message_he: 'סוד שגיאה' }; } }} />);
  expect(await screen.findByText('Could not load your order')).toBeInTheDocument();
  expect(screen.getByText('Something went wrong. Please try again.')).toBeInTheDocument();
  expect(screen.queryByText('סוד שגיאה')).not.toBeInTheDocument();
});

it('renders the order entry button in English', async () => {
  const { vi } = await import('vitest');
  const { OrderBookButton } = await import('../OrderBookButton');
  vi.stubEnv('VITE_PRINT_ORDER_ENABLED', 'true');
  wrap(<OrderBookButton bookId="b" />);
  expect(screen.getByRole('link', { name: 'Order a printed book' })).toBeInTheDocument();
  vi.unstubAllEnvs();
});

it('explains uncertain payment status in English when checkout cannot open', async () => {
  const { fireEvent, waitFor } = await import('@testing-library/react');
  const { PrintCheckoutView } = await import('@/pages/PrintCheckout');
  const api = {
    getConfig: async () => ({ enabled: true, pickup: { enabled: false }, maxQty: 5 }),
    getQuote: async () => ({ qty: 1, method: 'ship', lines: [], totalAgorot: 100 }),
    createOrder: async () => ({}),
  };
  wrap(<PrintCheckoutView bookId="b" api={api} persist={false} initialStep={3} initialAddress={{ fullName: 'Dana Levy', phone: '0501234567', city: 'Haifa', street: 'Main', houseNumber: '12' }} quoteDebounceMs={0} redirect={() => {}} />);
  await waitFor(() => expect(screen.getByTestId('pay-button')).not.toBeDisabled());
  fireEvent.click(screen.getByTestId('pay-button'));
  expect(await screen.findByText('We could not confirm the payment status. Check your orders before trying again.')).toBeInTheDocument();
});
