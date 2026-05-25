import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Shield, BookOpen, ArrowLeft, ArrowRight } from 'lucide-react';
import { useI18n } from '@/components/i18n/i18nProvider';
import { updateMeta, resetMeta } from '@/lib/seo';

const LAST_UPDATED = 'March 2026';

const content = {
  en: {
    metaTitle: 'Privacy Policy — Sipurai',
    metaDesc: 'Sipurai Privacy Policy — how we collect, use and protect your data.',
    title: 'Privacy Policy',
    subtitle: 'Last updated: ' + LAST_UPDATED,
    backLink: 'Back to Home',
    sections: [
      {
        heading: '1. Who We Are',
        body: `Sipurai (sipurai.ai) is an AI-powered platform for creating personalized children's books. We are committed to protecting the privacy of children and families who use our platform.

Contact: support@sipurai.ai`,
      },
      {
        heading: '2. Information We Collect',
        body: `We collect the following information in order to provide our service:

**Authentication (Clerk):** When you sign up, Clerk collects your email address and optional name. We receive a user identifier from Clerk but do not store your password.

**User-Generated Content:** Stories, book settings, character descriptions, and illustrations you create are stored in our database (Supabase) and are linked to your account.

**Usage Data:** We use Umami Analytics — a cookieless, privacy-friendly analytics platform — to understand how the platform is used. Umami does not use cookies and does not collect personally identifiable information.

**Error Tracking:** We use Sentry to track technical errors. Sentry may collect anonymized technical data (stack traces, browser type, OS) to help us fix bugs. We configure Sentry to exclude personal data.

**Children's Data:** We collect only the minimum data necessary to operate the platform. We do not collect more information from children than from adult users.`,
      },
      {
        heading: '3. How We Use Your Information',
        body: `We use collected information to:

• Provide and improve the Sipurai service
• Save and display your books, characters, and content
• Send transactional emails (account confirmation, password reset)
• Fix technical errors and improve platform stability
• Comply with legal obligations

We do not sell, rent, or trade your personal information to third parties.`,
      },
      {
        heading: '4. Cookies',
        body: `Sipurai does not use tracking cookies. Our analytics provider (Umami) is cookieless by design. Clerk may set a session cookie to maintain your login state. This is a strictly necessary, functional cookie and does not track you across other websites.`,
      },
      {
        id: 'coppa',
        heading: "5. Children's Privacy (COPPA)",
        body: `We take the privacy of children seriously and comply with the Children's Online Privacy Protection Act (COPPA).

• We do not knowingly collect personal information from children under 13 without verifiable parental consent.
• Children under 13 may use Sipurai only with parental supervision and consent.
• Parents may request access to, correction of, or deletion of their child's information at any time by contacting us at support@sipurai.ai.
• We do not serve targeted advertising to children.
• We do not share children's personal information with third parties for commercial purposes.

If you believe we have inadvertently collected personal information from a child under 13 without parental consent, please contact us immediately at support@sipurai.ai and we will delete it promptly.`,
      },
      {
        heading: '6. Third-Party Services',
        body: `We use the following trusted third-party services to operate Sipurai:

**Clerk (clerk.com):** Authentication and user management. Privacy policy: clerk.com/legal/privacy

**Supabase (supabase.com):** Database and file storage. Privacy policy: supabase.com/privacy

**Google Gemini AI:** AI text and image generation for book content. Your prompts may be processed by Google's AI systems. Privacy policy: policies.google.com/privacy

**Creem (creem.io):** Payment processing for subscriptions. Creem handles payment card data — we never see or store your card details. Privacy policy: creem.io/privacy

**Sentry (sentry.io):** Error monitoring. Privacy policy: sentry.io/privacy

**Umami:** Cookieless analytics. Privacy policy: umami.is/privacy

**Vercel (vercel.com):** Web hosting and serverless functions. Privacy policy: vercel.com/legal/privacy-policy`,
      },
      {
        heading: '7. Data Storage and Security',
        body: `Your data is stored on Supabase servers located in the European Union. We implement industry-standard security measures including:

• Encrypted connections (HTTPS/TLS) for all data transfer
• Row-level security policies in our database
• Regular security reviews

No method of transmission over the internet is 100% secure. While we strive to protect your information, we cannot guarantee absolute security.`,
      },
      {
        heading: '8. Data Retention',
        body: `We retain your account data for as long as your account is active. If you delete your account, we will delete your personal data within 30 days, except where we are required by law to retain it longer.

Books and illustrations you create are stored until you delete them or your account is deleted. You can delete individual books from your library at any time.`,
      },
      {
        heading: '9. Your Rights',
        body: `Depending on your jurisdiction, you may have the following rights regarding your personal data:

• **Access:** Request a copy of the data we hold about you
• **Correction:** Ask us to correct inaccurate data
• **Deletion:** Request deletion of your account and associated data
• **Portability:** Request your data in a portable format
• **Objection:** Object to certain processing of your data

To exercise any of these rights, contact us at support@sipurai.ai. We will respond within 30 days.`,
      },
      {
        heading: '10. Changes to This Policy',
        body: `We may update this Privacy Policy from time to time. We will notify registered users of significant changes by email. The "Last updated" date at the top of this page shows when the policy was last revised. Continued use of Sipurai after changes constitutes acceptance of the updated policy.`,
      },
      {
        heading: '11. Contact Us',
        body: `For privacy-related questions, requests, or concerns, contact us at:

Email: support@sipurai.ai
Website: sipurai.ai`,
      },
    ],
  },
  he: {
    metaTitle: 'מדיניות פרטיות — Sipurai',
    metaDesc: 'מדיניות הפרטיות של Sipurai — כיצד אנו אוספים, משתמשים ומגנים על המידע שלך.',
    title: 'מדיניות פרטיות',
    subtitle: 'עדכון אחרון: מרץ 2026',
    backLink: 'חזרה לדף הבית',
    sections: [
      {
        heading: '1. מי אנחנו',
        body: `Sipurai (sipurai.ai) היא פלטפורמה מבוססת-AI ליצירת ספרי ילדים מותאמים אישית. אנחנו מחויבים להגנה על פרטיות הילדים והמשפחות שמשתמשים בפלטפורמה שלנו.

צור קשר: support@sipurai.ai`,
      },
      {
        heading: '2. מידע שאנו אוספים',
        body: `אנו אוספים את המידע הבא כדי לספק את השירות שלנו:

**אימות (Clerk):** בעת ההרשמה, Clerk אוסף את כתובת הדואר האלקטרוני שלך ושם אופציונלי. אנחנו מקבלים מזהה משתמש מ-Clerk אך לא מאחסנים את הסיסמה שלך.

**תוכן שיצרת:** סיפורים, הגדרות ספרים, תיאורי דמויות ואיורים שיצרת מאוחסנים במסד הנתונים שלנו (Supabase) ומקושרים לחשבונך.

**נתוני שימוש:** אנו משתמשים ב-Umami Analytics — פלטפורמת אנליטיקה ידידותית לפרטיות שאינה משתמשת בעוגיות — כדי להבין כיצד הפלטפורמה מנוצלת. Umami לא משתמש בעוגיות ולא אוסף מידע מזהה אישי.

**מעקב שגיאות:** אנו משתמשים ב-Sentry לניטור שגיאות טכניות. Sentry עשוי לאסוף נתונים טכניים אנונימיים לסיוע בתיקון באגים.

**נתוני ילדים:** אנו אוספים רק את המינימום ההכרחי לתפעול הפלטפורמה.`,
      },
      {
        heading: '3. כיצד אנו משתמשים במידע שלך',
        body: `אנחנו משתמשים במידע שנאסף כדי:

• לספק ולשפר את שירות Sipurai
• לשמור ולהציג את הספרים, הדמויות והתוכן שלך
• לשלוח מיילים טרנסקציוניים (אישור חשבון, איפוס סיסמה)
• לתקן שגיאות טכניות ולשפר יציבות הפלטפורמה
• לעמוד בהתחייבויות משפטיות

אנחנו לא מוכרים, משכירים או סוחרים במידע האישי שלך לצדדים שלישיים.`,
      },
      {
        heading: '4. עוגיות',
        body: `Sipurai אינה משתמשת בעוגיות מעקב. ספק האנליטיקה שלנו (Umami) אינו משתמש בעוגיות כלל. Clerk עשוי להגדיר עוגיית סשן כדי לשמור על מצב ההתחברות שלך. זוהי עוגייה פונקציונלית הכרחית בלבד ואינה עוקבת אחריך באתרים אחרים.`,
      },
      {
        id: 'coppa',
        heading: '5. פרטיות ילדים (COPPA)',
        body: `אנחנו נוקטים ברצינות בפרטיות ילדים ועומדים בחוק הגנת פרטיות ילדים המקוונים (COPPA).

• אנחנו לא אוספים ביודעין מידע אישי מילדים מתחת לגיל 13 ללא הסכמת הורים ניתנת לאימות.
• ילדים מתחת לגיל 13 רשאים להשתמש ב-Sipurai רק תחת פיקוח הורים והסכמתם.
• הורים רשאים לבקש גישה, תיקון או מחיקה של מידע ילדם בכל עת על-ידי יצירת קשר עם support@sipurai.ai.
• אנחנו לא מגישים פרסום ממוקד לילדים.
• אנחנו לא משתפים מידע אישי של ילדים עם צדדים שלישיים למטרות מסחריות.

אם אתה סבור שאספנו בטעות מידע אישי מילד מתחת לגיל 13 ללא הסכמת הורים, אנא צור קשר מיידי עם support@sipurai.ai ואנו נמחק אותו מייד.`,
      },
      {
        heading: '6. שירותי צד שלישי',
        body: `אנחנו משתמשים בשירותי צד שלישי מהימנים להפעלת Sipurai:

**Clerk (clerk.com):** אימות וניהול משתמשים.

**Supabase (supabase.com):** מסד נתונים ואחסון קבצים.

**Google Gemini AI:** יצירת טקסט ותמונות AI לתוכן הספרים. ה-prompts שלך עשויים להיות מעובדים על-ידי מערכות AI של Google.

**Creem (creem.io):** עיבוד תשלומים עבור מנויים. Creem מטפל בנתוני כרטיסי אשראי — אנחנו לעולם לא רואים או מאחסנים את פרטי הכרטיס שלך.

**Sentry (sentry.io):** ניטור שגיאות.

**Umami:** אנליטיקה ללא עוגיות.

**Vercel (vercel.com):** אחסון ואפליקציות serverless.`,
      },
      {
        heading: '7. אחסון מידע ואבטחה',
        body: `המידע שלך מאוחסן בשרתי Supabase הממוקמים באיחוד האירופי. אנחנו מיישמים אמצעי אבטחה תעשייתיים סטנדרטיים כולל:

• חיבורים מוצפנים (HTTPS/TLS) לכל העברת הנתונים
• מדיניות אבטחה ברמת שורה במסד הנתונים
• סקירות אבטחה תקופתיות`,
      },
      {
        heading: '8. שמירת מידע',
        body: `אנחנו שומרים את נתוני חשבונך כל עוד חשבונך פעיל. אם תמחק את חשבונך, נמחק את המידע האישי שלך תוך 30 ימים, למעט במקרים שבהם הדין מחייב שמירה ארוכה יותר.

ניתן למחוק ספרים בודדים מהספרייה שלך בכל עת.`,
      },
      {
        heading: '9. הזכויות שלך',
        body: `בהתאם לתחום השיפוט שלך, ייתכן שיש לך את הזכויות הבאות לגבי המידע האישי שלך:

• **גישה:** בקשת עותק של המידע שאנחנו מחזיקים עליך
• **תיקון:** בקשה לתקן מידע לא מדויק
• **מחיקה:** בקשת מחיקת חשבונך ונתוניך
• **ניידות:** בקשת המידע שלך בפורמט ניתן להעברה
• **התנגדות:** התנגדות לעיבוד מסוים של המידע שלך

לאחר קבלת הבקשה נשיב תוך 30 ימים. לפנייה: support@sipurai.ai`,
      },
      {
        heading: '10. שינויים במדיניות זו',
        body: `אנחנו עשויים לעדכן מדיניות פרטיות זו מעת לעת. נודיע למשתמשים רשומים על שינויים מהותיים בדואר אלקטרוני. השימוש המשך ב-Sipurai לאחר שינויים מהווה קבלת המדיניות המעודכנת.`,
      },
      {
        heading: '11. צור קשר',
        body: `לשאלות, בקשות או חששות הנוגעים לפרטיות:

דואר אלקטרוני: support@sipurai.ai
אתר: sipurai.ai`,
      },
    ],
  },
};

