import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/entities/User', () => ({
  User: {
    me: vi.fn(),
    updateMyUserData: vi.fn(),
    _setClerkUser: vi.fn(),
    logout: vi.fn(),
  },
}));

import { User } from '@/entities/User';
const mockUserMe = User.me;
const mockUpdateMyUserData = User.updateMyUserData;

// ---------------------------------------------------------------------------
// Imports under test (after mocks)
// ---------------------------------------------------------------------------

import { I18nProvider, useI18n, LANGUAGES } from './i18nProvider';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** A minimal consumer component that renders selected i18n context values */
function Consumer({ translationKey }) {
  const { language, direction, isRTL, t, changeLanguage, isReady } = useI18n();
  return (
    <div>
      <span data-testid="language">{language}</span>
      <span data-testid="direction">{direction}</span>
      <span data-testid="is-rtl">{String(isRTL)}</span>
      <span data-testid="translation">{t(translationKey ?? 'common.loading')}</span>
      <span data-testid="is-ready">{String(isReady)}</span>
      <button
        data-testid="switch-hebrew"
        onClick={() => changeLanguage('hebrew')}
      >
        Switch to Hebrew
      </button>
      <button
        data-testid="switch-english"
        onClick={() => changeLanguage('english')}
      >
        Switch to English
      </button>
      <button
        data-testid="switch-yiddish"
        onClick={() => changeLanguage('yiddish')}
      >
        Switch to Yiddish
      </button>
    </div>
  );
}

function renderWithProvider(props = {}) {
  return render(
    <I18nProvider>
      <Consumer {...props} />
    </I18nProvider>
  );
}

// ---------------------------------------------------------------------------
// Test setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  // Default: no authenticated user
  mockUserMe.mockResolvedValue(null);
  mockUpdateMyUserData.mockResolvedValue(undefined);
});

afterEach(() => {
  localStorage.clear();
});

// ---------------------------------------------------------------------------
// 1. Default language
// ---------------------------------------------------------------------------

describe('I18nProvider - default language', () => {
  it('defaults to English when no localStorage key and no user preference', async () => {
    renderWithProvider();

    await waitFor(() => {
      expect(screen.getByTestId('language').textContent).toBe('english');
    });

    expect(screen.getByTestId('direction').textContent).toBe('ltr');
    expect(screen.getByTestId('is-rtl').textContent).toBe('false');
  });

  it('reads language preference from localStorage on mount', async () => {
    localStorage.setItem('language', 'hebrew');

    renderWithProvider();

    await waitFor(() => {
      expect(screen.getByTestId('language').textContent).toBe('hebrew');
    });

    expect(screen.getByTestId('direction').textContent).toBe('rtl');
    expect(screen.getByTestId('is-rtl').textContent).toBe('true');
  });

  it('becomes ready after async initialization', async () => {
    renderWithProvider();

    await waitFor(() => {
      expect(screen.getByTestId('is-ready').textContent).toBe('true');
    });
  });
});

// ---------------------------------------------------------------------------
// 2. t() function
// ---------------------------------------------------------------------------

describe('I18nProvider - t() translation function', () => {
  it('returns English string for common.loading key by default', async () => {
    renderWithProvider({ translationKey: 'common.loading' });

    await waitFor(() => {
      expect(screen.getByTestId('translation').textContent).toBe('Loading...');
    });
  });

  it('returns the key itself for a missing translation key', async () => {
    renderWithProvider({ translationKey: 'nonexistent.key' });

    await waitFor(() => {
      expect(screen.getByTestId('translation').textContent).toBe('nonexistent.key');
    });
  });

  it('returns empty string for an empty key', async () => {
    renderWithProvider({ translationKey: '' });

    await waitFor(() => {
      expect(screen.getByTestId('translation').textContent).toBe('');
    });
  });

  it('handles nested dot-notation keys', async () => {
    renderWithProvider({ translationKey: 'common.save' });

    await waitFor(() => {
      expect(screen.getByTestId('translation').textContent).toBe('Save');
    });
  });
});

// ---------------------------------------------------------------------------
// 3. Language switch
// ---------------------------------------------------------------------------

