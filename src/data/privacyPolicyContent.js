/**
 * Privacy policy text (Hebrew + English). One place, used by /privacy and by the privacy gate.
 *
 * Rule for editing: say only what the code really does. Every processor below was found by
 * reading api/ and src/ (outbound calls, index.html, vercel.json), not copied from an older text.
 * The 12.11.2026 rewrite was checked line by line against the code (research/APP-FACTS.md in the
 * review folder) and against Israeli law: Privacy Protection Law s.11 notice (voluntary or not,
 * purpose, who is responsible, who receives the data, the rights of access and correction), the
 * transfer-abroad regulations (consent, reg. 2(1)), and the Authority's consent opinion (clear,
 * specific, no "among other things").
 * When the policy changes in a way parents should see again, bump CURRENT_POLICY_VERSION in
 * api/_lib/policyVersion.js (and LAST_UPDATED below) and update gateCopy.*.whatChanged.
 *
 * NOT REVIEWED BY A LICENSED LAWYER. Do not present it as legal advice.
 */
import { CURRENT_POLICY_VERSION } from '../../api/_lib/policyVersion.js';

export const POLICY_VERSION = CURRENT_POLICY_VERSION;
export const CONTACT_EMAIL = 'support@sipurai.ai';
export const LAST_UPDATED = { he: '12 בנובמבר 2026', en: 'November 12, 2026' };

/**
 * Who is legally responsible for the data ("בעל השליטה במאגר", Privacy Protection Law s.11(2a)),
 * and the trader details a distance sale must show (Consumer Protection Law s.14C).
 * Filled 12.11.2026 from the owner's decision (11:35) and his Green Invoice business profile:
 * the business is the owner himself, an exempt dealer (עוסק פטור).
 */
export const CONTROLLER = {
  legalNameHe: "אלעד יעקובוביץ' (עוסק פטור)",
  legalNameEn: 'Elad Yakobovich (exempt dealer)',
  businessId: '021983085',
  address: 'רחוב לח"י 13 דירה 3, מגדל העמק 2304364',
  addressEn: '13 Lehi St., Apt. 3, Migdal HaEmek 2304364, Israel',
};
export const CONTROLLER_DETAILS_MISSING = !CONTROLLER.legalNameHe || !CONTROLLER.businessId || !CONTROLLER.address;

const BRAND_NAME = { he: 'סיפוראי', en: 'Sipurai' };

const controllerLine = (lang) => {
  const name = lang === 'he' ? CONTROLLER.legalNameHe : CONTROLLER.legalNameEn || CONTROLLER.legalNameHe;
  const parts = [BRAND_NAME[lang === 'he' ? 'he' : 'en']];
  if (name) parts.push(name);
  if (CONTROLLER.businessId) parts.push(lang === 'he' ? `מספר עוסק ${CONTROLLER.businessId}` : `business no. ${CONTROLLER.businessId}`);
  const address = lang === 'he' ? CONTROLLER.address : CONTROLLER.addressEn || CONTROLLER.address;
  if (address) parts.push(address);
  return parts.join(', ');
};

