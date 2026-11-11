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

it('renders a separated note label and the translated cancellation question', async () => {
  const { fireEvent } = await import('@testing-library/react');
  wrap(<AdminPrintOrdersView api={{ adminList: async () => ({ orders: [{ ...order, status: 'paid' }], alerts: [] }) }} />);
  const note = await screen.findByLabelText('Action note (optional, saved in history)');
  expect(note).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Cancel order' }));
  expect(screen.getByText('Cancel this order?')).toBeInTheDocument();
});

it('uses the configured status label key when rendering a badge', async () => {
  const { STATUS_META } = await import('../statusMeta');
  const { StatusBadge } = await import('../OrderCard');
  const original = STATUS_META.shipped.labelKey;
  STATUS_META.shipped.labelKey = STATUS_META.paid.labelKey;
  try { wrap(<StatusBadge status="shipped" />); expect(screen.getByText('Paid, preparing to print')).toBeInTheDocument(); }
  finally { STATUS_META.shipped.labelKey = original; }
});

it('explains when a customer must sign in again', async () => {
  wrap(<MyOrdersView api={{ getMyOrders: async () => { throw { code: 'unauthorized' }; } }} />);
  expect(await screen.findByText('Please sign in again.')).toBeInTheDocument();
});

it.each([
  ['awaiting_payment', 'Awaiting payment'], ['paid', 'Paid, preparing to print'],
  ['submitting', 'Sending to print'], ['submitted', 'Sent to print'],
  ['in_production', 'Printing'], ['shipped', 'Shipped'],
  ['ready_for_pickup', 'Ready for pickup'], ['cancelled', 'Cancelled'],
  ['failed_needs_attention', 'Needs our attention'], ['unrecognized', 'Being handled'],
])('renders the %s status in English', async (status, label) => {
  const { StatusBadge } = await import('../OrderCard');
  wrap(<StatusBadge status={status} />);
  expect(screen.getByText(label)).toBeInTheDocument();
});

it('shows the admin action refusal and cancellation confirmation', async () => {
  const { fireEvent } = await import('@testing-library/react');
  wrap(<AdminPrintOrdersView api={{ adminList: async () => ({ orders: [{ ...order, status: 'paid' }], alerts: [] }), adminAction: async () => { throw { code: 'forbidden' }; } }} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Cancel order' }));
  expect(screen.getByText('Cancel this order?')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Yes, cancel' }));
  expect(await screen.findByText('You do not have permission to do this.')).toBeInTheDocument();
});

it('renders the admin empty state and alerts', async () => {
  wrap(<AdminPrintOrdersView api={{ adminList: async () => ({ orders: [], alerts: ['Example alert'] }) }} />);
  expect(await screen.findByText('No orders with this status')).toBeInTheDocument();
  expect(screen.getByText('Example alert')).toBeInTheDocument();
  expect(screen.getByText('Needs attention: one paid order has not been sent to print')).toBeInTheDocument();
});

it('renders the admin forbidden state', async () => {
  wrap(<AdminPrintOrdersView api={{ adminList: async () => { throw { code: 'forbidden' }; } }} />);
  expect(await screen.findByText('This account does not have administrator access')).toBeInTheDocument();
});

it('formats an English admin amount using English currency conventions', async () => {
  wrap(<AdminPrintOrdersView api={{ adminList: async () => ({ orders: [order], alerts: [] }) }} />);
  const card = await screen.findByTestId('admin-order');
  const amount = card.querySelector('dd[dir="ltr"]');
  const expected = new Intl.NumberFormat('en-IL', { style: 'currency', currency: 'ILS', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(1);
  expect(amount.textContent).toBe(expected);
});
