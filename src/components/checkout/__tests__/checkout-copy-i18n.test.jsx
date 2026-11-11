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
