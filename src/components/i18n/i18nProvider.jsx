import React, { createContext, useState, useEffect, useLayoutEffect, useContext } from 'react';
import { User } from "@/entities/User";
import { isHidden, isBeta } from "./languageStatus";

// Import translations
import hebrewTranslations from './locales/he';
import englishTranslations from './locales/en';
import yiddishTranslations from './locales/yi';

// Each fragment owns distinct top-level namespaces.
export function mergeLocaleFragments(main, fragments) {
  const merged = { ...main };
  for (const fragment of fragments) {
    for (const [namespace, value] of Object.entries(fragment)) {
      if (Object.prototype.hasOwnProperty.call(merged, namespace) && (import.meta.env.DEV || import.meta.env.MODE === 'test')) {
        throw new Error(`[i18n] duplicate namespace: ${namespace}`);
      }
      merged[namespace] = value;
    }
  }
  return merged;
}

const fragments = import.meta.glob('./locales/*/*.js', { eager: true });
/** @param {string} code
 * @param {object} main
 * @param {Record<string, {default: object}>} modules
 */
export const loadLocaleFragments = (code, main, modules) => mergeLocaleFragments(main,
  Object.entries(modules).filter(([path]) => path.startsWith(`./locales/${code}/`)).map(([, module]) => module.default));
const withFragments = (code, main) => loadLocaleFragments(code, main, /** @type {Record<string, {default: object}>} */ (fragments));
const warnedKeys = new Set();

// Create context
export const I18nContext = createContext();

// Available languages with their details
export const LANGUAGES = {
  english: {
    code: 'en',
    name: 'English',
    direction: 'ltr',
    translations: withFragments('en', englishTranslations)
  },
  hebrew: {
    code: 'he',
    name: 'עברית',
    direction: 'rtl',
    translations: withFragments('he', hebrewTranslations)
  },
  yiddish: {
    code: 'yi',
    name: 'ייִדיש',
    direction: 'rtl',
    translations: withFragments('yi', yiddishTranslations)
  }
};

// Read language from localStorage synchronously so the very first render
// already uses the correct language/direction, preventing a flash of LTR
// content for Hebrew/Yiddish users.
function getInitialLanguage() {
  try {
    const saved = localStorage.getItem('language');
    if (saved && LANGUAGES[saved]) return saved;
  } catch {
    // localStorage not available (SSR / tests)
  }
  const browserLang = typeof navigator === 'undefined' ? '' : navigator.language || navigator.userLanguage || '';
  return browserLang.toLowerCase().startsWith('en') ? 'english' : 'hebrew';
}

export const I18nProvider = ({ children }) => {
  const _initialLang = getInitialLanguage();
  const [language, setLanguage] = useState(_initialLang);
  const [translations, setTranslations] = useState(LANGUAGES[_initialLang].translations);
  const [direction, setDirection] = useState(LANGUAGES[_initialLang].direction);
  const [loading, setLoading] = useState(true);
  const [isReady, setIsReady] = useState(false);

  // Apply language settings to document
  const applyLanguageSettings = (lang) => {
    const langConfig = LANGUAGES[lang];
    if (!langConfig) return;

    document.documentElement.dir = langConfig.direction;
    document.documentElement.lang = langConfig.code;

    // Force RTL/LTR on body as well for deeper styling control
    document.body.setAttribute('dir', langConfig.direction);
    document.body.classList.remove('rtl', 'ltr');
    document.body.classList.add(langConfig.direction);
  };

  // Apply saved language to the document synchronously before first paint,
  // so Hebrew/Yiddish users don't see a flash of LTR layout.
  useLayoutEffect(() => {
    applyLanguageSettings(_initialLang);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load user language preference
  useEffect(() => {
    const loadLanguagePreference = async () => {
      try {
        // Try to load from localStorage first for immediate feedback
        const savedLanguage = localStorage.getItem('language');
        if (savedLanguage && LANGUAGES[savedLanguage]) {
          setLanguage(savedLanguage);
          setTranslations(LANGUAGES[savedLanguage].translations);
          setDirection(LANGUAGES[savedLanguage].direction);
          applyLanguageSettings(savedLanguage);
        } else {
          // First visit: auto-detect from browser
          const detected = getInitialLanguage();
          setLanguage(detected);
          setTranslations(LANGUAGES[detected].translations);
          setDirection(LANGUAGES[detected].direction);
          applyLanguageSettings(detected);
          // Do NOT save to localStorage yet — let the user confirm via settings
        }

        // Then check user settings from backend
        const user = await User.me();
        // Support both field names: 'language' (canonical) and 'preferred_language' (onboarding legacy)
        const userLang = user?.language || user?.preferred_language;
        if (user && userLang && LANGUAGES[userLang]) {
          setLanguage(userLang);
          setTranslations(LANGUAGES[userLang].translations);
          setDirection(LANGUAGES[userLang].direction);
          applyLanguageSettings(userLang);

          // Update localStorage to match user settings
          localStorage.setItem('language', userLang);
        }
      } catch (error) {
        // silently handled
      } finally {
        setLoading(false);
        setIsReady(true);
      }
    };

    loadLanguagePreference();
  }, []);

  // Change language function
  const changeLanguage = async (newLanguage) => {
    if (!LANGUAGES[newLanguage]) return;

    setLanguage(newLanguage);
    setTranslations(LANGUAGES[newLanguage].translations);
    setDirection(LANGUAGES[newLanguage].direction);
    applyLanguageSettings(newLanguage);
    
    // Save to localStorage for immediate access on reload
    localStorage.setItem('language', newLanguage);
    
    // Save to user profile
    try {
      await User.updateMyUserData({ language: newLanguage });
    } catch (error) {
      // silently handled
    }
  };

  // Translation function
  const t = (key, replacements = {}) => {
    if (!key) return '';
    
    const lookup = (source) => key.split('.').reduce((value, part) => value?.[part], source);
    let value = [translations, LANGUAGES.hebrew.translations, LANGUAGES.english.translations]
      .map(lookup).find((candidate) => candidate !== undefined && candidate !== null);
    if (value === undefined) {
      if ((import.meta.env.DEV || import.meta.env.MODE === 'test') && !warnedKeys.has(key)) {
        warnedKeys.add(key);
        console.warn('[i18n] missing', key);
      }
      return '';
    }
    if (typeof value === 'string') {
      value = value.replace(/\{\{(\w+)\}\}|\{(\w+)\}/g, (original, double, single) => {
        const name = double || single;
        return replacements[name] !== undefined ? replacements[name] : original;
      });
    }

    return value;
  };

  return (
    <I18nContext.Provider value={{
      language,
      direction,
      isRTL: direction === 'rtl',
      changeLanguage,
      t,
      loading,
      isReady,
      languages: Object.fromEntries(Object.entries(LANGUAGES)
        .filter(([name]) => !isHidden(name) || name === language)
        .map(([name, config]) => [name, { ...config, beta: isBeta(name) }]))
    }}>
      {children}
    </I18nContext.Provider>
  );
};

// Custom hook to use the i18n context
export const useI18n = () => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
};