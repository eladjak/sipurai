import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ScrollText, BookOpen, ArrowLeft, ArrowRight } from 'lucide-react';
import { useI18n } from '@/components/i18n/i18nProvider';
import { updateMeta, resetMeta } from '@/lib/seo';

const LAST_UPDATED = 'March 2026';

const content = {
  en: {
    metaTitle: 'Terms of Service — Sipurai',
    metaDesc: 'Sipurai Terms of Service — the rules governing use of our platform.',
    title: 'Terms of Service',
    subtitle: 'Last updated: ' + LAST_UPDATED,
    backLink: 'Back to Home',
    intro:
      'Please read these Terms of Service carefully before using Sipurai. By accessing or using our platform, you agree to be bound by these terms.',
    sections: [
      {
        heading: '1. Acceptance of Terms',
        body: `By creating an account or using Sipurai, you agree to these Terms of Service and our Privacy Policy. If you do not agree, please do not use our platform.

These terms apply to all users of Sipurai, including parents, guardians, educators, and children using the platform under parental supervision.`,
      },
      {
        heading: '2. Description of Service',
        body: `Sipurai is an AI-powered platform that enables users to create personalized children's books using artificial intelligence. The platform provides tools for story creation, character design, illustration generation, and book sharing.

We reserve the right to modify, suspend, or discontinue the service (or any part thereof) at any time with reasonable notice.`,
      },
      {
        heading: '3. Age Requirements',
        body: `• Users must be at least 13 years old to create an account independently.
• Children under 13 may use Sipurai only under direct parental supervision and with parental consent.
• By registering an account, you confirm that you are at least 13 years old, or that you are a parent or guardian registering on behalf of a child.
• Parents are responsible for their child's use of the platform.`,
      },
      {
        heading: '4. Account Registration',
        body: `You must provide accurate and complete information when creating your account. You are responsible for maintaining the security of your account credentials and for all activity that occurs under your account.

You agree to notify us immediately at support@sipurai.ai if you suspect unauthorized access to your account.`,
      },
      {
        heading: '5. Acceptable Use',
        body: `You agree NOT to use Sipurai to:

• Create content that is violent, sexually explicit, harmful, threatening, harassing, or inappropriate for children
• Impersonate any person or entity or misrepresent your affiliation with any person or entity
• Upload or transmit viruses or any other malicious code
• Attempt to gain unauthorized access to any portion of the platform
• Scrape, crawl, or otherwise extract data from Sipurai using automated means
• Use the platform for commercial purposes without our written consent
• Violate any applicable laws or regulations

We reserve the right to terminate accounts that violate these rules.`,
      },
      {
        heading: '6. AI-Generated Content',
        body: `Sipurai uses AI systems (including Google Gemini) to generate text and images for your books.

**Content Ownership:** You own the books you create on Sipurai. By creating a book, you grant Sipurai a limited license to store, display, and (if you choose to share publicly) distribute that content on the platform.

**AI Limitations:** AI-generated content may occasionally be imperfect, inaccurate, or unexpected. We do not guarantee the accuracy or appropriateness of AI outputs. You are responsible for reviewing content before sharing.

**Prohibited Prompts:** You may not use prompts designed to generate inappropriate, harmful, or offensive content. Our systems include safety filters, but you agree not to attempt to circumvent them.`,
      },
      {
        heading: '7. Subscriptions and Payments',
        body: `Sipurai offers a free tier and paid subscription plans.

**Free Tier:** Includes a limited number of books per month and basic features.

**Paid Subscriptions:** Paid plans are billed on a monthly or annual basis. By subscribing, you authorize us (via our payment processor, Creem) to charge your payment method on a recurring basis.

**Pricing:** Current pricing is displayed on our pricing page. We reserve the right to change prices with 30 days' advance notice to existing subscribers.

**Cancellation:** You may cancel your subscription at any time. Upon cancellation, your plan will remain active until the end of the current billing period. We do not provide pro-rated refunds for unused time.

**Failed Payments:** If a payment fails, we will retry up to three times. If payment remains unsuccessful, your account will be downgraded to the free tier.`,
      },
      {
        heading: '8. Refund Policy',
        body: `We offer a 7-day money-back guarantee for new paid subscriptions. If you are not satisfied within the first 7 days of your first paid subscription, contact us at support@sipurai.ai for a full refund.

After 7 days, subscription fees are non-refundable except where required by applicable law.

For billing errors or unauthorized charges, contact us immediately at support@sipurai.ai.`,
      },
      {
        heading: '9. Content Moderation',
        body: `All AI-generated content passes through automated safety filters designed to prevent inappropriate content. We also reserve the right to review and remove any content that violates our acceptable use policy.

Users can report inappropriate content via support@sipurai.ai. We will investigate and act within 48 hours.`,
      },
      {
        heading: '10. Intellectual Property',
        body: `**Your Content:** You retain ownership of the stories, characters, and books you create on Sipurai, subject to the license described in Section 6.

**Our Platform:** The Sipurai platform, including its design, code, logos, and branding, is owned by us and protected by intellectual property law. You may not copy, modify, or distribute our platform or branding without written permission.

**Third-Party Rights:** You agree not to upload or use content that infringes the intellectual property rights of others.`,
      },
      {
        heading: '11. Disclaimer of Warranties',
        body: `Sipurai is provided "as is" and "as available" without warranties of any kind, either express or implied, including but not limited to implied warranties of merchantability, fitness for a particular purpose, and non-infringement.

We do not warrant that the service will be uninterrupted, error-free, or free of viruses or other harmful components.`,
      },
      {
        heading: '12. Limitation of Liability',
        body: `To the fullest extent permitted by applicable law, Sipurai and its operators shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including loss of data, loss of revenue, or loss of goodwill, arising from your use of or inability to use the service.

Our total liability to you for any claims arising from these terms or your use of Sipurai shall not exceed the amount you paid to us in the 12 months preceding the claim.`,
      },
      {
        heading: '13. Governing Law',
        body: `These Terms of Service are governed by the laws of the State of Israel. Any dispute arising from these terms shall be subject to the exclusive jurisdiction of the courts located in Israel.`,
      },
      {
        heading: '14. Changes to These Terms',
        body: `We may update these Terms of Service from time to time. We will notify registered users of material changes by email at least 14 days before they take effect. Continued use of Sipurai after changes constitutes acceptance of the updated terms.`,
      },
      {
        heading: '15. Contact Us',
        body: `For questions about these Terms of Service, contact us at:

Email: support@sipurai.ai
Website: sipurai.ai`,
      },
    ],
  },
  he: {
    metaTitle: 'תנאי שימוש — Sipurai',
    metaDesc: 'תנאי השימוש של Sipurai — הכללים המסדירים את השימוש בפלטפורמה שלנו.',
    title: 'תנאי שימוש',
    subtitle: 'עדכון אחרון: מרץ 2026',
    backLink: 'חזרה לדף הבית',
    intro:
      'אנא קרא תנאי שימוש אלה בעיון לפני השימוש ב-Sipurai. על-ידי גישה לפלטפורמה או שימוש בה, אתה מסכים לתנאים אלה.',
    sections: [
      {
        heading: '1. קבלת התנאים',
        body: `על-ידי יצירת חשבון או שימוש ב-Sipurai, אתה מסכים לתנאי שימוש אלה ולמדיניות הפרטיות שלנו. אם אינך מסכים, אנא אל תשתמש בפלטפורמה שלנו.

תנאים אלה חלים על כל משתמשי Sipurai, כולל הורים, אפוטרופוסים, מחנכים וילדים המשתמשים בפלטפורמה תחת פיקוח הורים.`,
      },
      {
        heading: '2. תיאור השירות',
        body: `Sipurai היא פלטפורמה מבוססת-AI המאפשרת למשתמשים ליצור ספרי ילדים מותאמים אישית. הפלטפורמה מספקת כלים ליצירת סיפורים, עיצוב דמויות, יצירת איורים ושיתוף ספרים.

אנחנו שומרים לעצמנו את הזכות לשנות, להשהות או להפסיק את השירות בכל עת עם הודעה מוקדמת סבירה.`,
      },
      {
        heading: '3. דרישות גיל',
        body: `• משתמשים חייבים להיות בני 13 לפחות כדי ליצור חשבון באופן עצמאי.
• ילדים מתחת לגיל 13 רשאים להשתמש ב-Sipurai רק תחת פיקוח ישיר של הורים ועם הסכמתם.
• על-ידי הרשמה לחשבון, אתה מאשר שאתה בן 13 לפחות, או שאתה הורה או אפוטרופוס הנרשם בשם ילד.
• הורים אחראים לשימוש ילדם בפלטפורמה.`,
      },
      {
        heading: '4. הרשמה לחשבון',
        body: `עליך לספק מידע מדויק ומלא בעת יצירת חשבונך. אתה אחראי לשמירה על אבטחת פרטי הכניסה לחשבון ולכל הפעילות המתרחשת תחת חשבונך.

אתה מסכים להודיע לנו מיידית בכתובת support@sipurai.ai אם אתה חושד בגישה לא מורשית לחשבונך.`,
      },
      {
        heading: '5. שימוש מותר',
        body: `אתה מסכים לא להשתמש ב-Sipurai כדי:

• ליצור תוכן אלים, מיני, מזיק, מאיים, מטריד או לא מתאים לילדים
• להתחזות לכל אדם או ישות
• להעלות וירוסים או קוד זדוני אחר
• לנסות לקבל גישה לא מורשית לפלטפורמה
• לאסוף נתונים באמצעים אוטומטיים
• להשתמש בפלטפורמה למטרות מסחריות ללא הסכמתנו בכתב
• להפר כל חוק או תקנה ישימים

אנחנו שומרים לעצמנו את הזכות לסגור חשבונות המפרים כללים אלה.`,
      },
      {
        heading: '6. תוכן שנוצר על-ידי AI',
        body: `Sipurai משתמשת במערכות AI (כולל Google Gemini) ליצירת טקסט ותמונות לספרים שלך.

**בעלות על תוכן:** אתה הבעלים של הספרים שאתה יוצר ב-Sipurai. על-ידי יצירת ספר, אתה מעניק ל-Sipurai רישיון מוגבל לאחסן, להציג ולהפיץ תוכן זה בפלטפורמה (אם בחרת לשתף באופן ציבורי).

**מגבלות AI:** תוכן שנוצר על-ידי AI עשוי להיות לא מושלם לעיתים. אתה אחראי לסקור תוכן לפני שיתופו.

**בקשות אסורות:** אינך רשאי להשתמש בבקשות שנועדו ליצור תוכן לא הולם, מזיק או פוגעני.`,
      },
      {
        heading: '7. מנויים ותשלומים',
        body: `Sipurai מציעה תוכנית חינמית ותוכניות מנוי בתשלום.

**תוכנית חינמית:** כוללת מספר מוגבל של ספרים בחודש ותכונות בסיסיות.

**מנויים בתשלום:** תוכניות בתשלום מחויבות על בסיס חודשי או שנתי.

**תמחור:** התמחור הנוכחי מוצג בדף התמחור שלנו. אנחנו שומרים לעצמנו את הזכות לשנות מחירים עם הודעה מוקדמת של 30 יום למנויים קיימים.

**ביטול:** אתה יכול לבטל את מנויך בכל עת. לאחר ביטול, התוכנית שלך תישאר פעילה עד סוף תקופת החיוב הנוכחית.

**תשלומים שנכשלו:** אם תשלום נכשל, ננסה שוב עד שלוש פעמים. אם התשלום נכשל, החשבון ישדרג לתוכנית החינמית.`,
      },
      {
        heading: '8. מדיניות החזרים',
        body: `אנחנו מציעים אחריות להחזר כספי מלא תוך 7 ימים עבור מנויים בתשלום חדשים. אם אינך מרוצה תוך 7 הימים הראשונים של המנוי הראשון שלך, צור קשר עם support@sipurai.ai להחזר מלא.

לאחר 7 ימים, דמי מנוי אינם ניתנים להחזר למעט כנדרש בחוק הישים.

לשגיאות חיוב או חיובים לא מורשים, צור קשר מיידי עם support@sipurai.ai.`,
      },
      {
        heading: '9. ניהול תוכן',
        body: `כל תוכן שנוצר על-ידי AI עובר מסנני בטיחות אוטומטיים. אנחנו שומרים לעצמנו את הזכות לסקור ולהסיר כל תוכן המפר את מדיניות השימוש שלנו.

משתמשים יכולים לדווח על תוכן לא הולם דרך support@sipurai.ai. נחקור ונפעל תוך 48 שעות.`,
      },
      {
        heading: '10. קניין רוחני',
        body: `**התוכן שלך:** אתה שומר על בעלות הסיפורים, הדמויות והספרים שאתה יוצר ב-Sipurai, בכפוף לרישיון המתואר בסעיף 6.

**הפלטפורמה שלנו:** פלטפורמת Sipurai, כולל עיצובה, קוד, לוגואים ומיתוג, בבעלותנו ומוגנת על-ידי דיני קניין רוחני.

**זכויות צד שלישי:** אתה מסכים לא להעלות או להשתמש בתוכן הפוגע בזכויות קניין רוחני של אחרים.`,
      },
      {
        heading: '11. הכחשת אחריות',
        body: `Sipurai מסופקת "כפי שהיא" ו"כפי שהיא זמינה" ללא אחריות מכל סוג שהיא, מפורשת או משתמעת, כולל אחריות משתמעת לסחירות, התאמה למטרה מסוימת ואי-הפרה.

אנחנו לא מבטיחים שהשירות יהיה רציף, ללא שגיאות או ללא וירוסים.`,
      },
      {
        heading: '12. הגבלת אחריות',
        body: `במידה המרבית המותרת על-פי חוק ישים, Sipurai ומפעיליה לא יהיו אחראים לכל נזק עקיף, מקרי, מיוחד, תוצאתי או עונשי, כולל אובדן נתונים, אובדן הכנסה.

האחריות הכוללת שלנו כלפיך לא תעלה על הסכום ששילמת לנו ב-12 החודשים שקדמו לתביעה.`,
      },
      {
        heading: '13. החוק החל',
        body: `תנאי שימוש אלה כפופים לחוקי מדינת ישראל. כל מחלוקת הנובעת מתנאים אלה תהיה בסמכות השיפוט הבלעדית של בתי המשפט בישראל.`,
      },
      {
        heading: '14. שינויים בתנאים',
        body: `אנחנו עשויים לעדכן תנאי שימוש אלה מעת לעת. נודיע למשתמשים רשומים על שינויים מהותיים בדואר אלקטרוני לפחות 14 ימים לפני כניסתם לתוקף. השימוש המשך ב-Sipurai לאחר שינויים מהווה קבלת התנאים המעודכנים.`,
      },
      {
        heading: '15. צור קשר',
        body: `לשאלות בנוגע לתנאי שימוש אלה:

דואר אלקטרוני: support@sipurai.ai
אתר: sipurai.ai`,
      },
    ],
  },
};

