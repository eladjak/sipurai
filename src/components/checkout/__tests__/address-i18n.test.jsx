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
