import { afterEach, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nContext, LANGUAGES } from '@/components/i18n/i18nProvider';
import { MyOrdersView } from '@/pages/MyOrders';
import { AdminPrintOrdersView } from '@/pages/AdminPrintOrders';

const t = (key, values = {}) => {
  const value = key.split('.').reduce((v, part) => v?.[part], LANGUAGES.english.translations);
  return typeof value === 'string' ? value.replace(/\{(\w+)\}/g, (_, k) => values[k] ?? '') : value;
};
const wrap = (ui) => render(<I18nContext.Provider value={{ t, language: 'english', direction: 'ltr' }}><MemoryRouter>{ui}</MemoryRouter></I18nContext.Provider>);
afterEach(cleanup);
const order = { id: '1', status: 'shipped', statusLabel_he: 'נשלח', bookTitle: 'Story', qty: 1, method: 'ship', totalAgorot: 100, createdAt: '2026-01-01', trackingUrl: 'https://example.com' };
it('renders order details and statuses in English', async () => {
  wrap(<MyOrdersView api={{ getMyOrders: async () => ({ orders: [order] }) }} />);
  expect(await screen.findByText('Shipped')).toBeInTheDocument();
  expect(screen.getByText('Track delivery')).toBeInTheDocument();
  expect(screen.getByText('January 1, 2026')).toBeInTheDocument();
  expect(screen.queryByText('נשלח')).not.toBeInTheDocument();
});
it('maps network and unknown order errors without exposing server text', async () => {
  wrap(<MyOrdersView api={{ getMyOrders: async () => { throw { message_he: 'סוד', code: 'unknown' }; } }} />);
  expect(await screen.findByText('Something went wrong. Please try again.')).toBeInTheDocument();
  expect(screen.queryByText('סוד')).not.toBeInTheDocument();
});
it('renders admin orders and actions in English', async () => {
  wrap(<AdminPrintOrdersView api={{ adminList: async () => ({ orders: [order], alerts: [] }) }} />);
  expect(await screen.findByText('Print orders administration')).toBeInTheDocument();
  expect(await screen.findByText('Copies')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Cancel order' })).toBeInTheDocument();
});
