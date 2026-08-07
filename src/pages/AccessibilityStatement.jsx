import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Accessibility, BookOpen, ArrowLeft, ArrowRight, Mail, Phone } from 'lucide-react';
import { useI18n } from '@/components/i18n/i18nProvider';
import { updateMeta, resetMeta } from '@/lib/seo';

// Hardcoded per Israeli-law requirement — do NOT derive from a date function.
const LAST_UPDATED = '20/07/2026';

// Accessibility coordinator (רכז נגישות) — single source of truth for the page.
const COORDINATOR = {
  name: { he: 'אלעד יעקובוביץ\'', en: 'Elad Yaakobovitch' },
  email: 'eladhiteclearning@gmail.com',
  phone: '052-4016369',
};

// tel:-safe value (digits only). Israeli mobile → +972 international form.
const COORDINATOR_TEL = '+972524016369';

const content = {
  en: {
    metaTitle: 'Accessibility Statement — Sipurai',
    metaDesc:
      'Sipurai accessibility statement — our commitment to IS 5568 (WCAG 2.0 Level AA), what is accessible, known limitations, and how to report a barrier.',
    title: 'Accessibility Statement',
    subtitle: 'Last updated: ' + LAST_UPDATED,
    backLink: 'Back to Home',
    sections: [
      {
        heading: '1. Our Commitment',
        body: `Sipurai (sipurai.ai) is committed to making its platform accessible to the widest possible audience, including people with disabilities. We invest ongoing effort to ensure the site is usable, clear, and easy to operate for everyone.

We view accessibility not as a legal obligation alone, but as a core part of building a platform that children and families of all abilities can enjoy.`,
      },
      {
        heading: '2. Accessibility Standard',
        body: `This website strives to comply with the Israeli Standard **IS 5568** for web content accessibility, which is based on the international **WCAG 2.0** guidelines at **Level AA**, and with the Equal Rights for Persons with Disabilities Regulations (Service Accessibility Adjustments), 5773-2013.`,
      },
      {
        heading: '3. What Is Accessible on the Site',
        body: `• The site can be navigated using a keyboard, including a "skip to main content" link
• Semantic, hierarchical heading structure for screen-reader navigation
• Text alternatives (alt text) for meaningful images
• Full right-to-left (RTL) support for Hebrew, with correct language and direction attributes
• Adjustable font size and text density in the app settings
• Color contrast that meets the AA ratio for body text
• Respect for the operating-system "reduced motion" preference — animations are minimized for users who request it
• Visible focus indicators on interactive elements`,
      },
      {
        heading: '4. Known Limitations',
        body: `Despite our efforts, some parts of the site may not yet be fully accessible:

• AI-generated illustrations inside books rely on automatically generated descriptions, which may be incomplete
• Some third-party embedded components (such as the authentication and payment providers) are outside our direct control
• User-generated community content may not always include full text alternatives

We are working to improve these areas continuously. If you encounter a barrier, please let us know — see below.`,
      },
      {
        heading: '5. How to Report an Accessibility Issue',
        body: `If you found an accessibility barrier, or need content in an accessible format, we would be glad to help. Please contact our accessibility coordinator using the details below and describe the issue, the page where it occurred, and the browser or assistive technology you used. We make every effort to respond promptly.`,
      },
      {
        heading: '6. Accessibility Coordinator',
        isContact: true,
        nameLabel: 'Name',
        emailLabel: 'Email',
        phoneLabel: 'Phone',
      },
    ],
  },
  he: {
    metaTitle: 'הצהרת נגישות — Sipurai',
    metaDesc:
      'הצהרת הנגישות של סיפוראי — המחויבות שלנו לת"י 5568 (WCAG 2.0 ברמה AA), מה נגיש באתר, מגבלות ידועות ואיך לפנות אלינו.',
    title: 'הצהרת נגישות',
    subtitle: 'עודכן לאחרונה: ' + LAST_UPDATED,
    backLink: 'חזרה לדף הבית',
    sections: [
      {
        heading: '1. המחויבות שלנו',
        body: `סיפוראי (sipurai.ai) מחויבת להנגיש את הפלטפורמה לקהל הרחב ביותר האפשרי, כולל אנשים עם מוגבלות. אנחנו משקיעים מאמץ מתמשך כדי לוודא שהאתר שמיש, ברור ונוח להפעלה עבור כולם.

אנחנו רואים בנגישות לא רק חובה חוקית, אלא חלק מהותי מבניית פלטפורמה שילדים ומשפחות מכל היכולות יכולים ליהנות ממנה.`,
      },
      {
        heading: '2. תקן הנגישות',
        body: `אתר זה חותר לעמוד בתקן הישראלי **ת"י 5568** להנגשת תכנים באינטרנט, המבוסס על הנחיות **WCAG 2.0** הבינלאומיות **ברמה AA**, ובתקנות שוויון זכויות לאנשים עם מוגבלות (התאמות נגישות לשירות), התשע"ג-2013.`,
      },
      {
        heading: '3. מה נגיש באתר',
        body: `• ניתן לנווט באתר באמצעות מקלדת, כולל קישור "דילוג לתוכן הראשי"
• מבנה כותרות סמנטי והיררכי לניווט בקורא מסך
• חלופות טקסט (alt) לתמונות בעלות משמעות
• תמיכה מלאה בכיווניות מימין לשמאל (RTL) לעברית, עם מאפייני שפה וכיוון תקינים
• אפשרות לשנות גודל גופן וצפיפות טקסט בהגדרות האפליקציה
• ניגודיות צבע העומדת ביחס AA עבור טקסט גוף
• כיבוד העדפת "הפחתת תנועה" של מערכת ההפעלה — אנימציות ממוזערות למי שביקש זאת
• סימון פוקוס גלוי על אלמנטים אינטראקטיביים`,
      },
      {
        heading: '4. מגבלות ידועות',
        body: `למרות מאמצינו, ייתכן שחלקים מסוימים באתר עדיין אינם נגישים במלואם:

• איורים שנוצרו על-ידי AI בתוך הספרים מסתמכים על תיאורים שנוצרים אוטומטית, שעשויים להיות חלקיים
• חלק מהרכיבים המשובצים של צד שלישי (כגון ספקי ההתחברות והתשלום) נמצאים מחוץ לשליטתנו הישירה
• תוכן קהילתי שנוצר על-ידי משתמשים לא תמיד כולל חלופות טקסט מלאות

אנחנו פועלים לשיפור מתמיד בתחומים אלה. אם נתקלת בבעיה, נשמח שתעדכן אותנו — ראו למטה.`,
      },
      {
        heading: '5. איך לפנות בנושא נגישות',
        body: `אם מצאת מכשול נגישות, או שאתה זקוק לתוכן בפורמט נגיש, נשמח לעזור. אנא פנה לרכז הנגישות שלנו בפרטים שלמטה, ותאר את הבעיה, העמוד שבו התרחשה, והדפדפן או טכנולוגיית הסיוע שבהם השתמשת. אנחנו עושים כל מאמץ להשיב במהירות.`,
      },
      {
        heading: '6. רכז הנגישות',
        isContact: true,
        nameLabel: 'שם',
        emailLabel: 'דוא"ל',
        phoneLabel: 'טלפון',
      },
    ],
  },
};

