# חשבונות בדיקה / Test accounts

## למה סביבה נפרדת?
בדיקות צריכות לעבוד על נתונים סינתטיים, בלי לראות סיפורים של משפחות אמיתיות ובלי להפעיל יצירת סיפור, תשלום או הדפסה. יש להכין סביבת Clerk לפיתוח ופרויקט או ענף Supabase נפרד. אין להשתמש בנתוני לקוחות. בריצה המקומית משתמשים בחשבון Clerk של CI, והספרים וההסכמה מוחלפים בנתונים סינתטיים בדפדפן. ללא פרטי ההתחברות בדיקת ההורה מדולגת עם הסבר.

## מה בעל המערכת צריך להכין
1. ליצור סביבת Clerk development ושני משתמשי בדיקה קבועים: הורה ומנהל. להגדיר למנהל את הרשאת הניהול לפי מנגנון השרת הקיים.
2. ליצור פרויקט או ענף Supabase נפרד עם נתונים סינתטיים בלבד: גיבור ילד אחד ושני ספרים של ההורה. לאחד הספרים נדרשים לפחות שלושה עמודים שניתן לדפדף בהם. לאפשר מסך ניהול הדפסה בסביבת הבדיקה ולהשלים הסכמה לפרטיות מראש.
3. לחבר סביבת preview ל-Clerk ול-Supabase הנפרדים. לשמור סודות ב-GitHub וב-Vercel בלבד, לא בקוד ולא בפלט הבדיקה. להגדיר `SMOKE_BASE_URL`, `SMOKE_SUPABASE_HOST`, `SMOKE_PARENT_EMAIL`, `SMOKE_ADMIN_EMAIL`, `CLERK_SECRET_KEY` ו-`CLERK_PUBLISHABLE_KEY` לסביבה הזו. מפתח ה-Clerk הציבורי שבבילד חייב להתאים למפתח שמועבר לבדיקה.
4. לפני פריסה ואחריה, להריץ מאותה גרסת קוד שנבדקת:

```sh
bun install --frozen-lockfile
bun run build
node scripts/smoke-signed-in.mjs
```

ללא `SMOKE_BASE_URL` הריצה מקומית ומשתמשת ב־`E2E_CLERK_USER_EMAIL` וב־`CLERK_SECRET_KEY` הקיימים ב־CI. בדיקות הניהול המקומיות מדולגות כי אין להן חשבון ונתוני מנהל מקומיים. בדיקת ההורה מדולגת אם פרטי Clerk חסרים. `INCOMPLETE` אינו אישור שהזרימה עבדה. היעד אינו מודפס בפלט, וגם לא תוכן השגיאות של Playwright, כדי להגן על פרטי התחברות; לאבחון אפשר להריץ Playwright ישירות בסביבה בטוחה, שכן הפלט עלול להכיל מידע רגיש. כשל מחזיר קוד יציאה שונה מאפס; חסרים מדווחים כספירת דילוגים; ביעד מרוחק דילוג מחזיר קוד שגיאה כדי ש-CI לא יציג הצלחה. צילומי מסך של צעדים שהצליחו נשמרים בנתיב הפלט של Playwright תחת `test-results`, שמתאים לאיסוף כארטיפקט ב־CI. צילומים עלולים להכיל נתוני חשבון ויש לשמור אותם בהתאם.

דומיין הייצור `sipurai.ai` ותת-הדומיינים שלו חסומים כברירת מחדל. החריג היחיד הוא `preview.sipurai.ai`, שיש לחבר לסביבת בדיקה מבודדת בלבד. `SMOKE_SUPABASE_HOST` הוא שם המארח בלבד של פרויקט הבדיקה (למשל `example.supabase.co`); פרויקט הייצור נדחה תמיד. הבדיקה מתירה אליו רק GET, HEAD ו־OPTIONS וחוסמת כתיבה וקריאות RPC. `SMOKE_ALLOW_PRODUCTION_READONLY=1` מתיר רק התחברות הורה, צפייה ויציאה; בדיקות הניהול והדפדוף לא רצות, ובקשות כתיבה לאפליקציה חסומות. אין ליצור סיפור. יש להפעיל זאת רק אם מדיניות הבדיקה והחשבונות מאפשרות זאת. תוצאות בדיקת הייצור לא אומתו במשימה הזו.

דוגמה לשלב CI (הגדרת secrets ומשתני הסביבה באחריות הבעלים; להריץ לפני ואחרי הפריסה על כתובת ה-preview המתאימה):

```yaml
- name: Signed-in smoke
  env:
    SMOKE_BASE_URL: ${{ vars.SMOKE_BASE_URL }}
    SMOKE_SUPABASE_HOST: ${{ vars.SMOKE_SUPABASE_HOST }}
    SMOKE_PARENT_EMAIL: ${{ secrets.SMOKE_PARENT_EMAIL }}
    SMOKE_ADMIN_EMAIL: ${{ secrets.SMOKE_ADMIN_EMAIL }}
    CLERK_SECRET_KEY: ${{ secrets.CLERK_SECRET_KEY }}
    CLERK_PUBLISHABLE_KEY: ${{ vars.CLERK_PUBLISHABLE_KEY }}
  run: node scripts/smoke-signed-in.mjs
```

## English
Use a separate Clerk development instance and a separate Supabase project or branch with synthetic data. Create one child hero and two parent-owned books, one with at least three readable pages. Create a parent and an admin, grant the latter the existing server-side admin role, complete consent, and enable the print-admin screen on the test deployment. Configure the five environment variables shown above in GitHub/Vercel; never commit credentials. The Clerk public key embedded in the preview build must match the test key.

Run the commands above before and after deployment, pointing `SMOKE_BASE_URL` at the isolated preview. Locally the parent flow uses the existing CI `E2E_CLERK_USER_EMAIL` and `CLERK_SECRET_KEY`, with synthetic consent and Supabase REST responses; it skips clearly when credentials are absent. Local admin checks skip because local admin fixtures are unavailable. `INCOMPLETE` means the flow was not verified; skipped checks on a remote target return a nonzero exit code. Production and its subdomains, except the explicitly isolated `preview.sipurai.ai`, require `SMOKE_ALLOW_PRODUCTION_READONLY=1`; that mode limits the suite to parent sign-in, viewing, and sign-out and blocks application writes. Never generate a story. Production mode was not exercised in this task. Set `SMOKE_SUPABASE_HOST` to the isolated test project hostname, without a scheme. The preview.sipurai.ai hostname must never serve production data. The production project is always refused. Only GET, HEAD and OPTIONS to that host are allowed; writes and RPC calls are blocked. Browser requests are otherwise restricted to the chosen app and Clerk hosts; service workers are blocked. Screenshots are in Playwright test-results artifacts. Screenshots may contain account data and should be handled accordingly. The CI example is documentation only; the owner must configure and enable it.
