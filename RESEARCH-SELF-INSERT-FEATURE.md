# מחקר היתכנות: פיצ'ר "הכנס את עצמך" (Self-Insert) בסיפוראי

> **תאריך:** 19 מרץ 2026
> **מטרה:** המשתמש מעלה תמונה אמיתית → AI יוצר גרסת איור מאוירת → הדמות מופיעה בכל הספרים
> **סטטוס:** מחקר היתכנות

---

## תוכן עניינים

1. [יכולות Gemini 3 Pro Image](#1-יכולות-gemini-3-pro-image)
2. [מימוש טכני](#2-מימוש-טכני)
3. [ניתוח מתחרים](#3-ניתוח-מתחרים)
4. [פרטיות ו-COPPA](#4-פרטיות-ו-coppa)
5. [עיצוב MVP](#5-עיצוב-mvp)
6. [הערכת עלויות](#6-הערכת-עלויות)
7. [תוכנית מימוש מומלצת](#7-תוכנית-מימוש-מומלצת)
8. [סיכום והמלצות](#8-סיכום-והמלצות)

---

## 1. יכולות Gemini 3 Pro Image

### 1.1 מולטימודליות — קלט תמונה + טקסט → פלט תמונה

**כן, Gemini 3 Pro Image (Nano Banana Pro) תומך בדיוק בזה.**

| יכולת | פירוט |
|-------|-------|
| קלט מרובה | עד **14 תמונות ייחוס** בפרומפט אחד (עד 6 אובייקטים + 5 בני אדם) |
| Identity Preservation | שמירה על מאפייני פנים, תסרוקת, ביגוד בין תמונות שונות |
| Style Transfer | העברת סגנון (צבעי מים, קומיקס, אנימה) תוך שמירה על הדמות |
| רזולוציה | 1K / 2K / 4K — מספיק להדפסה |
| עברית | המודל תומך בטקסט בעברית בתוך תמונות (94% דיוק ברנדרינג טקסט) |
| מגבלת קובץ | 7MB העלאה ישירה, 30MB דרך Cloud Storage |

### 1.2 איכות המרת תמונה → איור

**מצוין.** Gemini 3 Pro Image תוכנן במיוחד ליצירת תוכן סדרתי:
- שמירה על **עקביות דמויות** (character consistency) לאורך מספר תמונות
- תמיכה ב-**storyboarding** — יצירת פאנלים עם אותה דמות בסצנות שונות
- יכולת לשנות **פוזה, תאורה, רקע** תוך שמירה על זהות הדמות

### 1.3 עקביות דמויות — הממצא המרכזי

**Gemini 3 Pro Image Preview תומך ב-5 תמונות עקביות-דמות (character consistency images).**

כלומר: מעלים תמונת ייחוס אחת של הילד → המודל יכול ליצור תמונות חדשות של אותה דמות מאוירת ב:
- רקעים שונים (יער, חלל, מתחת למים)
- פוזות שונות (עומד, רץ, שוכב)
- תאורה שונה
- **תוך שמירה על מאפיינים חזותיים מרכזיים** (צבע שיער, מבנה פנים, ביגוד)

### 1.4 מגבלות ידועות

| מגבלה | הערה |
|-------|------|
| דיוק פנים | לא 100% — עלול לשנות פרטים קטנים (צורת אוזן, נמשים) |
| סגנון קיצוני | סגנונות מאוד סכמטיים (pixel art) עלולים לאבד דמיון |
| ריבוי דמויות | עם 3+ דמויות בסצנה אחת, העקביות יורדת |
| Hebrew text in images | טוב אבל לא מושלם — מומלץ להוסיף טקסט בשכבה נפרדת |

---

## 2. מימוש טכני

### 2.1 ארכיטקטורה מוצעת

```
[משתמש מעלה תמונה]
        ↓
[Supabase Storage: avatars/{userId}/original.jpg]
        ↓
[Serverless Function: /api/ai/generate-character]
        ↓  ← Gemini 3 Pro Image + reference photo + style prompt
        ↓
[תמונת דמות מאוירת]
        ↓
[Supabase Storage: avatars/{userId}/illustrated-{style}.jpg]
        ↓
[שימוש בכל ספר: reference image → סצנה חדשה]
```

### 2.2 קוד API — העברת תמונת ייחוס ל-Gemini

```javascript
// api/ai/generate-character.js (Vercel Serverless)
export default async function handler(req, res) {
  const { referenceImageBase64, artStyle, sceneDescription } = req.body;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent`,
    {
      method: 'POST',
      headers: {
        'x-goog-api-key': process.env.GEMINI_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType: 'image/jpeg',
                data: referenceImageBase64  // תמונת הייחוס של הילד
              }
            },
            {
              text: `Transform this child's photo into a ${artStyle} illustration style character.
                     The character should be in this scene: ${sceneDescription}.
                     Maintain the child's key features: hair color, eye color, skin tone,
                     and general face shape. Make it child-friendly and age-appropriate.
                     Style: warm, friendly, colorful children's book illustration.`
            }
          ]
        }],
        generationConfig: {
          responseModalities: ['TEXT', 'IMAGE'],
          imageConfig: {
            aspectRatio: '1:1',  // לדמות בודדת
            imageSize: '2K'
          }
        }
      })
    }
  );

  // חילוץ התמונה מהתשובה
  const data = await response.json();
  const imageData = data.candidates[0].content.parts
    .find(p => p.inlineData)?.inlineData;

  return res.json({ image: imageData });
}
```

### 2.3 אחסון — Supabase Storage (מומלץ)

| אפשרות | יתרונות | חסרונות |
|---------|---------|---------|
| **Supabase Storage** | כבר בשימוש, RLS, CDN | צריך bucket חדש |
| Clerk Metadata | פשוט, צמוד ל-user | מגבלת גודל (< 1MB), לא מיועד לתמונות |
| Vercel Blob | מהיר, CDN | עלות נוספת, לא מחובר ל-DB |

**המלצה:** Supabase Storage עם bucket `avatars` ו-RLS policy:

```sql
-- bucket: avatars
CREATE POLICY "Users can upload own avatar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can read own avatar"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- מחיקה אוטומטית אחרי עיבוד (ראה COPPA)
CREATE POLICY "Users can delete own avatar"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
```

### 2.4 זמן עיבוד — ריאלטיים או אסינכרוני?

| שלב | זמן משוער | גישה |
|------|-----------|------|
| העלאת תמונה | 1-3 שניות | סינכרוני |
| יצירת דמות מאוירת (פעם ראשונה) | 8-15 שניות | **אסינכרוני** עם progress bar |
| יצירת איור לעמוד ספר (עם reference) | 5-10 שניות | אסינכרוני (כבר קיים בזרימה) |

**המלצה:** אסינכרוני עם UI של progress bar מונפש ("יוצרים את הדמות שלך...") — חוויה טובה יותר מאשר להמתין.

---

## 3. ניתוח מתחרים

### 3.1 שירותים עם פיצ'ר Photo-to-Character

| שירות | טכנולוגיה | איכות | מחיר | עברית |
|-------|-----------|-------|------|-------|
| **Childbook.ai** | GPT-3 + DALL-E/Stable Diffusion מותאם | גבוהה — עקביות דמות לאורך כל הספר | $4.99/ספר | לא |
| **Imagitime** | טכנולוגיה ייחודית (לא חושפים) | טובה — ממירים תמונה לאיור | $29.99/ספר מודפס | לא |
| **Story Star Books** | AI מותאם — "custom character illustration" | טובה מאוד — לא בוחרים מתבניות | $34.99/ספר | לא |
| **Magical Children's Book** | AI (לא מפורט) | בינונית-טובה | $29.99/ספר | לא |
| **Wonder Wraps** | AI photo processing | בינונית | $24.99/ספר | לא |
| **Wonderbly** | **לא** photo-to-illustration — בחירה ממאפיינים קבועים | גבוהה (אנושית) | $30-40/ספר | לא |
| **StoryJumper** | אין photo-to-character — רק עריכה ידנית | בינונית | חינם + הדפסה | לא |

### 3.2 ממצאים מרכזיים

1. **Childbook.ai** הוא המתחרה הישיר החזק ביותר — עקביות דמות לאורך ספר שלם
2. **Wonderbly** (המובילה בשוק) **לא מציעה** photo-to-character — רק בחירה מתבניות
3. **אף אחד לא מציע את זה בעברית** — הזדמנות Blue Ocean ברורה
4. כל המתחרים גובים $25-35 לספר מודפס — סיפוראי יכול להציע במחיר אטרקטיבי יותר
5. רוב השירותים מציעים ספר אחד = מוצר אחד, לא פלטפורמת יצירה מתמשכת

### 3.3 יתרון תחרותי של סיפוראי

| יתרון | סיפוראי | מתחרים |
|-------|---------|--------|
| עברית + RTL | כן | לא |
| יידיש | כן | לא |
| דמות שמירה חוצה-ספרים | כן (MVP) | לא (דמות לכל ספר) |
| פלטפורמה מתמשכת | כן (gamification, community) | לא (מוצר חד-פעמי) |
| 18 סגנונות איור | כן | 3-5 סגנונות |
| מחיר | מנוי חודשי (29-49 NIS) | $25-35 לספר בודד |
| הדפסה מקומית (ישראל) | BookPod / Cloudprinter | Amazon KDP (USA only) |

---

## 4. פרטיות ו-COPPA

### 4.1 חוקי COPPA מעודכנים (אפריל 2026)

**שינויים קריטיים לפיצ'ר Self-Insert:**

| דרישה | הסבר | השלכה על סיפוראי |
|-------|------|-------------------|
| **הסכמת הורה מוכחת** | חובה לפני כל איסוף מידע אישי של ילד מתחת ל-13 | חובה: מסך הסכמת הורה לפני העלאת תמונה |
| **הגדרה מורחבת** | תמונות, ביומטריה פנים, ותבניות פנים = מידע אישי | תמונת הילד = מידע אישי מוגדר |
| **הסכמה נפרדת ל-AI** | שימוש במידע ילד ל-AI = "non-integral", דורש הסכמה נפרדת | חובה: הסכמה נפרדת לעיבוד AI |
| **מדיניות שמירה** | חובה לקבוע policy כתוב + מחיקה כשלא צריך | לא לשמור תמונה מקורית אחרי עיבוד |
| **אין שמירה ללא הגבלה** | אסור לשמור מידע ילד ללא מגבלת זמן | TTL + מחיקה אוטומטית |

### 4.2 חוק פרטיות ישראלי (תיקון 13)

תיקון 13 לחוק הגנת הפרטיות נכנס לתוקף באוגוסט 2025 — מתאים ל-GDPR:
- **הגדרה מורחבת** של מידע אישי (כולל ביומטריה)
- **קנסות גבוהים** — עד 5% מהמחזור השנתי
- **חובת DPO** — מינוי ממונה פרטיות לחברות מעל גודל מסוים
- **אין סעיף ספציפי לילדים** (כמו COPPA) אבל מידע רגיש מוגן יותר

### 4.3 אסטרטגיית פרטיות מומלצת — "Process & Delete"

```
[הורה מסכים בכתב (הסכמת הורה מוכחת)]
    ↓