const AccessibilityStatement = () => {
  const { language, isRTL } = useI18n();
  const lang = language === 'hebrew' || language === 'yiddish' ? 'he' : 'en';
  const c = content[lang];

  useEffect(() => {
    updateMeta({ title: c.metaTitle, description: c.metaDesc });
    return () => resetMeta();
  }, [c]);

  const BackIcon = isRTL ? ArrowRight : ArrowLeft;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="bg-gradient-to-br from-purple-600 via-indigo-600 to-purple-800 text-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-purple-100 hover:text-white transition-colors mb-8 text-sm font-medium"
          >
            <BackIcon className="h-4 w-4" />
            {c.backLink}
          </Link>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 bg-white/20 rounded-xl">
              <Accessibility className="h-6 w-6" />
            </div>
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-purple-200" />
              <span className="text-purple-100 font-medium">Sipurai</span>
            </div>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold mb-2">{c.title}</h1>
          <p className="text-purple-100 text-sm">{c.subtitle}</p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
          {c.sections.map((section, idx) => (
            <section
              key={idx}
              className={`px-6 sm:px-8 py-8 ${idx < c.sections.length - 1 ? 'border-b border-gray-100 dark:border-gray-800' : ''}`}
            >
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-4">
                {section.heading}
              </h2>

              {section.isContact ? (
                <address className="not-italic text-gray-700 dark:text-gray-300 text-sm sm:text-base leading-relaxed space-y-2">
                  <p>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {section.nameLabel}:{' '}
                    </span>
                    {COORDINATOR.name[lang]}
                  </p>
                  <p className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-purple-600 dark:text-purple-400 shrink-0" aria-hidden="true" />
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {section.emailLabel}:{' '}
                    </span>
                    <a
                      href={`mailto:${COORDINATOR.email}`}
                      dir="ltr"
                      className="text-purple-700 dark:text-purple-300 underline underline-offset-2 hover:text-purple-900 dark:hover:text-purple-200 transition-colors"
                    >
                      {COORDINATOR.email}
                    </a>
                  </p>
                  <p className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-purple-600 dark:text-purple-400 shrink-0" aria-hidden="true" />
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {section.phoneLabel}:{' '}
                    </span>
                    <a
                      href={`tel:${COORDINATOR_TEL}`}
                      dir="ltr"
                      className="text-purple-700 dark:text-purple-300 underline underline-offset-2 tabular-nums hover:text-purple-900 dark:hover:text-purple-200 transition-colors"
                    >
                      {COORDINATOR.phone}
                    </a>
                  </p>
                </address>
              ) : (
                <div className="text-gray-600 dark:text-gray-400 text-sm sm:text-base leading-relaxed space-y-3">
                  {section.body.split('\n\n').map((para, pIdx) => {
                    if (!para.trim()) return null;
                    // Render bullet lists
                    if (para.includes('\n•') || para.startsWith('•')) {
                      const lines = para.split('\n');
                      return (
                        <ul key={pIdx} className="space-y-1 list-none">
                          {lines.map((line, lIdx) => {
                            if (line.trim().startsWith('•')) {
                              return (
                                <li key={lIdx} className="flex gap-2 leading-relaxed">
                                  <span className="text-purple-600 dark:text-purple-400 mt-1 shrink-0" aria-hidden="true">•</span>
                                  <span>{line.replace(/^\s*•\s*/, '')}</span>
                                </li>
                              );
                            }
                            return line.trim() ? (
                              <p key={lIdx}>{renderBold(line)}</p>
                            ) : null;
                          })}
                        </ul>
                      );
                    }
                    return <p key={pIdx}>{renderBold(para)}</p>;
                  })}
                </div>
              )}
            </section>
          ))}
        </div>

        {/* Footer links */}
        <div className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400 space-x-4 rtl:space-x-reverse">
          <Link to="/privacy" className="hover:text-purple-600 dark:hover:text-purple-400 transition-colors underline">
            {lang === 'he' ? 'מדיניות פרטיות' : 'Privacy Policy'}
          </Link>
          <span>·</span>
          <Link to="/terms" className="hover:text-purple-600 dark:hover:text-purple-400 transition-colors underline">
            {lang === 'he' ? 'תנאי שימוש' : 'Terms of Service'}
          </Link>
        </div>
      </div>
    </div>
  );
};

// Helper to render **bold** markdown syntax
function renderBold(text) {
  if (!text.includes('**')) return text;
  const parts = text.split(/\*\*(.*?)\*\*/g);
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <strong key={i} className="font-semibold text-gray-800 dark:text-gray-200">
        {part}
      </strong>
    ) : (
      part
    )
  );
}

export default AccessibilityStatement;
