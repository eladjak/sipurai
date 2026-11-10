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

export const policyContent = {
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
        body: `**עליכם, ההורים:**
• כתובת מייל, ושם אם הוספתם
• תמונת פרופיל, אם בחרתם או העליתם
• פרטי המנוי שלכם (איזו תוכנית ומתי היא נגמרת). את פרטי כרטיס האשראי אנחנו לא רואים ולא שומרים.
• כתובת למשלוח, רק אם הזמנתם ספר מודפס

**על הילדים:**
• שם, טווח גיל ותיאור של הדמות, כמו שהקלדתם אותם כשיצרתם ספר
• תמונה, רק אם אתם מעלים אותה. אנחנו לא מבקשים תמונה של ילד כדי ליצור ספר.

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

אנחנו לא מוכרים מידע, לא משכירים אותו ולא מציגים פרסומות מותאמות לילדים.`,
      },
      {
        heading: '4. מי עוד מטפל במידע',
        body: `אנחנו עובדים עם חברות חיצוניות. הנה כולן, ומה כל אחת מקבלת.

**Clerk** (clerk.com): ההתחברות. מקבלת את המייל, השם ומזהה החשבון.

**Supabase** (supabase.com): בסיס הנתונים ואחסון הקבצים, בשרתים באיחוד האירופי. כאן נשמרים הספרים, הדמויות והתמונות.

**Vercel** (vercel.com): אירוח האתר והשרת שלנו. כל בקשה עוברת דרכו.

**Google, שירותי Gemini:** יצירת סיפורים, איורים וקול. מקבלת את בקשת היצירה: נושא, שמות הדמויות ותיאורן, טווח הגיל והשפה, ולפעמים את תמונת העטיפה כדי לשמור על דמות עקבית.

**OpenAI:** יצירת איורים והקראה בקול, לפי המודל שנבחר. מקבלת את הטקסט להקראה או את בקשת האיור, ולפעמים את תמונת העטיפה.

**Creem** (creem.io): תשלום על מנוי. אצלם נשמרים פרטי כרטיס האשראי.

**Morning, חשבונית ירוקה:** תשלום והוצאת חשבונית על הזמנת ספר מודפס, אם הזמנתם.

**ספק ההדפסה BookPod:** רק כשמזמינים ספר מודפס. מקבל את קובצי הספר ואת כתובת המשלוח. (הזמנת ספרים מודפסים עדיין לא נפתחה לכולם.)

**Sentry** (sentry.io): דיווחי תקלות, בלי שם ומייל.

**Umami** (analytics.sipurai.ai): ספירת ביקורים בלי עוגיות. השירות רץ על הדומיין שלנו.

**Sanity** (sanity.io): תוכן הבלוג. כשפותחים את הבלוג הדפדפן פונה אליהם.

**Google Fonts:** הגופנים של האתר נטענים מגוגל, ולכן כתובת ה-IP שלכם מגיעה אליהם.

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
        heading: '6. כמה זמן אנחנו שומרים',
        body: `המידע נשמר כל עוד החשבון קיים. אין לנו כרגע מחיקה אוטומטית של חשבונות שלא בשימוש.

ספר או דמות שמחקתם מהספרייה נמחקים משם. אחרי מחיקת חשבון הכל נמחק, כמו שמוסבר בסעיף הבא.

דיווחי תקלות ויומני שרת נשמרים אצל הספקים לפי הכללים שלהם.`,
      },
      {
        heading: '7. איך מוחקים הכל',
        id: 'delete',
        body: `בכל רגע אפשר ללחוץ על **הגדרות, חשבון, מחיקת החשבון והנתונים**. המחיקה מיידית ואי אפשר לשחזר אותה.

**מה נמחק:** החשבון, הילדים והדמויות, הספרים, הדפים, התמונות והקבצים שהעליתם, ההגדרות וההישגים, ואישורי הפרטיות.

**מה נשאר:** אם הזמנתם ספר מודפס והוא נשלח, הרשומה הכספית של ההזמנה נשמרת כי החוק מחייב אותנו לשמור אותה. כתובת המשלוח נמחקת ממנה.

**מתי לא אפשר למחוק מיד:** כשיש מנוי בתשלום פעיל (צריך קודם לבטל אותו, כי מחיקה לא מפסיקה חיוב) או הזמנה מודפסת שעדיין בדרך.

עותקי גיבוי אצל ספק האחסון עשויים להישמר זמן מוגבל אחרי המחיקה.

אפשר גם לכתוב ל-${CONTACT_EMAIL} ונמחק בשבילכם.`,
      },
      {
        heading: '8. הזכויות שלכם',
        body: `אתם יכולים לבקש לראות את המידע שיש לנו עליכם ועל הילדים, לתקן אותו, לקבל עותק, או למחוק אותו.

מחיקה אפשר לעשות לבד, כמו בסעיף 7. את שאר הבקשות שלחו ל-${CONTACT_EMAIL}. נענה תוך 30 יום.`,
      },
      {
        heading: '9. אבטחה',
        body: `• כל התקשורת מוצפנת (HTTPS).
• בבסיס הנתונים כל משתמש רואה רק את מה שיצר בעצמו. ההרשאות נבדקות בשרת ולא רק בדפדפן.
• הגישה לשירותי הבינה המלאכותית עוברת דרך השרת שלנו, והמפתחות לא נחשפים לדפדפן.

שום מערכת אינה מאובטחת במאה אחוז. אם נגלה אירוע שפגע במידע שלכם, נודיע לכם.`,
      },
      {
        heading: '10. עוגיות',
        body: `אין לנו עוגיות מעקב ואין פרסומות. ספירת הביקורים נעשית בלי עוגיות. שירות ההתחברות (Clerk) שומר עוגיית התחברות הכרחית כדי שתישארו מחוברים.`,
      },
      {
        heading: '11. כשהמדיניות משתנה',
        body: `כשאנחנו משנים משהו מהותי, מעדכנים את מספר הגרסה למעלה. בפעם הבאה שתיכנסו תתבקשו לקרוא ולאשר מחדש, ועד שתאשרו לא נוכל ליצור בשבילכם ספרים.`,
      },
      {
        heading: '12. יצירת קשר',
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
        body: `**About you, the parent:**
• Email address, and your name if you add it
• Profile picture, if you choose or upload one
• Your subscription details (which plan and when it ends). We never see or store your card details.
• A delivery address, only if you order a printed book

**About your children:**
• Name, age range and a description of the character, as you typed them when creating a book
• A photo, only if you upload one. We do not ask for a child's photo to create a book.

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

We do not sell or rent information, and we do not show targeted ads to children.`,
      },
      {
        heading: '4. Who else handles it',
        body: `We work with outside companies. Here is every one of them and what each receives.

**Clerk** (clerk.com): sign-in. Receives your email, name and account ID.

**Supabase** (supabase.com): the database and file storage, on servers in the European Union. Your books, characters and images are kept here.

**Vercel** (vercel.com): hosts our website and server. Every request passes through it.

**Google, Gemini services:** creates stories, illustrations and voice. Receives the creation request: topic, character names and descriptions, age range and language, and sometimes the cover image to keep a character consistent.

**OpenAI:** creates illustrations and read-aloud voice, depending on the model chosen. Receives the text to read or the illustration request, and sometimes the cover image.

**Creem** (creem.io): payment for subscriptions. Your card details are kept by them.

**Morning (Green Invoice):** payment and invoice for a printed-book order, if you place one.

**Print vendor BookPod:** only when you order a printed book. Receives the book files and the delivery address. (Printed-book ordering is not yet open to everyone.)

**Sentry** (sentry.io): error reports, without name and email.

**Umami** (analytics.sipurai.ai): visit counting without cookies. It runs on our own domain.

**Sanity** (sanity.io): blog content. When you open the blog your browser contacts them.

**Google Fonts:** the site fonts load from Google, so your IP address reaches them.

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
        heading: '6. How long we keep it',
        body: `Information is kept as long as the account exists. We currently have no automatic deletion of unused accounts.

A book or character you delete from the library is deleted from there. After you delete the account, everything is deleted, as explained in the next section.

Error reports and server logs are kept by the providers under their own rules.`,
      },
      {
        heading: '7. How to delete everything',
        id: 'delete',
        body: `At any time, press **Settings, Account, Delete my account and data**. Deletion is immediate and cannot be undone.

**What is deleted:** the account, the children and characters, books, pages, images and files you uploaded, settings and achievements, and your privacy approvals.

**What stays:** if you ordered a printed book and it shipped, the financial record of the order is kept because the law requires us to keep it. The delivery address is removed from it.

**When we cannot delete right away:** when there is an active paid subscription (cancel it first, because deleting does not stop billing) or a printed order still on its way.

Backup copies at the hosting provider may be kept for a limited time after deletion.

You can also write to ${CONTACT_EMAIL} and we will delete it for you.`,
      },
      {
        heading: '8. Your rights',
        body: `You can ask to see the information we hold about you and your children, correct it, get a copy, or delete it.

You can delete by yourself, as in section 7. Send other requests to ${CONTACT_EMAIL}. We will answer within 30 days.`,
      },
      {
        heading: '9. Security',
        body: `• All communication is encrypted (HTTPS).
• In the database each user sees only what they created. Permissions are checked on the server, not only in the browser.
• Access to the AI services goes through our server, and the keys are not exposed to the browser.

No system is 100 percent secure. If we discover an incident that affected your information, we will tell you.`,
      },
      {
        heading: '10. Cookies',
        body: `We have no tracking cookies and no ads. Visit counting is done without cookies. The sign-in service (Clerk) keeps a necessary sign-in cookie so that you stay signed in.`,
      },
      {
        heading: '11. When the policy changes',
        body: `When we change something important, we update the version number above. The next time you sign in you will be asked to read and approve again, and until you approve we cannot create books for you.`,
      },
      {
        heading: '12. Contact',
        body: `Email: ${CONTACT_EMAIL}`,
      },
    ],
  },
};