[ילד/הורה מעלים תמונה]
    ↓
[תמונה נשמרת ב-Supabase Storage (encrypted)]
    ↓ TTL: 5 דקות מקסימום
    ↓
[Gemini API מעבד → יוצר דמות מאוירת]
    ↓
[תמונה מקורית נמחקת אוטומטית (CRON/trigger)]
    ↓
[רק האיור (ללא זיהוי ביומטרי) נשמר]
```

**למה זה עובד:**
- התמונה המקורית (מידע אישי) נמחקת תוך דקות
- האיור שנשמר הוא **ייצוג אמנותי** — לא ביומטריה
- אין אפשרות לחלץ תמונה מקורית מהאיור
- עומד בדרישות COPPA (מחיקה מהירה) + חוק ישראלי (minimization)

### 4.4 דרישות UI/UX לפרטיות

1. **מסך הסכמת הורה** — לפני גישה לפיצ'ר (Parental Consent Gate)
2. **הסבר ברור** — "התמונה תעובד ותימחק תוך 5 דקות"
3. **אפשרות מחיקה** — כפתור "מחק את הדמות שלי" שמוחק הכול
4. **ללא שיתוף** — איורי Self-Insert לא ניתנים לשיתוף בקהילה (אלא אם ההורה מאשר)
5. **עדכון מדיניות פרטיות** — הוספת סעיף Self-Insert

---

## 5. עיצוב MVP

### 5.1 MVP — גרסה מינימלית (Tier 1)

**"העלה תמונה → קבל דמות מאוירת → השתמש בכל הספרים"**

| רכיב | תיאור |
|------|-------|
| **העלאת תמונה** | כפתור "צור דמות ממך" בעמוד Characters |
| **הסכמת הורה** | Modal עם checkbox "אני ההורה ומאשר/ת" |
| **עיבוד** | Progress bar + אנימציה ("יוצרים את הדמות שלך...") |
| **תוצאה** | תמונת דמות מאוירת אחת בסגנון ברירת מחדל |
| **שמירה** | כרטיס דמות חדש בספריית הדמויות |
| **שימוש** | בחירת הדמות ביצירת ספר → Gemini מקבל reference |
| **מחיקת מקור** | אוטומטית תוך 5 דקות |

### 5.2 גרסה סטנדרטית (Tier 2)

**"הדמות שלך בכל סגנון + פוזות שונות"**

| רכיב נוסף | תיאור |
|-----------|-------|
| **Multi-Style** | יצירת 3-5 גרסאות סגנון (צבעי מים, אנימה, קומיקס, דיסני, ספר ילדים) |
| **Preview Grid** | הצגת כל הסגנונות לבחירה |
| **Auto-Match** | כשיוצרים ספר בסגנון X → בוחר אוטומטית את גרסת הסגנון המתאימה |
| **Character Sheet** | עמוד דמות עם כל הגרסאות + פרטים |

### 5.3 גרסה מתקדמת (Tier 3)

**"פוזות שונות בכל עמוד + ריבוי דמויות"**

| רכיב נוסף | תיאור |
|-----------|-------|
| **Per-Page Poses** | Gemini מקבל reference + תיאור סצנה → דמות בפוזה מתאימה |
| **Multi-Character** | 2-3 ילדים מאותו משפחה באותו ספר |
| **Expression Control** | שמח / מופתע / עצוב / נחוש — לפי הסיפור |
| **Outfit Change** | שינוי בגדים לפי סצנה (פיג'מה, חליפת חלל, שמלה) |

### 5.4 Premium Feature או חינם?

| אפשרות | יתרונות | חסרונות |
|---------|---------|---------|
| **חינם לכולם** | אימוץ מהיר, WOW factor, ויראליות | עלות API גבוהה, כולם ישתמשו |
| **Premium בלבד** | ROI ברור, מוטיבציה לשדרוג | חסם כניסה, פחות ויראלי |
| **Freemium (המלצה)** | דמות אחת חינם, סגנונות נוספים = premium | קצת מורכב, אבל הכי הגיוני |

**המלצה: Freemium**
- **Free:** דמות אחת, סגנון אחד (ספר ילדים קלאסי)
- **Premium (29 NIS):** עד 3 דמויות, 5 סגנונות, auto-match
- **Premium Plus (49 NIS):** unlimited דמויות, כל 18 הסגנונות, per-page poses

---

## 6. הערכת עלויות

### 6.1 עלות API ליצירת דמות

| פעולה | מודל | עלות ליחידה | הערה |
|-------|------|-------------|------|
| יצירת דמות מאוירת (פעם ראשונה) | Gemini 3 Pro Image (2K) | **$0.134** | כולל reference image |
| יצירת גרסת סגנון נוסף | Gemini 3 Pro Image (2K) | **$0.134** | reference + style prompt |
| איור עמוד ספר עם דמות | Gemini 3 Pro Image (2K) | **$0.134** | reference + scene |
| **אפשרות חסכונית** | Gemini 3.1 Flash Image (1K) | **$0.067** | איכות קצת נמוכה יותר |
| **עם Batch API (50% הנחה)** | Gemini 3 Pro Image (2K) | **$0.067** | המתנה עד 24 שעות |

### 6.2 תרחישים — עלות למשתמש

| תרחיש | קריאות API | עלות (Pro 2K) | עלות (Flash 1K) |
|--------|-----------|---------------|-----------------|
| **MVP: דמות אחת** | 1 | $0.134 | $0.067 |
| **Standard: 5 סגנונות** | 5 | $0.67 | $0.335 |
| **ספר 10 עמודים עם דמות** | 10 | $1.34 | $0.67 |
| **Power user: 3 דמויות + ספר** | 3+10 = 13 | $1.74 | $0.87 |

### 6.3 עלות אחסון

| פריט | גודל | עלות Supabase |
|------|------|---------------|
| תמונה מקורית (נמחקת) | 2-5 MB | $0 (נמחקת תוך 5 דק') |
| איור דמות (2K) | 200-500 KB | ~$0.02/GB/חודש |
| 5 גרסאות סגנון | 1-2.5 MB | ~$0.02/GB/חודש |
| 1,000 משתמשים Premium | ~2.5 GB | **~$0.05/חודש** |

### 6.4 ROI — האם זה משתלם?

| מדד | ערך |
|-----|-----|
| עלות יצירת דמות (MVP) | $0.134 (0.49 NIS) |
| עלות 5 סגנונות | $0.67 (2.45 NIS) |
| הכנסה Premium חודשית | 29 NIS |
| הכנסה Premium Plus חודשית | 49 NIS |
| **ROI ליצירת דמות אחת** | 29 / 0.49 = **59x** |
| **ROI ל-5 סגנונות** | 29 / 2.45 = **11.8x** |
| **Break-even point** | משתמש אחד = רווחי מהחודש הראשון |

**המסקנה: ROI מצוין. עלות API זניחה ביחס להכנסה.**

---

## 7. תוכנית מימוש מומלצת

### שלב 1: MVP (1-2 שבועות פיתוח)

**מטרה:** הוכחת קונספט — "תמונה → דמות מאוירת"

| משימה | זמן | עדיפות |
|-------|-----|--------|
| Supabase bucket `avatars` + RLS policies | 2 שעות | P0 |
| Serverless function: `/api/ai/generate-character` | 4 שעות | P0 |
| UI: כפתור "צור דמות ממך" בעמוד Characters | 3 שעות | P0 |
| UI: Parental Consent Modal | 2 שעות | P0 |
| UI: Progress bar + loading animation | 2 שעות | P1 |
| שמירת איור כ-Character entity | 2 שעות | P0 |
| מחיקה אוטומטית של תמונה מקורית (trigger/CRON) | 2 שעות | P0 |
| עדכון Privacy Policy | 1 שעה | P0 |
| בדיקות ידניות — 5 תמונות שונות | 2 שעות | P0 |
| **סה"כ MVP** | **~20 שעות** | |

### שלב 2: Multi-Style (1 שבוע)

| משימה | זמן |
|-------|-----|
| יצירת 5 גרסאות סגנון מתמונת ייחוס אחת | 3 שעות |
| UI: Style Preview Grid | 3 שעות |
| Auto-match סגנון לספר | 2 שעות |
| Character Sheet עמוד | 3 שעות |
| אינטגרציה עם CreativeStoryStudio | 4 שעות |
| **סה"כ שלב 2** | **~15 שעות** |

### שלב 3: Per-Page Consistency (1-2 שבועות)

| משימה | זמן |
|-------|-----|
| שילוב reference image בכל קריאת generateImage | 4 שעות |
| Prompt engineering: פוזות + ביטויים לפי סצנה | 6 שעות |
| Multi-character support (2-3 ילדים) | 6 שעות |
| Caching strategy: שמירת reference לאורך session | 3 שעות |
| QA מקיף: 20+ ספרים עם דמויות self-insert | 4 שעות |
| **סה"כ שלב 3** | **~23 שעות** |

### שלב 4: Premium Gating

| משימה | זמן |
|-------|-----|
| הגדרת tier limits (free: 1, premium: 3, plus: unlimited) | 2 שעות |
| UI: "שדרג למנוי Premium" כשמנסים ליצור דמות שנייה | 2 שעות |
| ספירת שימוש בטבלת users/subscriptions | 2 שעות |
| **סה"כ שלב 4** | **~6 שעות** |

---

## 8. סיכום והמלצות

### הפיצ'ר הזה הוא MUST-HAVE

| ממצא | משמעות |
|------|--------|
| Gemini 3 Pro Image תומך מושלם | הטכנולוגיה קיימת ועובדת |
| מתחרים כבר מציעים (באנגלית) | השוק מוכיח demand |
| אף אחד לא בעברית | Blue Ocean מוחלט |
| עלות API זניחה | $0.13 לדמות — ROI של 59x |
| COPPA פתיר | אסטרטגיית "Process & Delete" |
| MVP ב-20 שעות | מימוש מהיר |

### המלצה סופית

**להתחיל מייד עם שלב 1 (MVP).** זהו הפיצ'ר שיהפוך את סיפוראי מ-"עוד אפליקציית ספרי ילדים" ל-"הפלטפורמה שבה הילד שלי הוא הגיבור." זה ה-wow factor שיביא ויראליות, המרות, וערך שלא קיים בשום מקום אחר בעברית.

### סדר עדיפויות

```
[עכשיו]  שלב 1: MVP — דמות אחת מתמונה .............. 20 שעות
[שבוע 2] שלב 2: Multi-Style .......................... 15 שעות
[שבוע 3] שלב 3: Per-Page Consistency ................. 23 שעות
[שבוע 4] שלב 4: Premium Gating ...................... 6 שעות
─────────────────────────────────────────────────────
סה"כ                                                 ~64 שעות
```

### סיכוני מפתח

| סיכון | הסתברות | השפעה | מיטיגציה |
|-------|---------|-------|----------|
| איכות לא עקבית | בינונית | גבוהה | Prompt engineering + retry logic |
| COPPA violation | נמוכה | קריטית | Process & Delete + legal review |
| עלות API גבוהה ב-scale | נמוכה | בינונית | Batch API + Flash fallback |
| משתמש מעלה תמונה לא מתאימה | גבוהה | בינונית | Content moderation (Gemini built-in) |
| דמיון לא מספיק | בינונית | בינונית | הצגת preview + "נסה שוב" |

---

## מקורות

- [Gemini 3 Pro Image — Google DeepMind](https://deepmind.google/models/gemini-image/pro/)
- [Gemini Image Generation API Documentation](https://ai.google.dev/gemini-api/docs/image-generation)
- [Gemini 3 Pro Image — Vertex AI Docs](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/models/gemini/3-pro-image)
- [Multi-Reference Image Guide (14 images)](https://help.apiyi.com/en/gemini-14-reference-images-object-fidelity-character-consistency-guide-en.html)
- [Gemini Image API Pricing Guide 2026](https://blog.laozhang.ai/en/posts/gemini-image-api-guide-2026)
- [Gemini 3 Pro Image API Pricing](https://blog.laozhang.ai/en/posts/gemini-3-pro-image-api-pricing)
- [FTC COPPA Final Rule Amendments 2025](https://securiti.ai/ftc-coppa-final-rule-amendments/)
- [COPPA Rule — AI Training Consent](https://www.dataprotectionreport.com/2025/06/ftcs-coppa-rule-changes-include-ai-training-consent-requirement/)
- [COPPA Compliance Guide for Kids' Apps](https://blog.promise.legal/startup-central/coppa-compliance-in-2025-a-practical-guide-for-tech-edtech-and-kids-apps/)
- [Israel Amendment 13 — Privacy Protection Law](https://www.asisonline.org/security-management-magazine/latest-news/today-in-security/2025/january/Israel-amenment-13-IPPL/)
- [Childbook.ai](https://www.childbook.ai/)
- [Imagitime](https://imagitime.com/)
- [Story Star Books vs Wonderbly](https://www.storystarsbook.com/blog/wonderbly-vs-story-star-books-best-personalized-books-for-kids-2026/)
- [Best Personalized Children's Books 2026](https://lullaby.ink/blog/best-personalized-childrens-books-2026)
- [StoryBud — Best Photo Book Apps](https://storybud.com/blog/best-apps-for-creating-personalized-books-with-your-childs)