const buildPolicyContent = (deleteEnabled) => ({
  he: {
    metaTitle: 'מדיניות פרטיות',
    metaDesc: 'איזה מידע סיפוראי שומרת עליכם ועל הילדים, מי מטפל בו, לאן הוא עובר, כמה זמן, ואיך מוחקים.',
    title: 'מדיניות פרטיות',
    subtitle: `גרסה ${POLICY_VERSION} · עדכון אחרון: ${LAST_UPDATED.he}`,
    backLink: 'חזרה לדף הבית',
    termsLink: 'תנאי שימוש',
    sections: [
      {
        heading: '1. מי אנחנו ומי אחראי על המידע',
        body: `סיפוראי (sipurai.ai) יוצרת ספרי ילדים מותאמים אישית. את הסיפורים, האיורים וההקראה יוצרים מודלים של בינה מלאכותית.

ההורה הוא המשתמש והלקוח. הילדים לא פותחים חשבון, והחשבון תמיד של הורה או אפוטרופוס בן 18 ומעלה.

**מי אחראי על המידע** (בלשון החוק: בעל השליטה במאגר המידע): ${controllerLine('he')}.

לכל שאלה או בקשה על פרטיות: ${CONTACT_EMAIL}

השירות מיועד כרגע להורים בישראל.`,
      },
      {
        heading: '2. איזה מידע אנחנו שומרים, והאם חייבים למסור אותו',
        body: `**אין חובה בחוק למסור לנו מידע.** מסירת המידע תלויה ברצונכם ובהסכמתכם. בלי כתובת מייל אי אפשר לפתוח חשבון, ובלי פרטים על הדמות אי אפשר ליצור ספר מותאם. אפשר תמיד להשתמש בשם בדוי ובתיאור כללי. אם לא תאשרו את המדיניות, לא נשתמש במידע כדי ליצור ספרים, ואפשר לבקש שנמחק גם את החשבון.

**עליכם, ההורים:**
• כתובת מייל, ושם אם הוספתם
• תמונת פרופיל, אם בחרתם או יצרתם אחת
• פרטי המנוי (איזו תוכנית ועד מתי). את פרטי כרטיס האשראי אנחנו לא רואים ולא שומרים.
• שם, טלפון וכתובת למשלוח, רק אם הזמנתם ספר מודפס
• רישום של האישור שנתתם למדיניות: הגרסה, התאריך וסוג הדפדפן

**על הילדים, רק מה שאתם מקלידים:**
• שם, גיל, ומין אם בחרתם
• תחומי עניין, תיאור המראה והאופי של הדמות, ובני משפחה שהזכרתם בסיפור
• אל תכתבו פרטים רגישים שלא צריך בשביל סיפור, כמו מצב בריאות, דת, מוצא או עניינים משפחתיים אישיים. אנחנו לא מבקשים אותם.

**תמונה:** אנחנו לא מבקשים תמונה כדי ליצור ספר. אפשר להעלות תמונה רק כדי לצייר ממנה דמות לתמונת הפרופיל, והיא לא נשמרת אצלנו. נשמר רק הציור (ראו סעיף 6).

**מה שיצרתם:**
• הסיפורים, האיורים, הדמויות והרעיונות שלכם
• הגדרות, הישגים ומונה הספרים שיצרתם החודש
• מי אתם עוקבים אחריו, והתראות בתוך האפליקציה, אם השתמשתם בזה

**במכשיר שלכם:** טיוטה של ספר שהתחלתם נשמרת בדפדפן במכשיר הזה עד שתסיימו או תמחקו אותה. היא נשארת גם אחרי התנתקות, ולכן במחשב משותף מי שמשתמש באותו דפדפן עלול לראות אותה.

**מה נשמר אוטומטית:**
• ספירת ביקורים בדפים, כדי להבין ולשפר את השירות. אחרי שהתחברתם, הספירה מקושרת למספר החשבון הפנימי שלכם. היא לא כוללת שם או מייל, אבל אנחנו יכולים לקשר את המספר הזה לחשבון.
• דיווחי תקלות טכניות, בלי שם, בלי מייל ובלי פרטי הילדים. יומני השרת עלולים לכלול קטע קצר מבקשת יצירה שנכשלה, ולכן אל תכתבו בבקשות פרטים כמו כתובת או טלפון.`,
      },
      {
        heading: '3. למה אנחנו צריכים את המידע',
        body: `• ליצור את הספר ולשמור אותו בספרייה שלכם
• לאפשר התחברות, מנוי ותשלום
• להדפיס ולשלוח ספר, אם הזמנתם
• למנוע שימוש לרעה ולתקן תקלות
• לעמוד בדרישות החוק, למשל שמירת רשומות תשלום

אנחנו לא מוכרים מידע, לא משכירים אותו, לא משתפים אותו לצורכי פרסום, לא בונים פרופיל של הילד ולא מציגים פרסומות לילדים.

**הודעות פרסומת:** אנחנו לא שולחים פרסומות במייל. אם נתחיל, נשלח רק למי שביקש זאת במפורש ובנפרד מההרשמה, כל הודעה תסומן "פרסומת", ואפשר יהיה להסיר את עצמכם בכל זמן (סעיף 30א לחוק התקשורת).`,
      },
      {
        heading: '4. מי עוד מקבל את המידע, ולאן הוא עובר',
        body: `אנחנו עובדים עם חברות חיצוניות. הנה כולן, ומה כל אחת מקבלת.

**המידע עובר גם מחוץ לישראל.** בסיס הנתונים נמצא באיחוד האירופי (פרנקפורט, גרמניה). רוב הספקים האחרים מעבדים את המידע בארצות הברית, וחלקם בשרתים במדינות נוספות שהם בוחרים. כשאתם מאשרים את המדיניות, אתם מסכימים להעברה הזו. אפשר לבקש במייל את פרטי התנאים של כל ספק.

**Clerk** (clerk.com): ההתחברות. מקבלת את המייל, השם, תמונת הפרופיל ומזהה החשבון. קוד ההתחברות שלה נטען דרך **jsDelivr**, שרת להפצת קבצים, ולכן כתובת ה-IP שלכם מגיעה גם אליו. בזמן ההרשמה עשויה לרוץ בדיקה נגד רובוטים של **Cloudflare**.

**Supabase** (supabase.com): בסיס הנתונים ואחסון הקבצים, בשרתים בפרנקפורט. כאן נשמרים הספרים, הדמויות והציורים.

**Vercel** (vercel.com): אירוח האתר והשרת שלנו. כל בקשה עוברת דרכו.

**Google, שירותי Gemini:** כתיבת הסיפורים, ציור האיורים, הקראה בקול (אם בחרתם קול מהענן) וצ'אט השאלות באתר. מקבלת את בקשת היצירה: הנושא, שמות הדמויות, הגיל, תיאור המראה והאופי, בני משפחה שהזכרתם והשפה. לפעמים היא מקבלת גם את ציור העטיפה, כדי שהדמות תיראה אותו דבר בכל עמוד. אם העליתם תמונה לציור דמות פרופיל, התמונה נשלחת אליה כדי לצייר. כמה זמן היא נשמרת אצלה נקבע בתנאים שלה.

**OpenAI:** ציור איורים והקראה בקול, לפי המודל שנבחר. מקבלת את בקשת האיור או את הטקסט להקראה, ולפעמים את ציור העטיפה. אם העליתם תמונה לציור דמות פרופיל והמודל שנבחר הוא שלה, התמונה נשלחת אליה כדי לצייר. כמה זמן היא נשמרת אצלה נקבע בתנאים שלה.

**הקראה בקול:** כברירת מחדל ההקראה נעשית בדפדפן שלכם, והטקסט לא יוצא מהמכשיר. רק אם בחרתם קול מהענן, הטקסט נשלח ל-Google או ל-OpenAI.

**Creem** (creem.io): תשלום על מנוי. מקבלת את המייל שלכם, ואצלה נשמרים פרטי כרטיס האשראי.

**Morning, חשבונית ירוקה:** תשלום וקבלה על הזמנת ספר מודפס, אם הזמנתם. מקבלת את השם והסכום.

**ספק ההדפסה BookPod:** רק כשמזמינים ספר מודפס. מקבל את קובצי הספר, ואת השם, הטלפון וכתובת המשלוח. (הזמנת ספרים מודפסים עדיין לא נפתחה לכולם.)

**Sentry** (sentry.io): דיווחי תקלות, בלי שם, בלי מייל ובלי פרטי הילדים.

**Umami** (analytics.sipurai.ai): ספירת ביקורים בלי עוגיות, על הדומיין שלנו. אחרי התחברות הספירה מסומנת במספר החשבון הפנימי.

**Sanity** (sanity.io): תוכן הבלוג. כשפותחים את הבלוג, הדפדפן פונה אליהם.

**Google Fonts:** הגופנים של האתר נטענים מגוגל, ולכן כתובת ה-IP שלכם מגיעה אליהם.

**צ'אט השאלות באתר** (פתוח גם למי שלא נרשם): ההודעות שכותבים בו נשלחות ל-Google כדי שיענו. אל תכתבו בו פרטים על הילדים.

אנחנו לא מאמנים מודל בינה מלאכותית על הספרים שלכם. מה הספקים עושים בבקשות שהם מקבלים, וכמה זמן הם שומרים אותן, נקבע בתנאים שלהם, ואנחנו לא יכולים לשנות אותם. אנחנו שולחים לספקים רק את מה שדרוש כדי ליצור את התוכן.`,
      },
      {
        heading: '5. ילדים',
        id: 'coppa', // kept: the landing trust badge links to /privacy#coppa
        body: `• החשבון שייך להורה. הילדים לא נרשמים בעצמם, והאפליקציה לא מבקשת מהם שום מידע.
• ילדים יכולים לקרוא ולהאזין לספרים במכשיר שלכם כשאתם מחוברים. מה שקורה בחשבון באחריותכם.
• ההורה מחליט איזה מידע על הילד להכניס. אפשר ליצור ספר עם שם בדוי או בלי שם אמיתי.
• אנחנו לא פונים לילדים בהודעות ובפרסומות.
• **ספר ששיתפתם בקהילה גלוי לכל מי שנכנס לשם:** הכותרת, הטקסט, האיורים, והשמות שמופיעים בסיפור. מי שרואה אותו יכול גם לשמור עותק. לפני שמשתפים, בדקו שאתם מסכימים לכך. אפשר להפסיק את השיתוף בכל זמן בכפתור "הפסקת השיתוף" שליד הספר. אחרי שמפסיקים, הספר יורד מהקהילה מיד, אבל איור שמישהו כבר פתח עשוי להישאר שמור בדפדפן שלו עד יום אחד, ועותק שמישהו שמר נשאר אצלו.
• ספרים שלא שיתפתם נראים באפליקציה רק לכם, ולמי שהזמנתם לערוך איתכם. על הציורים עצמם ראו סעיף 6.
• אם אתם חושבים שילד פתח חשבון, או שמידע על ילד נשמר בלי הסכמת הורה, כתבו לנו ל-${CONTACT_EMAIL} ונמחק את המידע מהמערכות שלנו.`,
      },
      {
        heading: '6. תמונות וציורים',
        id: 'photos',
        body: `**תמונה שאתם מעלים:** אפשר להעלות תמונה רק כדי לצייר ממנה דמות לתמונת הפרופיל. לפני ההעלאה מבקשים מכם אישור נפרד. אם זו תמונה של ילד, העלו אותה רק אם אתם ההורה או האפוטרופוס שלו.

**איך זה עובד:** הדפדפן מקטין את התמונה ומוחק ממנה נתונים נסתרים כמו מיקום, ומעביר אותה לשרת שלנו. השרת מעביר אותה לשירות הציור (Google או OpenAI, לפי המודל שנבחר). הציור שחוזר הוא מה שנשמר. התמונה עצמה לא נכתבת אצלנו לאחסון ולא נכנסת לבסיס הנתונים.

**מה אנחנו לא שולטים בו:** כמה זמן שירות הציור שומר בקשה אצלו נקבע בתנאים שלו. לכן כתבנו בסעיף 4 מי מקבל את התמונה.

**מי יכול לראות ציורים:** הציורים, כלומר איורי הספרים, העטיפות ודמויות הפרופיל, נשמרים באחסון סגור. רק מי שיצר אותם, כשהוא מחובר לחשבון, יכול לפתוח אותם. ציורים של ספר ששיתפתם בקהילה גלויים לכולם כל עוד הספר משותף.`,
      },
      {
        heading: '7. כמה זמן אנחנו שומרים',
        body: `המידע נשמר כל עוד החשבון קיים. אין לנו כרגע מחיקה אוטומטית של חשבונות שלא בשימוש.

**דמות שמחקתם** נעלמת מהספרייה, אבל קובץ הציור שלה נשאר באחסון עד מחיקת החשבון. **ספר בודד** אפשר למחוק בכפתור "מחיקת הספר" שליד הספר. המחיקה מוחקת את הספר, את הדפים, את השיתוף בקהילה ואת קובצי הציורים שלו. אי אפשר לשחזר ספר שנמחק.

רשומות כספיות של הזמנות נשמרות לתקופה שהחוק מחייב, גם אחרי מחיקת החשבון.

דיווחי תקלות, ספירת ביקורים ויומני שרת נשמרים אצל הספקים לפי הכללים שלהם.`,
      },
      {
        heading: '8. איך מוחקים הכל',
        id: 'delete',
        body: !deleteEnabled
          ? `כרגע מחיקה אוטומטית של החשבון עדיין לא פתוחה. כדי למחוק, כתבו ל-${CONTACT_EMAIL} ואנחנו נמחק מהמערכות הפעילות שלנו את החשבון, את המידע על הילדים, הדמויות, הספרים, הציורים וההגדרות, חוץ ממה שמפורט למטה. נאשר לכם את המחיקה תוך 30 יום.

**מה נשאר:** אם הזמנתם ספר מודפס, הרשומה הכספית של ההזמנה נשמרת כי החוק מחייב אותנו לשמור אותה, בלי כתובת המשלוח.

**מה לא נמחק אצלנו בבת אחת:** מידע שכבר נמצא אצל ספקים חיצוניים, כמו רשומת התשלום אצל Creem ו-Morning, הזמנה מודפסת אצל BookPod, דיווחי תקלות, ספירת ביקורים, ומה שספקי הבינה המלאכותית שומרים לפי התנאים שלהם. אם תבקשו, נפנה לספקים ונבקש למחוק את מה שאפשר.

עותקי גיבוי אצל ספק האחסון עשויים להישמר זמן מוגבל אחרי המחיקה.`
          : `בכל רגע אפשר ללחוץ על **הגדרות, חשבון, מחיקת החשבון והנתונים**. המחיקה מיידית ואי אפשר לשחזר אותה.

**מה נמחק:** החשבון, פרטי הילדים והדמויות, הספרים, הדפים, הציורים, ההגדרות וההישגים, ורישום האישורים למדיניות. גם הטיוטות שבדפדפן נמחקות, במכשיר שממנו מחקתם.

**מה נשאר:** אם הזמנתם ספר מודפס והוא נשלח, הרשומה הכספית של ההזמנה נשמרת כי החוק מחייב אותנו לשמור אותה. כתובת המשלוח נמחקת ממנה.

**מה לא נמחק בלחיצה:** מידע שכבר נמצא אצל ספקים חיצוניים, כמו רשומת התשלום אצל Creem ו-Morning, הזמנה מודפסת אצל BookPod, דיווחי תקלות, ספירת ביקורים, ומה שספקי הבינה המלאכותית שומרים לפי התנאים שלהם. אם תבקשו, נפנה לספקים ונבקש למחוק את מה שאפשר.

**מתי אי אפשר למחוק מיד:** כשיש מנוי בתשלום פעיל (צריך קודם לבטל אותו, כי מחיקה לא מפסיקה חיוב) או הזמנה מודפסת שעדיין בדרך.

עותקי גיבוי אצל ספק האחסון עשויים להישמר זמן מוגבל אחרי המחיקה.

אפשר גם לכתוב ל-${CONTACT_EMAIL} ונמחק בשבילכם.`,
      },
      {
        heading: '9. הזכויות שלכם',
        body: `לפי חוק הגנת הפרטיות יש לכם זכות לעיין במידע שיש לנו עליכם ועל הילדים שלכם, ולבקש לתקן או למחוק מידע שאינו נכון, שלם, ברור או מעודכן. מעבר לכך אנחנו נותנים לכם גם לקבל עותק של המידע, ולמחוק אותו בכל זמן.

אפשר לחזור בכם מההסכמה בכל זמן. אחרי זה לא ניצור בשבילכם ספרים, ואפשר למחוק את החשבון כמו בסעיף 8.

את הבקשות שלחו ל-${CONTACT_EMAIL}. בקשה לעיון נאפשר תוך 30 יום, ואם נצטרך לסרב, נודיע לכם תוך 21 יום ונסביר למה (תקנות הגנת הפרטיות, תנאים לעיון במידע). אם נתקן או נמחק מידע שלא היה נכון, נודיע על כך גם למי שקיבל אותו מאיתנו.

אם אתם חושבים שלא טיפלנו נכון במידע, אפשר גם לפנות לרשות להגנת הפרטיות במשרד המשפטים.`,
      },
      {
        heading: '10. אבטחה',
        body: `• כל התקשורת מוצפנת (HTTPS).
• פרטי הילדים וספרים שלא שיתפתם נגישים בבסיס הנתונים רק לכם, ולמי שהזמנתם לערוך איתכם. ההרשאות נבדקות בשרת ולא רק בדפדפן.
• הגישה לשירותי הבינה המלאכותית עוברת דרך השרת שלנו, והמפתחות לא נחשפים לדפדפן.
• דיווחי תקלות מסוננים לפני שהם יוצאים, כדי שלא יכללו שמות, מייל או פרטי ילדים.

שום מערכת אינה מאובטחת במאה אחוז. אם יקרה אירוע אבטחה, נבדוק אותו ונפעל לצמצם את הנזק. נדווח לרשות להגנת הפרטיות ולמי שנפגע כשהחוק מחייב זאת, ונשקול להודיע גם במקרים אחרים.`,
      },
      {
        heading: '11. עוגיות ואחסון בדפדפן',
        body: `אין לנו עוגיות מעקב ואין פרסומות. ספירת הביקורים נעשית בלי עוגיות. שירות ההתחברות (Clerk) שומר עוגיית התחברות הכרחית כדי שתישארו מחוברים.

האפליקציה שומרת בדפדפן שלכם טיוטות, הגדרות ומצב קריאה, כדי שלא תאבדו עבודה. המידע הזה נשאר במכשיר.`,
      },
      {
        heading: '12. כשהמדיניות משתנה',
        body: `כשאנחנו משנים משהו מהותי, מעדכנים את מספר הגרסה למעלה. בפעם הבאה שתפתחו את האפליקציה נראה לכם בקצרה מה השתנה ונבקש לאשר פעם אחת. סיפור שכבר באמצע נמשך עד הסוף, ולא נעצור אתכם באמצעו.

שינוי קטן שלא משנה מה קורה עם המידע, כמו תיקון ניסוח או קישור, יופיע כאן בלי לבקש אישור מחדש.`,
      },
      {
        heading: '13. יצירת קשר',
        body: `מייל: ${CONTACT_EMAIL}`,
      },
    ],
  },
  en: {
    metaTitle: 'Privacy Policy',
    metaDesc: 'What Sipurai keeps about you and your children, who handles it, where it goes, for how long, and how to delete it.',
    title: 'Privacy Policy',
    subtitle: `Version ${POLICY_VERSION} · Last updated: ${LAST_UPDATED.en}`,
    backLink: 'Back to Home',
    termsLink: 'Terms of Service',
    sections: [
      {
        heading: '1. Who we are and who is responsible for the data',
        body: `Sipurai (sipurai.ai) creates personalized children's books. The stories, illustrations and read-aloud voices are made by artificial intelligence models.

The parent is the user and the customer. Children do not open accounts. An account always belongs to a parent or guardian aged 18 or over.

**Who is responsible for the data** (in the words of Israeli law, the database controller): ${controllerLine('en')}.

Privacy questions or requests: ${CONTACT_EMAIL}

The service is currently meant for parents in Israel. The Hebrew version of this policy is the binding one.`,
      },
      {
        heading: '2. What we keep, and whether you must give it',
        body: `**No law requires you to give us information.** Giving it depends on your choice and consent. Without an email address you cannot open an account, and without details about the character we cannot create a personalized book. You can always use a made-up name and a general description. If you do not accept this policy, we will not use your information to create books, and you can ask us to delete the account too.

**About you, the parent:**
• Email address, and your name if you add it
• A profile picture, if you choose or create one
• Your subscription details (which plan and until when). We never see or store your card details.
• Name, phone and delivery address, only if you order a printed book
• A record of your approval of this policy: the version, the date and the browser type

**About your children, only what you type:**
• Name, age, and gender if you choose
• Interests, a description of the character's look and personality, and family members you mention in the story
• Please do not type sensitive details a story does not need, such as health, religion, origin or private family matters. We do not ask for them.

**Photos:** we do not ask for a photo to create a book. You can upload a photo only to draw a character for your profile picture, and we do not keep it. Only the drawing is kept (see section 6).

**What you created:**
• Your stories, illustrations, characters and ideas
• Settings, achievements and the count of books you created this month
• Who you follow, and in-app notifications, if you use them

**On your device:** a draft of a book you started is saved in the browser on that device until you finish or delete it. It stays after you sign out, so on a shared computer someone using the same browser may see it.

**What is kept automatically:**
• Page visit counts, to understand and improve the service. After you sign in, the count is linked to your internal account number. It holds no name or email, but we can link that number to your account.
• Technical error reports, without name, email or your children's details. Server logs may include a short piece of a creation request that failed, so please do not type details such as an address or phone number into requests.`,
      },
      {
        heading: '3. Why we need it',
        body: `• To create the book and keep it in your library
• To let you sign in, subscribe and pay
• To print and ship a book, if you ordered one
• To prevent abuse and fix problems
• To meet legal requirements, such as keeping payment records

We do not sell or rent information, we do not share it for advertising, we do not build a profile of your child, and we do not show ads to children.

**Advertising messages:** we do not send advertising by email. If we start, we will send only to people who asked for it explicitly and separately from signing up, every message will be marked as advertising, and you can unsubscribe at any time (Israeli Communications Law, section 30A).`,
      },
      {
        heading: '4. Who else receives it, and where it goes',
        body: `We work with outside companies. Here is every one of them and what each receives.

**Information also leaves Israel.** The database is in the European Union (Frankfurt, Germany). Most of the other providers process information in the United States, and some on servers in other countries of their choice. When you accept this policy, you agree to this transfer. You can ask us by email for the terms of any provider.

**Clerk** (clerk.com): sign-in. Receives your email, name, profile picture and account ID. Its sign-in code loads through **jsDelivr**, a file delivery service, so your IP address reaches it too. A bot check by **Cloudflare** may run when you sign up.

**Supabase** (supabase.com): the database and file storage, on servers in Frankfurt. Your books, characters and drawings are kept here.

**Vercel** (vercel.com): hosts our website and server. Every request passes through it.

**Google, Gemini services:** writes stories, draws illustrations, reads aloud (if you chose a cloud voice) and answers the FAQ chat. Receives the creation request: topic, character names, age, look and personality descriptions, family members you mentioned, and language. Sometimes it also receives the cover drawing, so the character looks the same on every page. If you uploaded a photo to draw a profile character, the photo is sent to it to be drawn. How long it keeps the photo is set by its own terms.

**OpenAI:** draws illustrations and reads aloud, depending on the model chosen. Receives the illustration request or the text to read, and sometimes the cover drawing. If you uploaded a photo to draw a profile character and the chosen model is OpenAI's, the photo is sent to it to be drawn. How long it keeps the photo is set by its own terms.

**Read-aloud:** by default, reading aloud happens in your own browser and the text does not leave the device. Only if you choose a cloud voice is the text sent to Google or OpenAI.

**Creem** (creem.io): payment for subscriptions. Receives your email, and keeps your card details.

**Morning (Green Invoice):** payment and receipt for a printed-book order, if you place one. Receives your name and the amount.

**Print vendor BookPod:** only when you order a printed book. Receives the book files, and your name, phone and delivery address. (Printed-book ordering is not yet open to everyone.)

**Sentry** (sentry.io): error reports, without name, email or your children's details.

**Umami** (analytics.sipurai.ai): visit counting without cookies, on our own domain. After you sign in, the count is tagged with your internal account number.

**Sanity** (sanity.io): blog content. When you open the blog, your browser contacts them.

**Google Fonts:** the site fonts load from Google, so your IP address reaches them.

**The FAQ chat on the site** (open to people who have not signed up): the messages typed into it are sent to Google so that it can answer. Please do not write details about your children in it.

We do not train an artificial intelligence model on your books. What the providers do with the requests they receive, and how long they keep them, is set by their own terms, and we cannot change them. We send providers only what is needed to create the content.`,
      },
      {
        heading: '5. Children',
        id: 'coppa', // kept: the landing trust badge links to /privacy#coppa
        body: `• The account belongs to the parent. Children do not sign up themselves, and the app never asks them for information.
• Children can read and listen to books on your device while you are signed in. What happens in the account is your responsibility.
• The parent decides what information about the child to enter. You can create a book with a made-up name or no real name.
• We do not send messages or ads to children.
• **A book you share to the community is visible to everyone who visits it:** the title, the text, the illustrations, and the names in the story. Anyone who sees it can also save a copy. Before sharing, make sure you are comfortable with that. You can stop sharing at any time with the "Stop sharing" button next to the book. The book leaves the community at once, but an illustration someone already opened may stay cached in their browser for up to one day, and a copy someone saved stays with them.
• Books you did not share are visible in the app only to you, and to anyone you invited to edit them with you. For the drawings themselves, see section 6.
• If you think a child opened an account, or information about a child is kept without a parent's consent, write to ${CONTACT_EMAIL} and we will delete it from our systems.`,
      },
      {
        heading: '6. Photos and drawings',
        id: 'photos',
        body: `**A photo you upload:** you can upload a photo only to draw a character for your profile picture. Before the upload you are asked for a separate approval. If it is a photo of a child, upload it only if you are that child's parent or guardian.

**How it works:** the browser makes the photo smaller, removes hidden data such as location, and sends it to our server. Our server passes it to the drawing service (Google or OpenAI, depending on the model chosen). The drawing that comes back is what is kept. The photo itself is never written to our storage or database.

**What we do not control:** how long the drawing service holds a request is set by its own terms. That is why section 4 says who receives the photo.

**Who can see drawings:** drawings, meaning book illustrations, covers and profile characters, are kept in closed storage. Only the person who created them, while signed in, can open them. Drawings of a book you shared to the community are visible to everyone while the book is shared.`,
      },
      {
        heading: '7. How long we keep it',
        body: `Information is kept as long as the account exists. We currently have no automatic deletion of unused accounts.

**A character you delete** disappears from the library, but its drawing file stays in storage until the account is deleted. **A single book** can be deleted with the "Delete book" button next to it. This deletes the book, its pages, its community post and its drawing files. A deleted book cannot be restored.

Financial records of orders are kept for as long as the law requires, also after the account is deleted.

Error reports, visit counts and server logs are kept by the providers under their own rules.`,
      },
      {
        heading: '8. How to delete everything',
        id: 'delete',
        body: !deleteEnabled
          ? `Automatic account deletion is not open yet. To delete, write to ${CONTACT_EMAIL} and we will delete from our active systems the account, your children's details, characters, books, drawings and settings, except what is listed below. We will confirm the deletion within 30 days.

**What stays:** if you ordered a printed book, the financial record of the order is kept because the law requires us to keep it, without the delivery address.

**What we cannot delete in one step:** information already held by outside providers, such as the payment record at Creem and Morning, a printed order at BookPod, error reports, visit counts, and what the AI providers keep under their own terms. If you ask, we will contact the providers and ask them to delete what they can.

Backup copies at the hosting provider may be kept for a limited time after deletion.`
          : `At any time, press **Settings, Account, Delete my account and data**. Deletion is immediate and cannot be undone.

**What is deleted:** the account, your children's details and characters, books, pages, drawings, settings and achievements, and the record of your policy approvals. Drafts in the browser are deleted too, on the device you deleted from.

**What stays:** if you ordered a printed book and it shipped, the financial record of the order is kept because the law requires us to keep it. The delivery address is removed from it.

**What a click does not delete:** information already held by outside providers, such as the payment record at Creem and Morning, a printed order at BookPod, error reports, visit counts, and what the AI providers keep under their own terms. If you ask, we will contact the providers and ask them to delete what they can.

**When we cannot delete right away:** when there is an active paid subscription (cancel it first, because deleting does not stop billing) or a printed order still on its way.

Backup copies at the hosting provider may be kept for a limited time after deletion.

You can also write to ${CONTACT_EMAIL} and we will delete it for you.`,
      },
      {
        heading: '9. Your rights',
        body: `Under the Israeli Privacy Protection Law you have the right to see the information we hold about you and your children, and to ask us to correct or delete information that is not correct, complete, clear or up to date. Beyond that, we also let you get a copy of your information and delete it at any time.

You can withdraw your consent at any time. After that we will not create books for you, and you can delete the account as in section 8.

Send requests to ${CONTACT_EMAIL}. We will give access within 30 days; if we must refuse, we will tell you within 21 days and explain why. If we correct or delete information that was wrong, we will also tell whoever received it from us.

If you think we did not handle your information properly, you can also contact the Privacy Protection Authority at the Israeli Ministry of Justice.`,
      },
      {
        heading: '10. Security',
        body: `• All communication is encrypted (HTTPS).
• Your children's details and books you did not share are accessible in the database only to you, and to anyone you invited to edit with you. Permissions are checked on the server, not only in the browser.
• Access to the AI services goes through our server, and the keys are not exposed to the browser.
• Error reports are filtered before they leave, so they do not include names, email or children's details.

No system is 100 percent secure. If a security incident happens, we will investigate it and act to limit the harm. We will report it to the Privacy Protection Authority and to the people affected when the law requires it, and consider telling you in other cases too.`,
      },
      {
        heading: '11. Cookies and browser storage',
        body: `We have no tracking cookies and no ads. Visit counting is done without cookies. The sign-in service (Clerk) keeps a necessary sign-in cookie so that you stay signed in.

The app keeps drafts, settings and your reading place in your browser, so you do not lose work. That information stays on the device.`,
      },
      {
        heading: '12. When the policy changes',
        body: `When we change something important, we update the version number above. The next time you open the app we will briefly show what changed and ask you to approve once. A story that is already in progress carries on to the end, and we will not stop you in the middle of it.

A small change that does not change what happens with your information, such as a wording or link fix, will appear here without asking you to approve again.`,
      },
      {
        heading: '13. Contact',
        body: `Email: ${CONTACT_EMAIL}`,
      },
    ],
  },
});

