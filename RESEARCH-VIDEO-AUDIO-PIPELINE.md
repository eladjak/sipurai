# מחקר: צינור וידאו + מוזיקה + אפקטי סאונד לסיפוראי

**תאריך:** 2026-03-19
**סשן:** 42
**מטרה:** תכנון פיצ'ר "הפוך סיפור לוידאו" עם קריינות, מוזיקת רקע ואפקטי סאונד

---

## חלק 1: Suno AI - יצירת מוזיקה

### סטטוס API
- **אין API רשמי ציבורי** נכון למרץ 2026
- גישה דרך wrappersים צד-שלישי: [SunoAPI.org](https://sunoapi.org/), [PiAPI](https://piapi.ai/suno-v5), [APIframe](https://apiframe.ai/suno-api-for-ai-music-generation)
- API לא-רשמי דרך AI/ML API: [aimlapi.com](https://aimlapi.com/suno-ai-api)

### תמחור

| תוכנית | מחיר | קרדיטים | שירים בערך | שימוש מסחרי |
|---------|-------|---------|------------|-------------|
| Free | $0 | 50/יום | ~10/יום | **לא** |
| Pro | $10/חודש | 2,500/חודש | ~500 | **כן** |
| Premier | $30/חודש | 10,000/חודש | ~2,000 | **כן** |

**API צד-שלישי:** $0.02-0.05 לטראק, בהתאם לגרסת המודל ורמת השירות.
- APIframe: מ-$19/חודש ל-3,000 קרדיטים (~50 שירים), tier חינמי 300 קרדיטים
- Pay-as-you-go: מ-$5

### שליטה על מאפייני שירים

| מאפיין | תמיכה | פרטים |
|---------|--------|-------|
| מצב רוח/ז'אנר | **כן** | lullaby, adventure, fantasy, funny - דרך style tags |
| משך | **חלקי** | V4.5 עד 8 דקות, V4 עד 4 דקות. אין שליטה מדויקת על אורך, אבל Extend feature זמין |
| שירה/אינסטרומנטלי | **כן** | אפשר לציין instrumental only |
| מילים | **כן** | אפשר לשלוח lyrics מותאמים אישית |
| Hebrew | **ככל הנראה כן** | תומך ב-50+ שפות, ערבית נתמכת, יש משתמשים עבריים. איכות עשויה להשתנות |

### רישוי מסחרי
- **Free tier:** שימוש אישי בלבד, אין שימוש מסחרי אפילו אם משדרגים אחר כך
- **Pro/Premier:** זכויות שימוש מסחרי מלאות, ללא תמלוגים ל-Suno
- **חשוב:** מאז שותפות Warner Music (דצמבר 2025), השפה השתנתה מ-"User Owned" ל-"Granted Commercial Rights"
- **זכויות יוצרים:** מוזיקה שנוצרה 100% ע"י AI לא זכאית להגנת זכויות יוצרים בארה"ב (אין "יוצר אנושי")
- **לסיפוראי:** זה בסדר - המוזיקה משמשת כרקע בוידאו, לא למכירה עצמאית

### איכות
- V5/V5 Turbo: איכות סטודיו, ללא watermark
- זמן תגובה: 10-15 שניות לתחילת גנרציה, 20-30 שניות לטראק שלם
- תוצאה: שיר מלא עם כלי נגינה, או אינסטרומנטלי בלבד

### אלטרנטיבות למוזיקה

| שירות | מחיר | API רשמי | איכות | Hebrew | שימוש מסחרי | הערות |
|--------|-------|----------|-------|--------|-------------|-------|
| **Suno** | $10-30/חודש | **לא** (צד-שלישי) | מצוין | חלקי | כן (Pro+) | המוביל בשוק |
| **Udio** | $10-30/חודש | **לא** | מצוין | לא ברור | כן (paid) | מתחרה ישיר ל-Suno |
| **ElevenLabs Music** | $5-99/חודש | **כן** | מצוין | לא ידוע | כן (paid) | API רשמי! force_instrumental |
| **Soundraw** | $11/חודש | **כן** | טוב | לא | כן | רישיון perpetual, API לעסקים |
| **AIVA** | $11-33/חודש | כן | טוב | לא | כן (paid) | מתמחה במוזיקה קלאסית/קולנועית |
| **Mubert** | API | **כן** | בינוני-טוב | לא | כן | API-first, royalty-free |

### המלצה לסיפוראי
**ElevenLabs Music = בחירה מס' 1** - API רשמי, כבר משלמים על TTS, force_instrumental, שימוש מסחרי.
**Soundraw = גיבוי** - API רשמי, מחיר נמוך, רישיון פשוט.
**Suno = אופציה עתידית** - איכות הכי גבוהה אבל בלי API רשמי, מסוכן לבנות עליו.

---

## חלק 2: ElevenLabs Sound Effects

### סטטוס
- **API רשמי זמין** - Sound Effect V2 (ספטמבר 2025)
- יצירת אפקטי סאונד מטקסט (text-to-SFX)
- תמיכה בלופים חלקים (seamless loops) - מושלם לאמביאנס!

### יכולות

| יכולת | פרטים |
|--------|-------|
| משך מקסימלי | עד 30 שניות לגנרציה |
| איכות | 48 kHz professional |
| לופ | `loop` parameter - לופים חלקים ללא תפר |
| prompt adherence | משופר ב-V2 |
| סאונד אמביאנטי | **כן** - יער, ים, חלל, טירה |
| אפקטים נקודתיים | **כן** - דלת נפתחת, צעדים, ברקים |

### תמחור

| שימוש | עלות בקרדיטים |
|--------|---------------|
| AI קובע משך (ברירת מחדל) | 200 קרדיטים/גנרציה (UI), 100 (API) |
| משך ידני | 40 קרדיטים/שנייה (UI), 20 (API) |
| דוגמה: 10 שניות אמביאנס | ~200 קרדיטים (API) |

### תוכניות ElevenLabs (כולל TTS + SFX + Music)

| תוכנית | מחיר/חודש (שנתי) | קרדיטים | הערות |
|---------|-------------------|---------|-------|
| Free | $0 | 10,000 | מספיק ל-~50 SFX או ~10 דקות TTS |
| Starter | ~$4.17 | 30,000 | |
| Creator | $22 | 100,000 | |
| Pro | $99 | 500,000 | |
| Scale | $330 | 2,000,000 | |

### אלטרנטיבות לאפקטי סאונד

| שירות | מחיר | API | איכות | שימוש מסחרי | הערות |
|--------|-------|-----|-------|-------------|-------|
| **ElevenLabs SFX** | $5-99/חודש | **כן** | מצוין | כן (paid) | AI-generated, לופים, מותאם אישית |
| **Freesound.org** | **חינם** | **כן** | משתנה | מוגבל (CC licenses) | 500K+ סאונדים, API חינמי, צריך attribution |
| **Pixabay Audio** | **חינם** | **לא רשמי** | טוב | **כן, ללא attribution** | רישיון Pixabay, 120K+ אפקטים |
| **BBC Sound Effects** | חינם | לא | מצוין | רק אישי | 33K+ סאונדים, לא מסחרי |

### המלצה לסיפוראי
**אסטרטגיה משולבת:**
1. **Pixabay Audio = ברירת מחדל** - חינם, ללא attribution, מסחרי. להוריד ולאגד 50-100 אפקטים נפוצים (יער, ים, גשם, ציפורים, טירה, חלל, עיר, לילה)
2. **ElevenLabs SFX = פרימיום** - לאפקטים מותאמים אישית שלא נמצאים ב-Pixabay, או לאמביאנס ייחודי
3. **Freesound = גיבוי** - API חינמי, מגוון ענק, אבל צריך לבדוק רישיון כל קובץ

---

## חלק 3: עיצוב צינור הוידאו המלא

### תרשים זרימה

```
המשתמש מסיים ספר
        |
        v
   [כפתור "הפוך לוידאו"]
        |
        v
   [מסך הגדרות וידאו]
   ├── בחירת קול קריינות (רשימת קולות)
   ├── בחירת מצב רוח למוזיקה (שקט/הרפתקה/פנטזיה/מצחיק)
   ├── כלול אפקטי סאונד? (כן/לא)
   └── מהירות דיבור (איטי/רגיל/מהיר)
        |
        v
   [מנוע יצירת וידאו - צד שרת]
   ├── 1. TTS: יצירת קריינות לכל עמוד (Azure/ElevenLabs)
   ├── 2. מוזיקה: יצירת רקע מוזיקלי (ElevenLabs Music / Soundraw)
   ├── 3. SFX: בחירת/יצירת אפקטי סאונד (Pixabay + ElevenLabs)
   ├── 4. Ken Burns: אנימציית zoom/pan על איורים
   ├── 5. טקסט: שכבת כתוביות אופציונלית
   └── 6. Remotion: רנדור MP4
        |
        v
   [תצוגה מקדימה]
        |
        v
   [הורדה / שיתוף]
```

### אינטגרציה עם Remotion

Remotion מספק תמיכה מובנית מצוינת:

```jsx
import { Audio, Img, Series, staticFile, useCurrentFrame } from 'remotion';

// מבנה קומפוזיציה לעמוד בודד
const BookPage = ({ pageData, narrationAudio, sfxAudio }) => {
  const frame = useCurrentFrame();

  return (
    <>
      {/* Ken Burns על האיור */}
      <Img
        src={pageData.illustrationUrl}
        style={{
          transform: `scale(${1 + frame * 0.001})`,
          // Ken Burns zoom effect
        }}
      />

      {/* קריינות */}
      <Audio src={narrationAudio} />

      {/* אפקט סאונד (אם קיים) */}
      {sfxAudio && <Audio src={sfxAudio} volume={0.3} />}

      {/* כתוביות */}
      <div className="subtitles">{pageData.text}</div>
    </>
  );
};

// קומפוזיציה ראשית
const BookVideo = ({ pages, backgroundMusic }) => (
  <>
    {/* מוזיקת רקע לאורך כל הסרטון */}
    <Audio src={backgroundMusic} volume={0.15} loop />

    <Series>
      {pages.map((page, i) => (
        <Series.Sequence
          key={i}
          durationInFrames={page.narrationDuration * 30} // 30fps
        >
          <BookPage pageData={page} />
        </Series.Sequence>
      ))}
    </Series>
  </>
);
```

**יכולות Remotion רלוונטיות:**
- `<Audio>` - נגינת קבצי שמע עם שליטה על ווליום
- `volume` prop - שליטה על עוצמה (0-1), גם frame-by-frame
- `loop` - לולאה למוזיקת רקע
- `trimBefore`/`trimAfter` - חיתוך אודיו
- `playbackRate` - שליטה על מהירות
- `<Series>` - רצף עמודים
- Ken Burns: CSS transform + useCurrentFrame()
- רנדור: MP4/WebM דרך `renderMedia()`

### אומדן עלויות לוידאו בודד

**ספר טיפוסי: 10 עמודים, ~2-3 דקות וידאו**

| רכיב | שירות | עלות משוערת | הערות |
|--------|--------|------------|-------|
| TTS קריינות (10 עמודים) | Azure Free Tier | **$0** | ~2,000 תווים, Free tier = 500K/חודש |
| TTS קריינות (10 עמודים) | ElevenLabs | ~1,000 קרדיטים | ~$0.03 (בתוכנית Creator) |
| מוזיקת רקע | ElevenLabs Music | ~500-1,000 קרדיטים | ~$0.02-0.05 |
| מוזיקת רקע | Soundraw | $0 (כלול בתוכנית) | $11/חודש flat |
| מוזיקת רקע | Suno (צד-שלישי) | $0.02-0.05/טראק | |
| אפקטי סאונד (x5) | Pixabay | **$0** | pre-downloaded library |
| אפקטי סאונד (x5) | ElevenLabs SFX | ~500-1,000 קרדיטים | ~$0.02-0.05 |
| רנדור Remotion | צד שרת | ~$0.01-0.05 | תלוי ב-Lambda/server |

### סיכום עלות לוידאו בודד

| תרחיש | עלות | הערות |
|--------|------|-------|
| **MVP (הכי זול)** | **$0.01-0.05** | Azure TTS (free) + Pixabay SFX (free) + pre-made music library |
| **Standard** | **$0.05-0.15** | ElevenLabs TTS + ElevenLabs Music + Pixabay SFX |
| **Premium** | **$0.10-0.25** | ElevenLabs TTS + Suno Music + ElevenLabs SFX |

### עלות חודשית צפויה (100 וידאו/חודש)

| תרחיש | עלות/חודש | הערות |
|--------|-----------|-------|
| MVP | **$1-5** | Azure Free + Pixabay + static music |
| Standard | **$22-30** | ElevenLabs Creator ($22) מכסה הכל |
| Premium | **$40-60** | ElevenLabs + Suno Pro |

---

## חלק 4: גרסת MVP מול גרסה מלאה

### Phase 1: MVP (שבוע 1-2)

**מטרה:** וידאו בסיסי שעובד, בעלות $0

| רכיב | פתרון | עלות |
|--------|--------|------|
| קריינות | Azure TTS Free Tier (500K chars/חודש) | $0 |
| מוזיקת רקע | ספריית MP3 מוכנה (5-10 טראקים מ-Pixabay) | $0 |
| אפקטי סאונד | ספריית SFX מוכנה (30-50 אפקטים מ-Pixabay) | $0 |
| אנימציה | Ken Burns בסיסי (zoom in/out) | $0 |
| רנדור | Remotion (server-side) | שרת קיים |
| פורמט | MP4, 720p | |

**מה המשתמש מקבל:**
- לוחץ "הפוך לוידאו"
- בוחר מצב רוח (שקט/הרפתקה/פנטזיה/מצחיק) -> נבחר MP3 מתאים מהספרייה
- בוחר קול קריינות (מתוך 2-3 קולות Azure Hebrew)
- מקבל MP4 תוך 1-2 דקות
- **חינם למשתמשי Free (1 וידאו/חודש), ללא הגבלה ל-Premium**

### Phase 2: Standard (חודש 2-3)

**שדרוגים:**
- ElevenLabs TTS - קולות טבעיים יותר, מגוון רחב
- ElevenLabs Music - מוזיקת רקע מותאמת לכל סיפור (לא מספרייה)
- Ken Burns מתקדם - pan, zoom, fade transitions
- בחירת מהירות דיבור
- 1080p
- תצוגה מקדימה לפני הורדה

### Phase 3: Premium (חודש 4-6)

**שדרוגים:**
- אפקטי סאונד מותאמים (ElevenLabs SFX) לפי סצנה
- Suno/ElevenLabs שיר פתיחה/סיום עם מילים
- multiple narration voices (דמויות שונות = קולות שונים)
- 4K option
- שיתוף ישיר ליוטיוב/אינסטגרם
- QR code על כריכת הספר המודפס -> לינק לוידאו

---

## חלק 5: ישימות לסטארטאפ קטן

### האם זה ריאלי?

**כן, בהחלט.** הנה למה:

| גורם | ניתוח |
|--------|-------|
| **עלות MVP** | $0/חודש (Azure Free + Pixabay) |
| **עלות Standard** | $22/חודש (ElevenLabs Creator) - מכסה TTS + Music + SFX |
| **סיבוכיות טכנית** | בינונית - Remotion הוא React, מתאים ל-stack שלנו |
| **זמן פיתוח MVP** | 2-3 שבועות |
| **ערך למשתמש** | **גבוה מאוד** - הפיצ'ר הכי "wow" אפשרי לספרי ילדים |
| **תחרות** | **אפס** - אין פלטפורמת ספרי ילדים עברית עם וידאו |
| **מיצוב** | דיפרנציאטור משמעותי - הספר "חי" |

### סיכונים

| סיכון | חומרה | מיטיגציה |
|--------|--------|----------|
| Azure TTS Hebrew quality | בינוני | בדיקה ידנית, fallback ל-ElevenLabs |
| Remotion rendering time | נמוך | Lambda/background job, הודעה כשמוכן |
| Suno API לא רשמי | גבוה | **לא לבנות על Suno!** להשתמש ב-ElevenLabs Music/Soundraw |
| עלות סקייל | בינוני | Rate limiting ב-Free tier, Premium unlimited |
| Copyright claims | נמוך | מוזיקת רקע אינסטרומנטלית, לא שירים |

### ROI

- **Premium subscription = 29 ש"ח/חודש** -> כ-$8
- **עלות וידאו = $0.05-0.15**
- **אם משתמש Premium מייצר 10 וידאו/חודש = $0.50-1.50 עלות**
- **רווח גולמי = $6.50-7.50 לכל משתמש Premium/חודש** = **מעולה**

---

## חלק 6: ארכיטקטורה טכנית מוצעת

### API Endpoints

```
POST /api/video/generate
  body: {
    bookId: string,
    voice: "hebrew-female-1" | "hebrew-male-1" | "hebrew-child-1",
    mood: "calm" | "adventure" | "fantasy" | "funny",
    includeSfx: boolean,
    speed: "slow" | "normal" | "fast",
    quality: "720p" | "1080p"
  }

GET /api/video/status/:jobId
  response: { status: "generating" | "ready" | "error", progress: 0-100, url?: string }

GET /api/video/download/:jobId
  -> MP4 file
```

### מבנה קבצים מוצע

```
src/
  components/
    video/
      VideoGenerator.jsx      # UI ליצירת וידאו
      VideoPreview.jsx         # תצוגה מקדימה
      VideoSettings.jsx        # הגדרות (קול, מצב רוח, SFX)
      VideoProgress.jsx        # מעקב התקדמות

api/
  video/
    generate.js               # Serverless: מתחיל job
    status.js                  # Serverless: סטטוס job

server/                        # (או Vercel Functions)
  video-worker/
    index.js                   # Worker ראשי
    tts.js                     # Azure/ElevenLabs TTS
    music.js                   # Music selection/generation
    sfx.js                     # SFX matching
    remotion-render.js         # Remotion composition + render

public/
  audio/
    music/                     # Pre-made background tracks (MVP)
      calm-lullaby.mp3
      adventure-theme.mp3
      fantasy-magical.mp3
      funny-playful.mp3
      mystery-suspense.mp3
    sfx/                       # Pre-downloaded sound effects (MVP)
      forest-ambient.mp3
      ocean-waves.mp3
      castle-echo.mp3
      space-ambient.mp3
      rain-gentle.mp3
      birds-singing.mp3
      door-creak.mp3
      footsteps-grass.mp3
      magic-sparkle.mp3
      thunder-distant.mp3
```

### SFX Mapping אוטומטי (MVP)

```javascript
// מיפוי אוטומטי של סצנה -> אפקט סאונד
const SCENE_TO_SFX = {
  // מיקומים
  'יער': 'forest-ambient.mp3',
  'ים': 'ocean-waves.mp3',
  'חלל': 'space-ambient.mp3',
  'טירה': 'castle-echo.mp3',
  'גשם': 'rain-gentle.mp3',
  'לילה': 'crickets-night.mp3',
  'עיר': 'city-ambient.mp3',

  // פעולות
  'דלת': 'door-creak.mp3',
  'צעדים': 'footsteps-grass.mp3',
  'קסם': 'magic-sparkle.mp3',
  'רעם': 'thunder-distant.mp3',
  'ציפורים': 'birds-singing.mp3',
  'רוח': 'wind-gentle.mp3',
};

// InvokeLLM ינתח את טקסט הסצנה ויבחר SFX מתאימים
```

---

## סיכום והמלצות

### תוכנית פעולה

| שלב | מה | מתי | עלות |
|------|-----|-----|------|
| **1. MVP** | Azure TTS + Pixabay library + Ken Burns + Remotion | שבועות 1-3 | $0 |
| **2. הרחבה** | ElevenLabs Creator ($22/חודש) - TTS + Music + SFX | חודש 2 | $22/חודש |
| **3. Premium** | שיר פתיחה, multi-voice, 4K | חודש 4-6 | +$10-30/חודש |

### מה לעשות עכשיו
1. **להוריד 50 אפקטי סאונד מ-Pixabay** (חינם, מסחרי, ללא attribution)
2. **להוריד 5-10 מוזיקת רקע מ-Pixabay** (לפי מצב רוח)
3. **להפעיל Azure TTS Free Tier** (500K תווים/חודש = ~250 וידאו)
4. **לבנות Remotion composition** בסיסית
5. **לבנות UI של VideoSettings** + VideoProgress
6. **לייצר Vercel Function** ליצירת וידאו (background job)

### מה לא לעשות
- **לא לבנות על Suno API** - לא רשמי, יכול להישבר
- **לא להשקיע ב-4K/multi-voice** לפני שה-MVP עובד
- **לא לשלם על שירותים** לפני שיש משתמשים (MVP = $0)

---

## מקורות

- [Suno Pricing](https://suno.com/pricing)
- [Suno API Review 2026 - AI/ML API](https://aimlapi.com/blog/suno-api-review)
- [Suno API Guide - Evolink](https://evolink.ai/blog/suno-api-review-complete-guide-ai-music-generation-integration)
- [Suno Commercial License Guide](https://terms.law/ai-output-rights/suno/)
- [Suno Warner Music Changes](https://www.digitalmusicnews.com/2025/12/22/suno-warner-music-deal-changes/)
- [ElevenLabs API Pricing](https://elevenlabs.io/pricing/api)
- [ElevenLabs Sound Effects V2](https://kie.ai/elevenlabs-sound-effect)
- [ElevenLabs Music API](https://elevenlabs.io/blog/eleven-music-now-available-in-the-api)
- [ElevenLabs Music Docs](https://elevenlabs.io/docs/creative-platform/products/music)
- [Suno vs Udio 2026](https://www.tldl.io/blog/suno-vs-udio-comparison)
- [Soundraw](https://soundraw.io/)
- [Freesound API](https://freesound.org/docs/api/)
- [Pixabay Sound Effects](https://pixabay.com/sound-effects/)
- [Remotion Audio Docs](https://www.remotion.dev/docs/using-audio)
- [Remotion Audio Component](https://www.remotion.dev/docs/media/audio)
- [Azure Speech Pricing](https://azure.microsoft.com/en-us/pricing/details/speech/)
- [APIframe Suno API](https://apiframe.ai/suno-api-for-ai-music-generation)
- [PiAPI Suno V5](https://piapi.ai/suno-v5)