const TermsOfService = () => {
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
      <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-indigo-800 text-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-indigo-200 hover:text-white transition-colors mb-8 text-sm font-medium"
          >
            <BackIcon className="h-4 w-4" />
            {c.backLink}
          </Link>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 bg-white/20 rounded-xl">
              <ScrollText className="h-6 w-6" />
            </div>
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-indigo-300" />
              <span className="text-indigo-200 font-medium">Sipurai</span>
            </div>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold mb-2">{c.title}</h1>
          <p className="text-indigo-200 text-sm">{c.subtitle}</p>
        </div>
      </div>

      {/* Intro */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <div className="bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900 rounded-xl p-5 text-sm text-indigo-800 dark:text-indigo-300 leading-relaxed">
          {c.intro}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
          {c.sections.map((section, idx) => (
            <section
              key={idx}
              className={`px-6 sm:px-8 py-8 ${idx < c.sections.length - 1 ? 'border-b border-gray-100 dark:border-gray-800' : ''}`}
            >
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-4">
                {section.heading}
              </h2>
              <div className="text-gray-600 dark:text-gray-400 text-sm sm:text-base leading-relaxed space-y-3">
                {section.body.split('\n\n').map((para, pIdx) => {
                  if (!para.trim()) return null;
                  if (para.includes('\n•')) {
                    const lines = para.split('\n');
                    return (
                      <div key={pIdx}>
                        {lines.map((line, lIdx) => {
                          if (line.startsWith('•')) {
                            return (
                              <p key={lIdx} className="flex gap-2 leading-relaxed">
                                <span className="text-indigo-500 mt-1 shrink-0">•</span>
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
          <Link to="/privacy" className="hover:text-indigo-600 transition-colors underline">
            {lang === 'he' ? 'מדיניות פרטיות' : 'Privacy Policy'}
          </Link>
          <span>·</span>
          <a href="mailto:support@sipurai.ai" className="hover:text-indigo-600 transition-colors">
            support@sipurai.ai
          </a>
        </div>
      </div>
    </div>
  );
};

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

export default TermsOfService;