/**
 * The plain summary shown on the privacy gate. Short on purpose; the full text is one tap away.
 * Each row is { icon, title, text }. Icons are lucide names resolved in the component.
 * Three boxes (api/_lib/policyVersion.js CONSENT_ITEMS): guardian, privacyItem, termsItem. The privacy
 * box names the children's data and the transfer abroad explicitly, because consent is the legal basis
 * for sending the data to providers outside Israel (transfer regulations, reg. 2(1)).
 * Parents who accepted an older version see updatedTitle / updatedLead / whatChanged instead of title / lead.
 */
const buildGateCopy = (deleteEnabled) => ({
  he: {
    title: 'לפני שמתחילים: ההחלטה בידיים שלכם',
    lead: 'סיפוראי שומרת מידע על הילדים שלכם כדי ליצור להם ספרים. הנה בקצרה מה קורה איתו, ואתם מחליטים אם להמשיך.',
    updatedTitle: 'עדכנו את מדיניות הפרטיות',
    updatedLead: 'הסברנו טוב יותר מה קורה עם המידע. הנה מה השתנה. מאשרים פעם אחת, וממשיכים לקרוא וליצור.',
    whatChanged: [
      'כתבנו במפורש שאין חובה למסור מידע, ומי אחראי עליו.',
      'פירטנו לאן המידע עובר: בסיס הנתונים באיחוד האירופי, ורוב הספקים בארצות הברית.',
      'הציורים נשמרים עכשיו באחסון סגור, ורק אתם רואים אותם. ספר משותף גלוי לכולם, כולל השמות, ואפשר להפסיק לשתף או למחוק ספר בכפתור.',
      'פירטנו מה לא נמחק בלחיצה, למשל רשומות תשלום ומה שנשאר אצל ספקים.',
      'תמונה מעלים רק לציור דמות פרופיל, ועכשיו מאשרים את זה בנפרד לפני ההעלאה.',
    ],
    rows: [
      { icon: 'database', title: 'מה אנחנו שומרים', text: 'עליכם: מייל ושם. על הילד: רק מה שתקלידו, כמו שם, גיל ותיאור הדמות. ואת הספרים והאיורים שיצרתם. אין חובה למסור מידע, ואפשר שם בדוי.' },
      { icon: 'camera', title: 'תמונות וציורים', text: 'תמונה אפשר להעלות רק כדי לצייר דמות לתמונת הפרופיל. היא עוברת ל-Google או ל-OpenAI לצורך הציור ולא נשמרת אצלנו. הציורים נשמרים באחסון סגור ורק אתם רואים אותם, חוץ מספר ששיתפתם.' },
      { icon: 'sparkles', title: 'למה', text: 'כדי ליצור את הספר, לשמור אותו בספרייה שלכם ולהדפיס אותו אם תזמינו. וגם להתחברות, לתשלום, לאבטחה ולתיקון תקלות. לא מוכרים מידע, לא משתפים אותו לפרסום ולא מפרסמים לילדים.' },
      { icon: 'users', title: 'מי עוד מטפל בו, ובאיזו מדינה', text: 'Google ו-OpenAI כותבות ומציירות. Clerk מנהלת את ההתחברות, Supabase שומרת את הקבצים (באיחוד האירופי), Vercel מארחת את האתר, ו-Creem מטפלת בתשלום. רוב הספקים בארצות הברית.', help: 'חברה חיצונית היא חברה אחרת שהאפליקציה משתמשת בה כדי לעבוד, למשל כדי להתחבר או ליצור תמונה. ברשימה המלאה במדיניות מופיעה כל אחת ומה היא מקבלת.' },
      { icon: 'trash', title: 'אפשר למחוק', text: deleteEnabled ? 'בכל רגע, בהגדרות. נמחקים החשבון, פרטי הילדים, הספרים והציורים. רשומות תשלום נשמרות כמו שהחוק מחייב.' : 'בכל רגע אפשר לבקש במייל שנמחק את החשבון, פרטי הילדים, הספרים והציורים. רשומות תשלום נשמרות כמו שהחוק מחייב. הכתובת: support@sipurai.ai' },
      { icon: 'heart', title: 'אתם ההורים מחליטים', text: 'החשבון שלכם, והילדים לא נרשמים בעצמם. ספר שתשתפו בקהילה יהיה גלוי לכולם, כולל השמות שבו, אז שתפו רק מה שנוח לכם.' },
    ],
    fullPolicy: 'לקריאת המדיניות המלאה',
    terms: 'תנאי השימוש',
    guardian: 'אני ההורה או האפוטרופוס, בן או בת 18 ומעלה',
    privacyItem: 'קראתי את מדיניות הפרטיות, ואני מסכים או מסכימה שסיפוראי תשמור את פרטי החשבון שלי ואת מה שאכניס על הילדים שלי, ותעביר אותם לספקים שבמדיניות, גם מחוץ לישראל (בעיקר לארצות הברית ולאיחוד האירופי, שבהן ההגנה על מידע עשויה להיות שונה מבישראל), כדי ליצור את הספרים ולתפעל את השירות',
    termsItem: 'קראתי ואני מסכים או מסכימה לתנאי השימוש',
    accept: 'אישור והמשך',
    saving: 'שומרים את האישור…',
    signOut: 'התנתקות',
    notNow: 'לא עכשיו',
    notNowHint: 'נתנתק אתכם, ואפשר לחזור בכל זמן.',
    missing: 'כדי להמשיך צריך לסמן את כל התיבות.',
    saveError: 'לא הצלחנו לשמור את האישור. בדקו את החיבור ונסו שוב.',
    retry: 'נסו שוב',
    loading: 'בודקים את האישור שלכם…',
    loadError: 'לא הצלחנו לבדוק את אישור הפרטיות.',
    loadErrorHelp: 'זה לרוב קורה כשהחיבור נפל לרגע. אפשר לנסות שוב.',
    success: 'תודה, הכל מוכן',
    version: 'גרסת המדיניות',
    illustration: 'איור של מגן ושל ספר פתוח',
  },
  en: {
    title: 'Before we start: you decide',
    lead: "Sipurai keeps information about your children so it can create books for them. Here is a short summary of what happens with it, and you decide whether to continue.",
    updatedTitle: 'We updated our privacy policy',
    updatedLead: 'We explained more clearly what happens with your information. Here is what changed. Approve once, and carry on reading and creating.',
    whatChanged: [
      'We say plainly that giving information is not required, and who is responsible for it.',
      'We list where information goes: the database is in the European Union, and most providers are in the United States.',
      'Drawings are now kept in closed storage that only you can open. A shared book is visible to everyone, names included, and you can stop sharing or delete a book with a button.',
      'We list what a click does not delete, such as payment records and what stays with providers.',
      'A photo can be uploaded only to draw a profile character, and you now approve that separately before the upload.',
    ],
    rows: [
      { icon: 'database', title: 'What we keep', text: 'About you: email and name. About your child: only what you type, such as name, age and character description. Plus the books and illustrations you create. Giving information is not required, and a made-up name is fine.' },
      { icon: 'camera', title: 'Photos and drawings', text: 'A photo can be uploaded only to draw a character for your profile picture. It passes to Google or OpenAI to be drawn and is not kept by us. Drawings are kept in closed storage that only you can open, except for a book you shared.' },
      { icon: 'sparkles', title: 'Why', text: 'To create the book, keep it in your library and print it if you order. Also for sign-in, payment, security and fixing problems. We do not sell information, share it for advertising, or advertise to children.' },
      { icon: 'users', title: 'Who else handles it, and where', text: 'Google and OpenAI write and draw. Clerk handles sign-in, Supabase stores the files (in the European Union), Vercel hosts the site, and Creem handles payment. Most providers are in the United States.', help: 'An outside company is another company the app uses to work, for example to sign in or to create an image. The full list in the policy shows each one and what it receives.' },
      { icon: 'trash', title: 'You can delete', text: deleteEnabled ? 'At any time, in Settings. The account, your children\'s details, books and drawings are deleted. Payment records are kept as the law requires.' : 'At any time you can ask by email to support@sipurai.ai and we will delete the account, your children\'s details, books and drawings. Payment records are kept as the law requires.' },
      { icon: 'heart', title: 'You, the parent, decide', text: 'The account is yours, and children do not sign up themselves. A book you share to the community is visible to everyone, names included, so share only what you are comfortable with.' },
    ],
    fullPolicy: 'Read the full policy',
    terms: 'Terms of Service',
    guardian: 'I am the parent or guardian, aged 18 or over',
    privacyItem: 'I have read the privacy policy, and I agree that Sipurai keeps my account details and what I enter about my children, and passes them to the providers listed in the policy, also outside Israel (mainly the United States and the European Union, where data protection may differ from Israel), to create the books and run the service',
    termsItem: 'I have read and agree to the terms of service',
    accept: 'Accept and continue',
    saving: 'Saving your approval…',
    signOut: 'Sign out',
    notNow: 'Not now',
    notNowHint: 'We will sign you out, and you can come back any time.',
    missing: 'To continue, please tick all the boxes.',
    saveError: 'We could not save your approval. Check your connection and try again.',
    retry: 'Try again',
    loading: 'Checking your approval…',
    loadError: 'We could not check your privacy approval.',
    loadErrorHelp: 'This usually happens when the connection dropped for a moment. You can try again.',
    success: 'Thank you, all set',
    version: 'Policy version',
    illustration: 'Illustration of a shield and an open book',
  },
});

// Account deletion by button is switched off until it is fully tested. The wording follows the switch, so the
// text never promises a button that is not there. (Vite replaces import.meta.env at build time.)
export const ACCOUNT_DELETE_UI = import.meta.env?.VITE_ACCOUNT_DELETE_ENABLED === 'true';
export const policyContent = buildPolicyContent(ACCOUNT_DELETE_UI);
export const gateCopy = buildGateCopy(ACCOUNT_DELETE_UI);
export { buildPolicyContent, buildGateCopy };