describe('I18nProvider - changeLanguage', () => {
  it('switching to Hebrew updates language and direction', async () => {
    renderWithProvider();

    await waitFor(() => {
      expect(screen.getByTestId('is-ready').textContent).toBe('true');
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('switch-hebrew'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('language').textContent).toBe('hebrew');
      expect(screen.getByTestId('direction').textContent).toBe('rtl');
      expect(screen.getByTestId('is-rtl').textContent).toBe('true');
    });
  });

  it('switching to English from Hebrew sets ltr direction', async () => {
    localStorage.setItem('language', 'hebrew');
    renderWithProvider();

    await waitFor(() => {
      expect(screen.getByTestId('language').textContent).toBe('hebrew');
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('switch-english'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('language').textContent).toBe('english');
      expect(screen.getByTestId('direction').textContent).toBe('ltr');
    });
  });

  it('persists new language to localStorage', async () => {
    renderWithProvider();

    await waitFor(() => {
      expect(screen.getByTestId('is-ready').textContent).toBe('true');
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('switch-hebrew'));
    });

    await waitFor(() => {
      expect(localStorage.getItem('language')).toBe('hebrew');
    });
  });

  it('updates the language state after language switch', async () => {
    renderWithProvider({ translationKey: 'common.loading' });

    await waitFor(() => {
      // English default: "Loading..."
      expect(screen.getByTestId('translation').textContent).toBe('Loading...');
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('switch-hebrew'));
    });

    await waitFor(() => {
      // After switching, the translation for 'common.loading' in Hebrew
      // should return a non-empty string (either translated or the key)
      const translated = screen.getByTestId('translation').textContent;
      expect(typeof translated).toBe('string');
      expect(translated.length).toBeGreaterThan(0);
      // The language state must have changed
      expect(screen.getByTestId('language').textContent).toBe('hebrew');
    });
  });
});

// ---------------------------------------------------------------------------
// 4. RTL direction for Hebrew and Yiddish
// ---------------------------------------------------------------------------

describe('I18nProvider - RTL direction', () => {
  it('Hebrew language sets isRTL = true and direction = rtl', async () => {
    renderWithProvider();

    await waitFor(() => {
      expect(screen.getByTestId('is-ready').textContent).toBe('true');
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('switch-hebrew'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('is-rtl').textContent).toBe('true');
      expect(screen.getByTestId('direction').textContent).toBe('rtl');
    });
  });

  it('Yiddish language sets isRTL = true and direction = rtl', async () => {
    renderWithProvider();

    await waitFor(() => {
      expect(screen.getByTestId('is-ready').textContent).toBe('true');
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('switch-yiddish'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('is-rtl').textContent).toBe('true');
      expect(screen.getByTestId('direction').textContent).toBe('rtl');
    });
  });

  it('English language sets isRTL = false and direction = ltr', async () => {
    renderWithProvider();

    await waitFor(() => {
      expect(screen.getByTestId('is-rtl').textContent).toBe('false');
      expect(screen.getByTestId('direction').textContent).toBe('ltr');
    });
  });
});

// ---------------------------------------------------------------------------
// 5. User backend preference overrides localStorage
// ---------------------------------------------------------------------------

describe('I18nProvider - user backend preference', () => {
  it('uses user.language from backend if available', async () => {
    localStorage.setItem('language', 'english');
    mockUserMe.mockResolvedValue({ email: 'u@example.com', language: 'hebrew' });

    renderWithProvider();

    await waitFor(() => {
      // Backend preference (hebrew) should win over localStorage (english)
      expect(screen.getByTestId('language').textContent).toBe('hebrew');
    });
  });

  it('keeps localStorage language when user has no language preference', async () => {
    localStorage.setItem('language', 'hebrew');
    mockUserMe.mockResolvedValue({ email: 'u@example.com' }); // no .language field

    renderWithProvider();

    await waitFor(() => {
      expect(screen.getByTestId('language').textContent).toBe('hebrew');
    });
  });
});

// ---------------------------------------------------------------------------
// 6. useI18n throws when used outside provider
// ---------------------------------------------------------------------------

describe('useI18n - outside provider', () => {
  it('throws when used without I18nProvider', () => {
    // Suppress expected React error output
    vi.spyOn(console, 'error').mockImplementation(() => {});

    function NoProvider() {
      useI18n(); // should throw
      return null;
    }

    expect(() => render(<NoProvider />)).toThrow(
      'useI18n must be used within an I18nProvider'
    );
  });
});

// ---------------------------------------------------------------------------
// 7. LANGUAGES config
// ---------------------------------------------------------------------------

describe('LANGUAGES config', () => {
  it('exposes english, hebrew, yiddish', () => {
    expect(LANGUAGES).toHaveProperty('english');
    expect(LANGUAGES).toHaveProperty('hebrew');
    expect(LANGUAGES).toHaveProperty('yiddish');
  });

  it('Hebrew and Yiddish are RTL', () => {
    expect(LANGUAGES.hebrew.direction).toBe('rtl');
    expect(LANGUAGES.yiddish.direction).toBe('rtl');
  });

  it('English is LTR', () => {
    expect(LANGUAGES.english.direction).toBe('ltr');
  });

  it('each language has a translations object', () => {
    for (const lang of Object.values(LANGUAGES)) {
      expect(lang.translations).toBeDefined();
      expect(typeof lang.translations).toBe('object');
    }
  });
});
