/**
 * SEO utilities for Sipurai — sipurai.ai
 *
 * Usage:
 *   import { updateMeta, resetMeta, useSEO } from '@/lib/seo';
 *
 *   // In a page component:
 *   useSEO('Home');
 *
 *   // Or with custom overrides:
 *   useSEO('BookWizard', { title: 'יוצרים ספר חדש' });
 *
 *   // Or call imperatively (no React):
 *   updateMeta({ title: '...', description: '...', image: '...' });
 */

import { useEffect } from 'react';

const BASE_URL = 'https://www.sipurai.ai';
const DEFAULT_IMAGE = `${BASE_URL}/images/hero-banner.jpg`;

/** Per-route SEO metadata (Hebrew-first). */
export const PAGE_META = {
  // Public / landing
  LandingPage: {
    title: 'סיפוראי — ספרי ילדים מותאמים אישית עם AI',
    description:
      'הילד בוחר דמויות, סגנון ואיורים — וה-AI יוצר ספר ילדים שלם עם סיפור מקורי. בעברית, אנגלית ויידיש.',
    url: `${BASE_URL}/`,
  },

  // Core product pages
  Home: {
    title: 'הבית שלי — הספרים שלי',
    description:
      'כל הספרים שיצרת, ההישגים שלך ופעילות הקהילה — הכל במקום אחד.',
    url: `${BASE_URL}/Home`,
  },
  BookWizard: {
    title: 'יוצרים ספר חדש',
    description:
      'בחרו דמויות, סגנון איור, שפה וז׳אנר — ה-AI יכתוב ויאייר ספר ילדים שלם תוך דקות.',
    url: `${BASE_URL}/BookWizard`,
  },
  Library: {
    title: 'הספרייה שלי',
    description:
      'כל הספרים שיצרת במקום אחד. קראו, ערכו, שתפו או הורידו כ-PDF.',
    url: `${BASE_URL}/Library`,
  },
  Characters: {
    title: 'הדמויות שלי',
    description:
      'נהלו את הדמויות שלכם — בני אדם, בעלי חיים ובני דמיון. כל דמות ניתנת לשימוש בכל ספר.',
    url: `${BASE_URL}/Characters`,
  },
  Community: {
    title: 'קהילת סיפוראי',
    description:
      'ספרים שיצרו ילדים ומשפחות מרחבי העולם. השראה, לייקים ועוד.',
    url: `${BASE_URL}/Community`,
  },
  StoryIdeas: {
    title: 'רעיונות לסיפורים',
    description:
      'נתקעתם? קבלו רעיונות מקוריים לסיפורים בהתאמה לגיל הילד ולנושא שאוהבים.',
    url: `${BASE_URL}/StoryIdeas`,
  },
  Leaderboard: {
    title: 'לוח המובילים',
    description:
      'מי יצר הכי הרבה ספרים? הצטרפו לאתגר ועלו בדרגה.',
    url: `${BASE_URL}/Leaderboard`,
  },
  Profile: {
    title: 'הפרופיל שלי',
    description:
      'הישגים, תגים, נקודות ניסיון וכל הסטטיסטיקות שלך כיוצר.',
    url: `${BASE_URL}/Profile`,
  },

  // Blog
  Blog: {
    title: 'הבלוג של סיפוראי',
    description:
      'טיפים ליצירת ספרי ילדים, מדריכים לשימוש ב-AI, השראות ועדכוני פלטפורמה.',
    url: `${BASE_URL}/blog`,
  },

  // Info pages
  Contact: {
    title: 'צרו קשר',
    description:
      'יש לכם שאלה או הצעה? כתבו לנו — נשמח לשמוע.',
    url: `${BASE_URL}/Contact`,
  },
  PrivacyPolicy: {
    title: 'מדיניות פרטיות',
    description:
      'כיצד סיפוראי מגינה על הפרטיות שלכם ועל מידע הילדים, בהתאם ל-COPPA ולתקנות GDPR.',
    url: `${BASE_URL}/privacy`,
  },
  TermsOfService: {
    title: 'תנאי שימוש',
    description: 'תנאי השימוש בפלטפורמת סיפוראי.',
    url: `${BASE_URL}/terms`,
  },
  Accessibility: {
    title: 'הצהרת נגישות',
    description:
      'הצהרת הנגישות של סיפוראי — עמידה בת"י 5568 (WCAG 2.0 ברמה AA), מה נגיש באתר, מגבלות ידועות ופרטי רכז הנגישות.',
    url: `${BASE_URL}/accessibility`,
  },
};

