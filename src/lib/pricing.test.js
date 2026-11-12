import { describe, it, expect } from 'vitest';
import { resolveCurrency, formatPrice, canCheckout, PRICE_POINTS } from './pricing';

describe('resolveCurrency', () => {
  it('hebrew -> ILS', () => expect(resolveCurrency({ language: 'hebrew', timeZone: 'Europe/London' })).toBe('ILS'));
  it('yiddish -> ILS', () => expect(resolveCurrency({ language: 'yiddish', timeZone: 'America/New_York' })).toBe('ILS'));
  it('english + Asia/Jerusalem -> ILS', () => expect(resolveCurrency({ language: 'english', timeZone: 'Asia/Jerusalem' })).toBe('ILS'));
  it('english + Asia/Tel_Aviv -> ILS', () => expect(resolveCurrency({ language: 'english', timeZone: 'Asia/Tel_Aviv' })).toBe('ILS'));
  it('english + Europe/London -> USD', () => expect(resolveCurrency({ language: 'english', timeZone: 'Europe/London' })).toBe('USD'));
  it('no input -> USD', () => expect(resolveCurrency()).toBe('USD'));
});

describe('formatPrice', () => {
  it('ILS strings', () => {
    expect(formatPrice('free', 'ILS')).toBe('0 ₪');
    expect(formatPrice('lite', 'ILS')).toBe('14.90 ₪');
    expect(formatPrice('premium', 'ILS')).toBe('29 ₪');
    expect(formatPrice('family', 'ILS')).toBe('39 ₪');
  });
  it('USD strings', () => {
    expect(formatPrice('free', 'USD')).toBe('$0');
    expect(formatPrice('lite', 'USD')).toBe('$3.90');
    expect(formatPrice('premium', 'USD')).toBe('$7.90');
    expect(formatPrice('family', 'USD')).toBe('$9.90');
  });
  it('USD matches live Creem price points', () => {
    expect(PRICE_POINTS.USD).toEqual({ free: 0, lite: 3.9, premium: 7.9, family: 9.9 });
  });
});

describe('canCheckout', () => {
  it('USD open', () => expect(canCheckout('USD')).toBe(true));
  it('ILS closed by default', () => expect(canCheckout('ILS')).toBe(false));
});
