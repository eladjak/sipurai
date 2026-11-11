# חשבונות בדיקה / Test accounts

## למה סביבה נפרדת?
בדיקות צריכות לעבוד על נתונים סינתטיים, בלי לראות סיפורים של משפחות אמיתיות ובלי להפעיל יצירת סיפור, תשלום או הדפסה. יש להכין סביבת Clerk לפיתוח ופרויקט או ענף Supabase נפרד. אין להשתמש בנתוני לקוחות. הבדיקה המקומית מדלגת על ההתחברות: לאפליקציה אין תחליף מקומי לסשן Clerk, והגישה לרשת חסומה בבדיקה המקומית.

## מה בעל המערכת צריך להכין
1. ליצור סביבת Clerk development ושני משתמשי בדיקה קבועים: הורה ומנהל. להגדיר למנהל את הרשאת הניהול לפי מנגנון השרת הקיים.
2. ליצור פרויקט או ענף Supabase נפרד עם נתונים סינתטיים בלבד: גיבור ילד אחד ושני ספרים של ההורה. לאחד הספרים נדרשים לפחות שלושה עמודים שניתן לדפדף בהם. לאפשר מסך ניהול הדפסה בסביבת הבדיקה ולהשלים הסכמה לפרטיות מראש.
3. לחבר סביבת preview ל-Clerk ול-Supabase הנפרדים. לשמור סודות ב-GitHub וב-Vercel בלבד, לא בקוד ולא בפלט הבדיקה. להגדיר `SMOKE_BASE_URL`, `SMOKE_PARENT_EMAIL`, `SMOKE_ADMIN_EMAIL`, `CLERK_SECRET_KEY` ו-`CLERK_PUBLISHABLE_KEY` לסביבה הזו. מפתח ה-Clerk הציבורי שבבילד חייב להתאים למפתח שמועבר לבדיקה.
4. לפני פריסה ואחריה, להריץ מאותה גרסת קוד שנבדקת:

```sh
bun install --frozen-lockfile
bun run build
node scripts/smoke-signed-in.mjs
```

ללא `SMOKE_BASE_URL` הריצה מקומית ומחזירה שלוש בדיקות מדולגות. `INCOMPLETE` אינו אישור שהזרימה עבדה. היעד אינו מודפס בפלט, וגם לא תוכן השגיאות של Playwright, כדי להגן על פרטי התחברות. כשל מחזיר קוד יציאה שונה מאפס; חסרים מדווחים כספירת דילוגים; ביעד מרוחק דילוג מחזיר קוד שגיאה כדי ש-CI לא יציג הצלחה. צילומי מסך של צעדים שהצליחו נשמרים בתיקיית `../shots` ביחס לשורש המאגר. צילומים עלולים להכיל נתוני חשבון ויש לשמור אותם בהתאם.

דומיין הייצור `sipurai.ai` וכל תת-הדומיינים שלו חסומים כברירת מחדל. `SMOKE_ALLOW_PRODUCTION_READONLY=1` מתיר רק התחברות הורה, צפייה ויציאה; בדיקות הניהול והדפדוף לא רצות, ובקשות כתיבה לאפליקציה חסומות. אין ליצור סיפור. יש להפעיל זאת רק אם מדיניות הבדיקה והחשבונות מאפשרות זאת. תוצאות בדיקת הייצור לא אומתו במשימה הזו.

דוגמה לשלב CI (הגדרת secrets ומשתני הסביבה באחריות הבעלים; להריץ לפני ואחרי הפריסה על כתובת ה-preview המתאימה):

```yaml
- name: Signed-in smoke
  env:
    SMOKE_BASE_URL: ${{ vars.SMOKE_BASE_URL }}
    SMOKE_PARENT_EMAIL: ${{ secrets.SMOKE_PARENT_EMAIL }}
    SMOKE_ADMIN_EMAIL: ${{ secrets.SMOKE_ADMIN_EMAIL }}
    CLERK_SECRET_KEY: ${{ secrets.CLERK_SECRET_KEY }}
    CLERK_PUBLISHABLE_KEY: ${{ vars.CLERK_PUBLISHABLE_KEY }}
  run: node scripts/smoke-signed-in.mjs
```

## English
Use a separate Clerk development instance and a separate Supabase project or branch with synthetic data. Create one child hero and two parent-owned books, one with at least three readable pages. Create a parent and an admin, grant the latter the existing server-side admin role, complete consent, and enable the print-admin screen on the test deployment. Configure the five environment variables shown above in GitHub/Vercel; never commit credentials. The Clerk public key embedded in the preview build must match the test key.

Run the commands above before and after deployment, pointing `SMOKE_BASE_URL` at the isolated preview. Locally, the app has no offline Clerk session double, so all three cases explicitly skip. `INCOMPLETE` means the flow was not verified; skipped checks on a remote target return a nonzero exit code. Production and its subdomains require `SMOKE_ALLOW_PRODUCTION_READONLY=1`; that mode limits the suite to parent sign-in, viewing, and sign-out and blocks application writes. Never generate a story. Production mode was not exercised in this task. Browser requests are restricted to the chosen app and Clerk hosts; service workers are blocked. Screenshots may contain account data and should be handled accordingly. The CI example is documentation only; the owner must configure and enable it.
