import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Home from '@/pages/Home';
import demoBooks from '@/data/demoBooks';

globalThis.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };

const state = vi.hoisted(() => ({ language: 'hebrew', user: { id: 'test-user' } }));
vi.mock('@/hooks/useCurrentUser', () => ({ useCurrentUser: () => ({ user: state.user }) }));
vi.mock('@/entities/Book', () => ({ Book: { filter: vi.fn(async () => []) } }));
vi.mock('@/hooks/useGamification', () => ({ default: () => ({ badges: [], awardXP: vi.fn() }) }));
vi.mock('@/lib/dailyPrompt', () => ({ getDailyPrompt: vi.fn(async () => ({ title: 'רעיון', description: 'סיפור' })) }));
vi.mock('@/components/onboarding/OnboardingWizard', () => ({ default: () => null }));
vi.mock('@/components/i18n/i18nProvider', async () => {
  const he = (await import('@/components/i18n/locales/he')).default;
  const en = (await import('@/components/i18n/locales/en')).default;
  he.homeLegacy = (await import('@/components/i18n/locales/he/home')).default.homeLegacy;
  en.homeLegacy = (await import('@/components/i18n/locales/en/home')).default.homeLegacy;
  return { useI18n: () => ({ language: state.language, isRTL: state.language === 'hebrew', t: (key) => key.split('.').reduce((obj, part) => obj?.[part], state.language === 'hebrew' ? he : en) || key }) };
  it('shows English demo copy for English users', async () => {
    state.language = 'english';
    render(<MemoryRouter><Home /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText(demoBooks[0].title.en)).toBeInTheDocument());
    expect(screen.getByText('Lily discovers a secret garden and meets a dragon looking for friends.')).toBeInTheDocument();
    expect(screen.getByText('Guest')).toBeInTheDocument();
  });
});

describe('legacy home samples', () => {
  beforeEach(() => { localStorage.setItem('onboarding_complete', 'true'); state.language = 'hebrew'; });
  it('renders the three demo titles and covers in Hebrew and uses sample creation links', async () => {
    render(<MemoryRouter><Home /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText(demoBooks[0].title.he)).toBeInTheDocument());
    for (const book of demoBooks) {
      expect(screen.getByText(book.title.he)).toBeInTheDocument();
      expect(screen.getByAltText(book.title.he)).toHaveAttribute('src', book.cover_image);
      expect(screen.queryByText(book.title.en)).not.toBeInTheDocument();
    }
    expect(screen.queryByText("The Dragon's Quest")).not.toBeInTheDocument();
    expect(screen.getByText('אורח')).toBeInTheDocument();
    expect(screen.queryByText('Guest')).not.toBeInTheDocument();
    expect(screen.getByText('מדע בדיוני')).toBeInTheDocument();
    expect(screen.getByText('לילי מגלה גן סודי ופוגשת דרקון שמחפש חברים.')).toBeInTheDocument();
    expect(screen.getAllByRole('link').filter(link => link.getAttribute('href') === '/BookWizard').length).toBeGreaterThanOrEqual(3);
  });
  it('shows English demo copy for English users', async () => {
    state.language = 'english';
    render(<MemoryRouter><Home /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText(demoBooks[0].title.en)).toBeInTheDocument());
    expect(screen.getByText('Lily discovers a secret garden and meets a dragon looking for friends.')).toBeInTheDocument();
    expect(screen.getByText('Guest')).toBeInTheDocument();
  });
});