const PrivacyPolicy = () => {
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
            className="inline-flex items-center gap-2 text-purple-200 hover:text-white transition-colors mb-8 text-sm font-medium"
          >
            <BackIcon className="h-4 w-4" />
            {c.backLink}
          </Link>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 bg-white/20 rounded-xl">
              <Shield className="h-6 w-6" />
            </div>
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-purple-300" />
              <span className="text-purple-200 font-medium">Sipurai</span>
            </div>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold mb-2">{c.title}</h1>
          <p className="text-purple-200 text-sm">{c.subtitle}</p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
          {c.sections.map((section, idx) => (
            <section
              key={idx}
              id={section.id || undefined}
              className={`px-6 sm:px-8 py-8 ${idx < c.sections.length - 1 ? 'border-b border-gray-100 dark:border-gray-800' : ''}`}
            >
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-4">
                {section.heading}
              </h2>
              <div className="text-gray-600 dark:text-gray-400 text-sm sm:text-base leading-relaxed space-y-3">
                {section.body.split('\n\n').map((para, pIdx) => {
                  if (!para.trim()) return null;
                  // Render bullet lists
                  if (para.includes('\n•')) {
                    const lines = para.split('\n');
                    return (
                      <div key={pIdx}>
                        {lines.map((line, lIdx) => {
                          if (line.startsWith('•')) {
                            return (
                              <p key={lIdx} className="flex gap-2 leading-relaxed">
                                <span className="text-purple-500 mt-1 shrink-0">•</span>
                                <span>{line.slice(1).trim()}</span>
                              </p>
                            );
                          }
                          return <p key={lIdx}>{renderBold(line)}</p>;
                        })}
                      </div>
                    );
                  }
                  return <p key={pIdx}>{renderBold(para)}</p>;
                })}
              </div>
            </section>
          ))}
        </div>

        {/* Footer links */}
        <div className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400 space-x-4 rtl:space-x-reverse">
          <Link to="/terms" className="hover:text-purple-600 transition-colors underline">
            {lang === 'he' ? 'תנאי שימוש' : 'Terms of Service'}
          </Link>
          <span>·</span>
          <a href="mailto:support@sipurai.ai" className="hover:text-purple-600 transition-colors">
            support@sipurai.ai
          </a>
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

export default PrivacyPolicy;
