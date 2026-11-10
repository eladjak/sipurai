/**
 * Privacy policy text (Hebrew + English). One place, used by /privacy and by the privacy gate.
 *
 * Rule for editing: say only what the code really does. Every processor below was found by
 * reading api/ and src/ (outbound calls, index.html, vercel.json), not copied from an older text.
 * When the policy changes in a way parents should see again, bump CURRENT_POLICY_VERSION in
 * api/_lib/policyVersion.js (and LAST_UPDATED below) and every parent is asked again.
 *
 * NOT REVIEWED BY A LAWYER. Do not present it as legal advice.
 */
import { CURRENT_POLICY_VERSION } from '../../api/_lib/policyVersion.js';

export const POLICY_VERSION = CURRENT_POLICY_VERSION;
export const CONTACT_EMAIL = 'support@sipurai.ai';
export const LAST_UPDATED = { he: '10 בנובמבר 2026', en: 'November 10, 2026' };

const buildPolicyContent = (deleteEnabled) => ({
  he: {
    metaTitle: 'מדיניות פרטיות',
    metaDesc: 'איזה מידע סיפוראי שומרת עליכם ועל הילדים, מי מטפל בו, כמה זמן, ואיך מוחקים.',
    title: 'מדיניות פרטיות',
    subtitle: `גרסה ${POLICY_VERSION} · עדכון אחרון: ${LAST_UPDATED.he}`,
    backLink: 'חזרה לדף הבית',
    termsLink: 'תנאי שימוש',
    sections: [
      {
        heading: '1. מי אנחנו',
        body: `סיפוראי (sipurai.ai) יוצרת ספרי ילדים מותאמים אישית בעזרת בינה מלאכותית.

ההורה הוא המשתמש והלקוח. הילדים לא פותחים חשבון בעצמם, והחשבון תמיד של הורה או אפוטרופוס בן 18 ומעלה.

לשאלות על פרטיות: ${CONTACT_EMAIL}`,
      },
      {
        heading: '2. איזה מידע אנחנו שומרים',
        body: `**בדף הבית, לפני הרשמה:** אפשר להקליד שם כדי לראות ספר לדוגמה. השם נשאר רק בדפדפן שלכם, לא נשלח אלינו ולא נשמר.

**עליכם, ההורים:**
• כתובת מייל, ושם אם הוספתם
• תמונת פרופיל, אם בחרתם או העליתם
• פרטי המנוי שלכם (איזו תוכנית ומתי היא נגמרת). את פרטי כרטיס האשראי אנחנו לא רואים ולא שומרים.
• כתובת למשלוח, רק אם הזמנתם ספר מודפס

**על הילדים:**
• שם, טווח גיל ותיאור של הדמות, כמו שהקלדתם אותם כשיצרתם ספר
• תמונה: אנחנו לא מבקשים תמונה כדי ליצור ספר. אם תעלו תמונה כדי ליצור דמות, היא לא נשמרת אצלנו. נשמר רק הציור שנוצר ממנה (ראו סעיף 6).

**מה שיצרתם:**
• הסיפורים, האיורים, הדמויות והרעיונות שלכם
• הגדרות, הישגים ומונה הספרים שיצרתם החודש

**מה נשמר אוטומטית:**
• נתוני שימוש כלליים באתר, בלי עוגיות ובלי זיהוי אישי
• דיווחי תקלות טכניות. אנחנו מסננים מהם שם ומייל, אבל יומני השרת עלולים לכלול קטע קצר מבקשת היצירה, ולכן אל תכתבו בבקשות פרטים כמו כתובת או טלפון.`,
      },
      {
        heading: '3. למה אנחנו צריכים את זה',
        body: `• ליצור את הספר ולשמור אותו בספרייה שלכם
• לאפשר התחברות, מנוי ותשלום
• להדפיס ולשלוח ספר, אם הזמנתם
• למנוע שימוש לרעה ולתקן תקלות
• לעמוד בדרישות החוק

אנחנו לא מוכרים מידע, לא משכירים אותו, לא משתפים אותו לצורכי פרסום ולא מציגים פרסומות מותאמות לילדים.`,
      },
      {
        heading: '4. מי עוד מטפל במידע',
        body: `אנחנו עובדים עם חברות חיצוניות. הנה סוגי השירותים ומה כל אחד מקבל. חלק מהספקים פועלים מחוץ לישראל, בעיקר בארצות הברית.

רוצים לדעת בדיוק אילו חברות? כתבו ל־${CONTACT_EMAIL} ונשלח את הרשימה המלאה.

**שירות התחברות**: ההתחברות. השירות מקבל את המייל, השם ומזהה החשבון.

**שירות אחסון ונתונים**: בסיס הנתונים ואחסון הקבצים, בשרתים באיחוד האירופי. כאן נשמרים הספרים, הדמויות והתמונות.

**שירות אירוח**: אירוח האתר והשרת שלנו. כל בקשה עוברת דרכו.

**ספק בינה מלאכותית:** יצירת סיפורים, איורים וקול. הספק מקבל את בקשת היצירה: נושא, שמות הדמויות ותיאורן, טווח הגיל והשפה, ולפעמים את תמונת העטיפה כדי לשמור על דמות עקבית. אם העליתם תמונה ליצירת דמות, היא מגיעה אליו, רק לשניות שלוקח לצייר.

**ספק בינה מלאכותית נוסף:** יצירת איורים והקראה בקול, לפי המודל שנבחר. הספק מקבל את הטקסט להקראה או את בקשת האיור, ולפעמים את תמונת העטיפה. אם העליתם תמונה ליצירת דמות ונבחר המודל של הספק הזה, היא מגיעה אליו, רק לשניות שלוקח לצייר.

**ספק סליקה**: תשלום על מנוי. אצלם נשמרים פרטי כרטיס האשראי.

**שירות חשבוניות:** תשלום והוצאת חשבונית על הזמנת ספר מודפס, אם הזמנתם.

**ספק הדפסה:** רק כשמזמינים ספר מודפס. מקבל את קובצי הספר ואת כתובת המשלוח. (הזמנת ספרים מודפסים עדיין לא נפתחה לכולם.)

**שירות דיווח תקלות**: דיווחי תקלות, בלי שם ומייל.

**שירות מדידת ביקורים** (analytics.sipurai.ai): ספירת ביקורים בלי עוגיות. השירות רץ על הדומיין שלנו.

**שירות תוכן לבלוג**: תוכן הבלוג. כשפותחים את הבלוג הדפדפן פונה אליהם.

**שירות גופנים:** הגופנים של האתר נטענים משירות גופנים, ולכן כתובת ה-IP שלכם מגיעה אליהם.

**צ'אט השאלות באתר** (פתוח גם למי שלא נרשם): ההודעות שכותבים בו נשלחות לספק בינה מלאכותית כדי שיענו. אל תכתבו בו פרטים על הילדים.

בינה מלאכותית לא לומדת מהספרים שלכם אצלנו, כי אנחנו לא מאמנים מודל. מה שהספקים החיצוניים עושים בבקשות נקבע בתנאים שלהם, ואנחנו לא שולטים בכך.`,
      },
      {
        heading: '5. ילדים',
        id: 'coppa', // kept: the landing trust badge links to /privacy#coppa
        body: `• החשבון הוא של ההורה ומיועד להורים בלבד. הילדים לא נרשמים בעצמם.
• ההורה מחליט איזה מידע על הילד להכניס. אפשר ליצור ספר עם שם בדוי או בלי שם אמיתי.
• אנחנו לא פונים לילדים בהודעות ובפרסומות.
• ספר ששיתפתם בקהילה גלוי לכל מי שנכנס לשם, כולל השמות והאיורים שבו. לפני שמשתפים, בדקו שאתם מסכימים לכך.
• ספרים שלא שיתפתם נראים רק לכם, ולמי שהזמנתם לערוך אותם יחד איתכם.
• אם אתם חושבים שילד פתח חשבון או שמידע על ילד נשמר בלי הסכמת הורה, כתבו לנו ל-${CONTACT_EMAIL} ונמחק.`,
      },
      {
        heading: '6. תמונות שאתם מעלים',
        id: 'photos',
        body: `תמונה שמעלים כדי ליצור דמות משמשת פעם אחת לציור, ואחר כך היא לא נשמרת אצלנו. נשמר רק הציור.

**איך זה עובד:** הדפדפן מקטין את התמונה ומעביר אותה לשרת שלנו, והשרת מעביר אותה לשירות הציור (ספק בינה מלאכותית, לפי המודל שנבחר). הציור שחוזר הוא מה שנשמר. התמונה עצמה לא נכתבת אצלנו לאחסון ולא נכנסת לבסיס הנתונים.

**מה אנחנו לא שולטים בו:** כמה זמן שירות הציור שומר בקשה אצלו נקבע בתנאים שלו. לכן כתבנו בסעיף 4 מי מקבל את התמונה.

**מה כן גלוי:** קבצי הציורים נשמרים באחסון ציבורי. מי שיש לו את כתובת הציור יכול לפתוח אותו, גם אם הספר לא שותף בקהילה.`,
      },
      {
        heading: '7. כמה זמן אנחנו שומרים',
        body: `המידע נשמר כל עוד החשבון קיים. אין לנו כרגע מחיקה אוטומטית של חשבונות שלא בשימוש.

ספר או דמות שמחקתם מהספרייה נמחקים משם. אחרי מחיקת חשבון הכל נמחק, כמו שמוסבר בסעיף 8.

דיווחי תקלות ויומני שרת נשמרים אצל הספקים לפי הכללים שלהם.`,
      },
      {
        heading: '8. איך מוחקים הכל',
        id: 'delete',
        body: !deleteEnabled
          ? `כרגע מחיקה אוטומטית של החשבון עדיין לא פתוחה. כדי למחוק, כתבו ל-${CONTACT_EMAIL} ואנחנו נמחק את החשבון, הילדים, הספרים, התמונות וההגדרות. נענה תוך 30 יום.

**מה נשאר:** אם הזמנתם ספר מודפס והוא נשלח, הרשומה הכספית של ההזמנה נשמרת כי החוק מחייב אותנו לשמור אותה, בלי כתובת המשלוח.

עותקי גיבוי אצל ספק האחסון עשויים להישמר זמן מוגבל אחרי המחיקה.`
          : `בכל רגע אפשר ללחוץ על **הגדרות, חשבון, מחיקת החשבון והנתונים**. המחיקה מיידית ואי אפשר לשחזר אותה.

**מה נמחק:** החשבון, הילדים והדמויות, הספרים, הדפים, התמונות והקבצים שהעליתם, ההגדרות וההישגים, ואישורי הפרטיות.

**מה נשאר:** אם הזמנתם ספר מודפס והוא נשלח, הרשומה הכספית של ההזמנה נשמרת כי החוק מחייב אותנו לשמור אותה. כתובת המשלוח נמחקת ממנה.

**מתי לא אפשר למחוק מיד:** כשיש מנוי בתשלום פעיל (צריך קודם לבטל אותו, כי מחיקה לא מפסיקה חיוב) או הזמנה מודפסת שעדיין בדרך.

עותקי גיבוי אצל ספק האחסון עשויים להישמר זמן מוגבל אחרי המחיקה.

אפשר גם לכתוב ל-${CONTACT_EMAIL} ונמחק בשבילכם.`,
      },
      {
        heading: '9. הזכויות שלכם',
        body: `אתם יכולים לבקש לראות את המידע שיש לנו עליכם ועל הילדים, לתקן אותו, לקבל עותק, או למחוק אותו.

מחיקה אפשר לעשות כמו בסעיף 8. את שאר הבקשות שלחו ל-${CONTACT_EMAIL}. נענה תוך 30 יום.`,
      },
      {
        heading: '10. אבטחה',
        body: `• כל התקשורת מוצפנת (HTTPS).
• בבסיס הנתונים כל משתמש רואה רק את מה שיצר בעצמו. ההרשאות נבדקות בשרת ולא רק בדפדפן.
• הגישה לשירותי הבינה המלאכותית עוברת דרך השרת שלנו, והמפתחות לא נחשפים לדפדפן.

שום מערכת אינה מאובטחת במאה אחוז. אם נגלה אירוע שפגע במידע שלכם, נודיע לכם.`,
      },
      {
        heading: '11. עוגיות',
        body: `אין לנו עוגיות מעקב ואין פרסומות. ספירת הביקורים נעשית בלי עוגיות. שירות ההתחברות שומר עוגיית התחברות הכרחית כדי שתישארו מחוברים.`,
      },
      {
        heading: '12. כשהמדיניות משתנה',
        body: `כשאנחנו משנים משהו מהותי, מעדכנים את מספר הגרסה למעלה. בפעם הבאה שתיכנסו תתבקשו לקרוא ולאשר מחדש, ועד שתאשרו לא נוכל ליצור בשבילכם ספרים.`,
      },
      {
        heading: '13. יצירת קשר',
        body: `מייל: ${CONTACT_EMAIL}`,
      },
    ],
  },
  en: {
    metaTitle: 'Privacy Policy',
    metaDesc: 'What Sipurai keeps about you and your children, who handles it, for how long, and how to delete it.',
    title: 'Privacy Policy',
    subtitle: `Version ${POLICY_VERSION} · Last updated: ${LAST_UPDATED.en}`,
    backLink: 'Back to Home',
    termsLink: 'Terms of Service',
    sections: [
      {
        heading: '1. Who we are',
        body: `Sipurai (sipurai.ai) creates personalized children's books with the help of artificial intelligence.

The parent is the user and the customer. Children do not open accounts. An account always belongs to a parent or guardian aged 18 or over.

Privacy questions: ${CONTACT_EMAIL}`,
      },
      {
        heading: '2. What we keep',
        body: `**On the home page, before signing up:** you can type a name to see a sample book. The name stays in your browser only; it is not sent to us and not stored.

**About you, the parent:**
• Email address, and your name if you add it
• Profile picture, if you choose or upload one
• Your subscription details (which plan and when it ends). We never see or store your card details.
• A delivery address, only if you order a printed book

**About your children:**
• Name, age range and a description of the character, as you typed them when creating a book
• Photos: we do not ask for a photo to create a book. If you upload a photo to create a character, we do not keep it. Only the drawing made from it is kept (see section 6).

**What you created:**
• Your stories, illustrations, characters and ideas
• Settings, achievements and the count of books you created this month

**What is kept automatically:**
• General site usage numbers, with no cookies and no personal identification
• Technical error reports. We filter name and email out of them, but server logs may include a short piece of a creation request, so please do not type details such as an address or phone number into requests.`,
      },
      {
        heading: '3. Why we need it',
        body: `• To create the book and keep it in your library
• To let you sign in, subscribe and pay
• To print and ship a book, if you ordered one
• To prevent abuse and fix problems
• To meet legal requirements

We do not sell or rent information, we do not share it for advertising, and we do not show targeted ads to children.`,
      },
      {
        heading: '4. Who else handles it',
        body: `We work with outside companies. Here are the categories of services and what each receives. Some providers operate outside Israel, mainly in the United States.

Want the exact companies? Write to ${CONTACT_EMAIL} and we will send the full list.

**sign-in service**: sign-in. Receives your email, name and account ID.

**storage and database service**: the database and file storage, on servers in the European Union. Your books, characters and images are kept here.

**hosting service**: hosts our website and server. Every request passes through it.

**AI provider:** creates stories, illustrations and voice. Receives the creation request: topic, character names and descriptions, age range and language, and sometimes the cover image to keep a character consistent. If you uploaded a photo to create a character, it reaches them, only for the seconds it takes to draw.

**another AI provider:** creates illustrations and read-aloud voice, depending on the model chosen. Receives the text to read or the illustration request, and sometimes the cover image. If you uploaded a photo to create a character and the chosen model is from this provider, it reaches them, only for the seconds it takes to draw.

**payment provider**: payment for subscriptions. Your card details are kept by them.

**invoicing service:** payment and invoice for a printed-book order, if you place one.

**printing provider:** only when you order a printed book. Receives the book files and the delivery address. (Printed-book ordering is not yet open to everyone.)

**error-reporting service**: error reports, without name and email.

**visit counting service** (analytics.sipurai.ai): visit counting without cookies. It runs on our own domain.

**blog content service**: blog content. When you open the blog your browser contacts them.

**font service:** the site fonts load from a font service, so your IP address reaches them.

**The FAQ chat on the site** (open to people who have not signed up): the messages typed into it are sent to an AI provider so that it can answer. Please do not write details about your children in it.

Artificial intelligence does not learn from your books on our side, because we do not train a model. What the outside providers do with requests is set by their own terms, and we do not control that.`,
      },
      {
        heading: '5. Children',
        id: 'coppa', // kept: the landing trust badge links to /privacy#coppa
        body: `• The account belongs to the parent and is meant for parents only. Children do not sign up themselves.
• The parent decides what information about the child to enter. You can create a book with a made-up name or no real name.
• We do not send messages or ads to children.
• A book you share to the community is visible to everyone who visits it, including the names and illustrations in it. Before sharing, make sure you are comfortable with that.
• Books you did not share are visible only to you, and to anyone you invited to edit them with you.
• If you think a child opened an account, or information about a child is kept without a parent's consent, write to ${CONTACT_EMAIL} and we will delete it.`,
      },
      {
        heading: '6. Photos you upload',
        id: 'photos',
        body: `A photo uploaded to create a character is used once to draw, and then we do not keep it. Only the drawing is kept.

**How it works:** the browser makes the photo smaller and sends it to our server, and our server passes it to the drawing service (an AI provider, depending on the model chosen). The drawing that comes back is what is kept. The photo itself is never written to our storage or database.

**What we do not control:** how long the drawing service holds a request is set by its own terms. That is why section 4 says who receives the photo.

**What is visible:** drawing files are kept in public storage. Anyone who has the address of a drawing can open it, even if the book was not shared to the community.`,
      },
      {
        heading: '7. How long we keep it',
        body: `Information is kept as long as the account exists. We currently have no automatic deletion of unused accounts.

A book or character you delete from the library is deleted from there. After you delete the account, everything is deleted, as explained in section 8.

Error reports and server logs are kept by the providers under their own rules.`,
      },
      {
        heading: '8. How to delete everything',
        id: 'delete',
        body: !deleteEnabled
          ? `Automatic account deletion is not open yet. To delete, write to ${CONTACT_EMAIL} and we will delete the account, the children, books, images and settings. We will answer within 30 days.

**What stays:** if you ordered a printed book and it shipped, the financial record of the order is kept because the law requires us to keep it, without the delivery address.

Backup copies at the hosting provider may be kept for a limited time after deletion.`
          : `At any time, press **Settings, Account, Delete my account and data**. Deletion is immediate and cannot be undone.

**What is deleted:** the account, the children and characters, books, pages, images and files you uploaded, settings and achievements, and your privacy approvals.

**What stays:** if you ordered a printed book and it shipped, the financial record of the order is kept because the law requires us to keep it. The delivery address is removed from it.

**When we cannot delete right away:** when there is an active paid subscription (cancel it first, because deleting does not stop billing) or a printed order still on its way.

Backup copies at the hosting provider may be kept for a limited time after deletion.

You can also write to ${CONTACT_EMAIL} and we will delete it for you.`,
      },
      {
        heading: '9. Your rights',
        body: `You can ask to see the information we hold about you and your children, correct it, get a copy, or delete it.

You can delete as described in section 8. Send other requests to ${CONTACT_EMAIL}. We will answer within 30 days.`,
      },
      {
        heading: '10. Security',
        body: `• All communication is encrypted (HTTPS).
• In the database each user sees only what they created. Permissions are checked on the server, not only in the browser.
• Access to the AI services goes through our server, and the keys are not exposed to the browser.

No system is 100 percent secure. If we discover an incident that affected your information, we will tell you.`,
      },
      {
        heading: '11. Cookies',
        body: `We have no tracking cookies and no ads. Visit counting is done without cookies. The sign-in service keeps a necessary sign-in cookie so that you stay signed in.`,
      },
      {
        heading: '12. When the policy changes',
        body: `When we change something important, we update the version number above. The next time you sign in you will be asked to read and approve again, and until you approve we cannot create books for you.`,
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
 */
const buildGateCopy = (deleteEnabled) => ({
  he: {
    title: 'לפני שמתחילים: ההחלטה בידיים שלכם',
    lead: 'סיפוראי שומרת מידע על הילדים שלכם כדי ליצור להם ספרים. הנה בקצרה מה קורה איתו, ואתם מחליטים אם להמשיך.',
    rows: [
      { icon: 'database', title: 'מה אנחנו שומרים', text: 'עליכם: מייל ושם. על הילד: שם, גיל ותיאור הדמות. ואת הספרים והאיורים שיצרתם.' },
      { icon: 'camera', title: 'תמונות שמעלים', text: 'תמונה שתעלו כדי ליצור דמות משמשת פעם אחת לציור ולא נשמרת אצלנו. נשמר רק הציור. לשניות שלוקח לצייר היא עוברת לספק בינה מלאכותית.' },
      { icon: 'sparkles', title: 'למה', text: 'רק כדי ליצור את הספר, לשמור אותו בספרייה שלכם ולהדפיס אותו אם תזמינו. לא מוכרים מידע, לא משתפים אותו לפרסום ולא מפרסמים לילדים.' },
      { icon: 'users', title: 'מי עוד מטפל בו', text: 'ספקי בינה מלאכותית מקבלים את בקשת היצירה כדי לכתוב ולצייר. שירות התחברות מנהל את ההתחברות, שירות אחסון שומר את הקבצים, שירות אירוח מארח את האתר וספק סליקה מטפל בתשלום.', help: 'חברה חיצונית היא חברה אחרת שהאפליקציה משתמשת בה כדי לעבוד, למשל כדי להתחבר או ליצור תמונה. ברשימה המלאה במדיניות מופיעה כל אחת ומה היא מקבלת.' },
      { icon: 'trash', title: 'אפשר למחוק הכל', text: deleteEnabled ? 'בכל רגע, בהגדרות. הכל נמחק, כולל התמונות והציורים.' : 'בכל רגע אפשר לבקש במייל שנמחק הכל, כולל התמונות והציורים. הכתובת: support@sipurai.ai' },
      { icon: 'heart', title: 'אתם ההורים מחליטים', text: 'החשבון הוא שלכם. הילדים לא נרשמים בעצמם, ואתם בוחרים איזה מידע עליהם להכניס. אפשר גם שם בדוי.' },
    ],
    fullPolicy: 'לקריאת המדיניות המלאה',
    terms: 'תנאי השימוש',
    guardian: 'אני ההורה או האפוטרופוס, בן או בת 18 ומעלה',
    agree: 'קראתי ואני מסכים או מסכימה למדיניות הפרטיות ולתנאי השימוש',
    accept: 'אישור והמשך',
    saving: 'שומרים את האישור…',
    signOut: 'התנתקות',
    notNow: 'לא עכשיו',
    notNowHint: 'נתנתק אתכם, ואפשר לחזור בכל זמן.',
    missing: 'כדי להמשיך צריך לסמן את שתי התיבות.',
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
    rows: [
      { icon: 'database', title: 'What we keep', text: 'About you: email and name. About your child: name, age and character description. Plus the books and illustrations you create.' },
      { icon: 'camera', title: 'Photos you upload', text: 'A photo you upload to create a character is used once to draw and is not kept by us. Only the drawing is kept. For the few seconds it takes to draw, it passes to an AI provider.' },
      { icon: 'sparkles', title: 'Why', text: 'Only to create the book, keep it in your library and print it if you order. We do not sell information, share it for advertising, or advertise to children.' },
      { icon: 'users', title: 'Who else handles it', text: 'AI providers receive the creation request to write and draw. A sign-in service handles sign-in, a storage service stores the files, a hosting service hosts the site, and a payment provider handles payment.', help: 'An outside company is another company the app uses to work, for example to sign in or to create an image. The full list in the policy shows each one and what it receives.' },
      { icon: 'trash', title: 'You can delete everything', text: deleteEnabled ? 'At any time, in Settings. Everything is deleted, including images and drawings.' : 'At any time you can ask by email to support@sipurai.ai and we will delete everything, including images and drawings.' },
      { icon: 'heart', title: 'You, the parent, decide', text: 'The account is yours. Children do not sign up themselves, and you choose what to enter about them. A made-up name is fine.' },
    ],
    fullPolicy: 'Read the full policy',
    terms: 'Terms of Service',
    guardian: 'I am the parent or guardian, aged 18 or over',
    agree: 'I have read and agree to the privacy policy and the terms of service',
    accept: 'Accept and continue',
    saving: 'Saving your approval…',
    signOut: 'Sign out',
    notNow: 'Not now',
    notNowHint: 'We will sign you out, and you can come back any time.',
    missing: 'To continue, please tick both boxes.',
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