/**
 * Update document head meta tags for SEO and social sharing.
 * Works with SPA — updates tags on route change.
 */
export function updateMeta({
  title,
  description,
  image,
  url,
  type = 'website',
  locale = 'he_IL',
}) {
  const lang = localStorage.getItem('language') || 'hebrew';
  const siteName = lang === 'hebrew' ? 'סיפוראי' : 'Sipurai';
  const defaultTitle =
    lang === 'hebrew'
      ? 'סיפוראי — ספרי ילדים מותאמים אישית עם AI'
      : "Sipurai — Personalized AI Children's Books";

  document.title = title ? `${title} | ${siteName}` : defaultTitle;

  // Helper — creates or updates a <meta> tag
  const setMeta = (attrKey, attrValue, contentValue) => {
    if (!contentValue) return;
    let el = document.querySelector(`meta[${attrKey}="${attrValue}"]`);
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute(attrKey, attrValue);
      document.head.appendChild(el);
    }
    el.setAttribute('content', contentValue);
  };

  // Standard
  setMeta('name', 'description', description);

  // Canonical
  if (url) {
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', url);
  }

  // OpenGraph
  setMeta('property', 'og:title', title || defaultTitle);
  setMeta('property', 'og:description', description);
  setMeta('property', 'og:image', image || DEFAULT_IMAGE);
  setMeta('property', 'og:url', url || window.location.href);
  setMeta('property', 'og:type', type);
  setMeta('property', 'og:locale', locale);
  setMeta('property', 'og:site_name', 'Sipurai');

  // Twitter / X
  setMeta('name', 'twitter:card', image ? 'summary_large_image' : 'summary');
  setMeta('name', 'twitter:title', title || defaultTitle);
  setMeta('name', 'twitter:description', description);
  setMeta('name', 'twitter:image', image || DEFAULT_IMAGE);
}

/**
 * Reset meta to the platform defaults (used when leaving a specific page).
 */
export function resetMeta() {
  const lang = localStorage.getItem('language') || 'hebrew';
  updateMeta({
    title: '',
    description:
      lang === 'hebrew'
        ? 'סיפוראי — יוצרים ספרי ילדים מותאמים אישית עם AI. בחרו דמויות, סגנון איור ושפה — וקבלו ספר שלם עם סיפור ואיורים.'
        : "Sipurai — Create personalized AI children's books. Choose characters, art style, and language to get a complete book with story and illustrations.",
    image: DEFAULT_IMAGE,
    url: BASE_URL,
  });
}

/**
 * React hook — call at the top of any page component to set route-specific SEO.
 *
 * @param {string} pageName  - Key from PAGE_META (e.g. 'Home', 'BookWizard')
 * @param {object} [overrides] - Optional partial overrides: { title, description, image, url }
 *
 * @example
 *   useSEO('BookWizard');
 *   useSEO('BookView', { title: bookTitle, image: bookCoverUrl });
 */
export function useSEO(pageName, overrides = {}) {
  useEffect(() => {
    const base = PAGE_META[pageName] || {};
    updateMeta({ ...base, ...overrides });

    return () => {
      // Nothing to clean up — the next page will overwrite tags
    };
  }, [pageName, JSON.stringify(overrides)]);
}
