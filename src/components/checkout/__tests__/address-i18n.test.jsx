import { describe, it, expect } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import { I18nContext, LANGUAGES } from '@/components/i18n/i18nProvider';
import { AddressForm } from '../AddressForm';

afterEach(cleanup);

describe('shipping address language', () => {
  it('shows English instructions and a telephone-ready input', () => {
    const t = (key) => key.split('.').reduce((v, part) => v?.[part], LANGUAGES.english.translations);
    render(<I18nContext.Provider value={{ t, language: 'english', direction: 'ltr' }}><AddressForm values={{}} onChange={() => {}} errors={{}} shown={{}} /></I18nContext.Provider>);
    const phone = screen.getByLabelText('Mobile phone');
    expect(phone).toHaveAttribute('dir', 'ltr');
    expect(phone).toHaveAttribute('inputmode', 'tel');
    expect(phone).toHaveAttribute('autocomplete', 'tel');
    expect(screen.getByText(/courier will call/i)).toBeInTheDocument();
  });
});

it('renders the page shell in the selected language and direction', async () => {
  const { PageShell } = await import('../ui');
  const { MemoryRouter } = await import('react-router-dom');
  const t = (key) => key.split('.').reduce((v, part) => v?.[part], LANGUAGES.english.translations);
  const { container } = render(<I18nContext.Provider value={{ t, language: 'english', direction: 'ltr' }}><MemoryRouter><PageShell title="Checkout" /></MemoryRouter></I18nContext.Provider>);
  expect(container.firstChild).toHaveAttribute('dir', 'ltr');
  expect(container.firstChild).toHaveAttribute('lang', 'en');
});

it('returns English address validation instructions', async () => {
  const { validateAddress } = await import('../validation');
  const t = (key) => key.split('.').reduce((v, part) => v?.[part], LANGUAGES.english.translations);
  expect(validateAddress({}, 'ship', t).phone).toMatch(/mobile phone/i);
});

it('shows the empty orders page in English', async () => {
  const { MyOrdersView } = await import('@/pages/MyOrders');
  const { MemoryRouter } = await import('react-router-dom');
  const t = (key) => key.split('.').reduce((v, part) => v?.[part], LANGUAGES.english.translations);
  render(<I18nContext.Provider value={{ t, language: 'english', direction: 'ltr' }}><MemoryRouter><MyOrdersView api={{ getMyOrders: async () => ({ orders: [] }) }} /></MemoryRouter></I18nContext.Provider>);
  expect(await screen.findByText('You haven’t ordered a printed book yet')).toBeInTheDocument();
});