/**
 * The plain summary shown on the privacy gate. Short on purpose; the full text is one tap away.
 * Each row is { icon, title, text }. Icons are lucide names resolved in the component.
 */
export const gateCopy = {
  he: {
    title: 'לפני שמתחילים: ההחלטה בידיים שלכם',
    lead: 'סיפוראי שומרת מידע על הילדים שלכם כדי ליצור להם ספרים. הנה בקצרה מה קורה איתו, ואתם מחליטים אם להמשיך.',
    rows: [
      { icon: 'database', title: 'מה אנחנו שומרים', text: 'עליכם: מייל ושם. על הילד: שם, גיל ותיאור הדמות, ותמונה רק אם תעלו. ואת הספרים והאיורים שיצרתם.' },
      { icon: 'sparkles', title: 'למה', text: 'רק כדי ליצור את הספר, לשמור אותו בספרייה שלכם ולהדפיס אותו אם תזמינו. לא מוכרים מידע ולא מפרסמים לילדים.' },
      { icon: 'users', title: 'מי עוד מטפל בו', text: 'Google ו-OpenAI מקבלות את בקשת היצירה כדי לכתוב ולצייר. Clerk מנהלת את ההתחברות, Supabase שומרת את הקבצים, Vercel מארחת את האתר, ו-Creem מטפלת בתשלום.', help: 'חברה חיצונית היא חברה אחרת שהאפליקציה משתמשת בה כדי לעבוד, למשל כדי להתחבר או ליצור תמונה. ברשימה המלאה במדיניות מופיעה כל אחת ומה היא מקבלת.' },
      { icon: 'trash', title: 'אפשר למחוק הכל', text: 'בכל רגע, בהגדרות, בלחיצה אחת. הכל נמחק מיד, כולל התמונות.' },
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
      { icon: 'database', title: 'What we keep', text: 'About you: email and name. About your child: name, age and character description, and a photo only if you upload one. Plus the books and illustrations you create.' },
      { icon: 'sparkles', title: 'Why', text: 'Only to create the book, keep it in your library and print it if you order. We do not sell information or advertise to children.' },
      { icon: 'users', title: 'Who else handles it', text: 'Google and OpenAI receive the creation request to write and draw. Clerk handles sign-in, Supabase stores the files, Vercel hosts the site, and Creem handles payment.', help: 'An outside company is another company the app uses to work, for example to sign in or to create an image. The full list in the policy shows each one and what it receives.' },
      { icon: 'trash', title: 'You can delete everything', text: 'At any time, in Settings, with one tap. Everything is deleted right away, including the images.' },
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
};
