# מחקר Sipurai - TTS, וידאו, ומודל Freemium

**תאריך:** 2026-03-17
**פרויקט:** Sipurai - פלטפורמת יצירת ספרי ילדים עם AI

---

## מחקר 1: Text-to-Speech / הקראה לספרי ילדים

### מצב נוכחי
האפליקציה משתמשת ב-Web Speech API (ברירת מחדל של הדפדפן). האיכות בינונית, במיוחד בעברית.

### סקירת ספקים

#### 1. ElevenLabs - הטוב ביותר באיכות

| פרמטר | פרטים |
|--------|--------|
| **תמיכה בעברית** | כן - דרך Eleven v3 (41 שפות חדשות) |
| **איכות** | מצוינת - הכי טבעי בשוק, רגשות ואינטונציה |
| **תוכנית חינם** | 10,000 תווים/חודש (~12-15 דקות) - ללא שימוש מסחרי |
| **Starter** | $4.17/חודש - שימוש מסחרי |
| **Creator** | $11/חודש |
| **Pro** | $82.50/חודש |
| **Voice Cloning** | כן - מ-6 שניות אודיו |
| **קולות שונים לדמויות** | כן - עד 3 קולות מותאמים בחינם, יותר בתשלום |
| **API** | כן, REST API מלא |
| **יתרונות** | איכות מובילה בשוק, voice cloning מעולה, תמיכה בעברית |
| **חסרונות** | יקר לשימוש כבד, חינם = לא מסחרי, attribution חובה |

#### 2. Azure Cognitive Services TTS

| פרמטר | פרטים |
|--------|--------|
| **תמיכה בעברית** | כן - 2 קולות Neural |
| **קולות** | `he-IL-HilaNeural` (נקבה, 113 מ/ד), `he-IL-AvriNeural` (זכר, 106 מ/ד) |
| **איכות** | טובה - Neural voices איכותיים |
| **תוכנית חינם** | 500,000 תווים/חודש (Neural) - Free Tier של Azure |
| **מחיר** | $16 למיליון תווים (Neural) |
| **Voice Cloning** | כן - Custom Neural Voice (דורש אישור ודאטה) |
| **קולות שונים לדמויות** | מוגבל - רק 2 קולות עבריים, אבל אפשר לשנות pitch/rate ב-SSML |
| **SSML** | תמיכה מלאה - שליטה על pitch, rate, emphasis, breaks |
| **יתרונות** | Free tier נדיב מאוד, SSML מתקדם, אמינות enterprise |
| **חסרונות** | רק 2 קולות עבריים, אין HD voices לעברית, פחות "חם" מ-ElevenLabs |

#### 3. Google Cloud TTS

| פרמטר | פרטים |
|--------|--------|
| **תמיכה בעברית** | כן - אבל רק Standard voices |
| **קולות** | `he-IL-Standard-A` (נקבה), `he-IL-Standard-B` (זכר) |
| **איכות** | בינונית - Standard בלבד, אין WaveNet/Neural2 לעברית |
| **תוכנית חינם** | 4 מיליון תווים/חודש (Standard) |
| **מחיר Standard** | $4 למיליון תווים |
| **WaveNet לעברית** | לא זמין! |
| **Neural2 לעברית** | לא זמין! |
| **יתרונות** | הכי זול, free tier ענק |
| **חסרונות** | Standard בלבד = איכות נמוכה, אין WaveNet/Neural2 לעברית |

#### 4. Amazon Polly

| פרמטר | פרטים |
|--------|--------|
| **תמיכה בעברית** | לא! עברית לא נתמכת כלל |
| **סטטוס** | אין תוכניות ידועות להוספה |
| **מסקנה** | לא רלוונטי לפרויקט שלנו |

#### 5. אופציות חינם / Open Source

| מודל | תמיכה בעברית | איכות | הערות |
|------|--------------|--------|--------|
| **Coqui XTTS v2** | לא - 17 שפות, ללא עברית | מעולה (לשפות נתמכות) | Voice cloning מ-6 שניות |
| **Bark** | חלקית - multilingual אבל לא מותאם | טובה-בינונית | אקספרסיבי, רגשות |
| **Piper** | לא ידוע | טובה | מהיר, מתאים ל-edge |
| **Kokoro** | לא ידוע - 82M פרמטרים | טובה | קל משקל |
| **MeloTTS** | multilingual - לא ברור לגבי עברית | טובה | real-time |
| **ivrit.ai** | כן! מיועד לעברית | בפיתוח | מאמץ ישראלי, בעיקר STT כרגע |
| **Web Speech API** | כן - תלוי דפדפן | בינונית-נמוכה | מה שיש לנו היום |

#### 6. קולות שונים לדמויות - פתרונות

| גישה | ספק | מורכבות | עלות |
|-------|------|---------|------|
| **קולות מוכנים שונים** | Azure (2 קולות + SSML pitch/rate) | קלה | $ |
| **Voice Cloning** | ElevenLabs (מ-6 שניות) | בינונית | $$ |
| **Multi-voice narrative** | Kukarella DialoguesAI | בינונית | $$ |
| **קול ילד/ילדה** | Inworld / ElevenLabs | קשה | $$$ |
| **פתרון משולב** | Azure לנרטיב + ElevenLabs לדמויות | בינונית | $$ |

### טופ 3 המלצות

#### המלצה 1: Azure TTS (מומלץ ראשי)
- **למה:** Free tier של 500K תווים/חודש = עשרות ספרים בחינם
- **עלות:** $0 עד סקייל משמעותי
- **מורכבות:** קלה-בינונית
- **תמיכה בעברית:** 2 קולות Neural - Hila ו-Avri
- **יתרון מיוחד:** SSML מאפשר לשנות pitch/rate/emphasis לכל דמות
- **חיסרון:** רק 2 קולות בסיסיים

#### המלצה 2: ElevenLabs (Premium Feature)
- **למה:** איכות מובילה, voice cloning, רגשות
- **עלות:** $4.17/חודש (Starter) ומעלה
- **מורכבות:** קלה (API פשוט)
- **תמיכה בעברית:** מלאה דרך Eleven v3
- **יתרון מיוחד:** קול ייחודי לכל דמות דרך voice cloning
- **חיסרון:** יקר לסקייל, חינם = לא מסחרי

#### המלצה 3: Web Speech API + Azure Hybrid
- **למה:** חינם לגמרי להתחלה, שדרוג הדרגתי
- **עלות:** $0
- **מורכבות:** קלה
- **תמיכה בעברית:** תלוי דפדפן (Chrome = Google TTS)
- **יתרון:** אפס עלות, מיידי
- **חיסרון:** איכות לא עקבית בין דפדפנים

### גישה מומלצת ל-Sipurai

```
שכבה 1 (חינם):     Web Speech API - מה שכבר עובד
שכבה 2 (Free Tier): Azure TTS Neural - שדרוג משמעותי באיכות
שכבה 3 (Premium):   ElevenLabs - voice cloning + איכות מעולה
```

**פלואו מוצע:**
1. משתמש חינם → Web Speech API (בסיסי, מיידי)
2. משתמש רשום → Azure TTS (איכות טובה, SSML, 2 קולות)
3. משתמש פרימיום → ElevenLabs (voice cloning, קול ייחודי לכל דמות)

---

## מחקר 2: יצירת וידאו מתוכן הספר

### הגישות האפשריות

#### גישה 1: Remotion (React-Based Video) - מומלצת!

| פרמטר | פרטים |
|--------|--------|
| **מה זה** | Framework ליצירת וידאו עם React components |
| **רישיון** | חינם לפרטיים ועסקים קטנים (עד 3 עובדים) |
| **מחיר (חברות)** | Creators $25/חודש, Automators $100/חודש |
| **איכות** | מעולה - MP4, WebM, בכל רזולוציה |
| **Ken Burns Effect** | יש template מוכן! |
| **עברית/RTL** | כן - React components תומכים ב-RTL |
| **מורכבות** | בינונית - צריך לכתוב React components |

**יתרונות:**
- חינם לנו (עסק קטן)
- כתוב ב-React - מתאים מושלם ל-stack שלנו
- Ken Burns template מוכן
- שליטה מלאה על כל פיקסל
- אפשר לשלב TTS כ-audio track
- Remotion Skills (2026) - יצירת וידאו עם AI prompts!

**חסרונות:**
- צריך שרת לרינדור (או Lambda)
- זמן רינדור - דקות לסרטון
- צריך לכתוב קוד React לכל אנימציה

**מה אפשר לעשות:**
```
עמוד ספר → Ken Burns zoom/pan על האיור
         → טקסט הסיפור מופיע בהדרגה (subtitle style)
         → TTS audio מנרטר ברקע
         → מעבר חלק לעמוד הבא (fade/slide)
         → מוזיקת רקע
```

#### גישה 2: FFmpeg + Canvas (DIY)

| פרמטר | פרטים |
|--------|--------|
| **מה זה** | יצירת וידאו מתמונות עם FFmpeg |
| **מחיר** | חינם לגמרי (open source) |
| **איכות** | טובה - תלוי ביישום |
| **Ken Burns** | אפשרי עם filter_complex |
| **מורכבות** | גבוהה - command line, קשה לתחזוקה |

**פקודה לדוגמה:**
```bash
ffmpeg -loop 1 -i page1.jpg -vf "zoompan=z='min(zoom+0.001,1.5)':d=125:s=1920x1080" -t 5 -c:v libx264 page1.mp4
```

**יתרונות:** חינם, מוכח, מהיר
**חסרונות:** קשה לתחזוקה, אין UI components, פחות גמיש

#### גישה 3: AI Video Generation (Runway / Pika)

| פרמטר | Runway | Pika |
|--------|--------|------|
| **מחיר** | $12-35/חודש | $8/חודש |
| **תוכנית חינם** | מוגבל | 80 credits/חודש |
| **Image-to-Video** | כן (Gen-3/4) | כן |
| **איכות** | מעולה | טובה מאוד |
| **שליטה** | בינונית | בינונית |
| **API** | כן | כן |

**יתרונות:**
- תוצאות מרהיבות - איורים "מתעוררים לחיים"
- פשוט לשימוש - image-to-video
- Pika: keyframe transitions 1-10 שניות

**חסרונות:**
- יקר לסקייל (כל עמוד = credits)
- ספר של 10 עמודים = 10 generations = הרבה credits
- אין שליטה מלאה על התוצאה
- לא מתאים לטקסט עברי (אין RTL support ב-video gen)
- זמני עיבוד ארוכים

**חישוב עלות לספר אחד:**
- ספר ממוצע = 10 עמודים
- Pika: ~10 credits לעמוד = 100 credits/ספר
- 80 credits חינם = לא מספיק אפילו לספר אחד
- Runway: עוד יותר יקר

#### גישה 4: Lottie Animations + TTS (הכי קלה)

| פרמטר | פרטים |
|--------|--------|
| **מה זה** | אנימציות JSON קלות על איורים |
| **מחיר** | חינם |
| **מורכבות** | קלה |
| **איכות** | בינונית-טובה |

**הרעיון:** במקום וידאו "אמיתי", ליצור חוויית "ספר מונפש" בתוך הדפדפן:
- איור עם Ken Burns effect (CSS transform)
- טקסט מופיע בהדרגה
- TTS מנרטר
- כפתורים קדימה/אחורה
- לא נדרש רינדור server-side

### טופ 3 המלצות

#### המלצה 1: Remotion - Ken Burns + TTS (מומלץ ראשי)
- **למה:** חינם, React-based, Ken Burns template מוכן, תוצאה מקצועית
- **עלות:** $0 (עסק קטן)
- **מורכבות:** בינונית
- **תמיכה בעברית:** מלאה (React components + RTL CSS)
- **תוצאה:** MP4 שניתן להוריד/לשתף

#### המלצה 2: In-Browser Animated Reader (השקעה ראשונית נמוכה)
- **למה:** אפס עלות שרת, חוויה מיידית
- **עלות:** $0
- **מורכבות:** קלה
- **תמיכה בעברית:** מלאה
- **תוצאה:** חוויה אינטראקטיבית בדפדפן (לא קובץ וידאו)

#### המלצה 3: Pika AI Video (Premium Future Feature)
- **למה:** איורים שמתעוררים לחיים - WOW effect
- **עלות:** $8/חודש ומעלה
- **מורכבות:** קלה (API call)
- **תמיכה בעברית:** חלקית (וידאו בלי טקסט)
- **תוצאה:** סרטון AI מרהיב (אבל יקר)

### גישה מומלצת ל-Sipurai

```
שלב 1 (MVP):      In-Browser Animated Reader
                   - Ken Burns CSS על איורים
                   - טקסט מתגלה בהדרגה
                   - TTS (Web Speech API / Azure)
                   - כפתורי ניווט

שלב 2 (Export):    Remotion Video Export
                   - כפתור "ייצא כסרטון"
                   - רינדור server-side (Vercel function / Lambda)
                   - MP4 להורדה

שלב 3 (Premium):   AI Animated Pages
                   - Pika/Runway לעמודים נבחרים
                   - "עמוד קסום" - איור שזז
                   - Premium feature בלבד
```

---

## מחקר 3: פיצול Free vs Premium

### ניתוח מתחרים

#### StoryJumper
| תכונה | חינם | בתשלום |
|--------|------|--------|
| יצירת ספרים דיגיטליים | כן | כן |
| קריאה אונליין | כן | כן |
| שיתוף | כן | כן |
| הדפסה (Hardcover) | לא | ~$25-35 |
| הדפסה (Paperback) | לא | ~$10-15 |
| PDF eBook | לא | ~$5 |
| Video Book | לא | ~$10 |
| **מודל:** יצירה חינם, מונטיזציה מהדפסה/ייצוא |

#### Wonderbly (LostMy.Name)
| תכונה | חינם | בתשלום |
|--------|------|--------|
| התאמה אישית | לא - אין גרסה חינם | $25-40/ספר |
| תצוגה מקדימה | כן (preview) | כן |
| הדפסה | לא | כלול במחיר |
| **מודל:** מכירת מוצר פיזי, אין freemium אמיתי |

#### Storybird
| תכונה | חינם | בתשלום |
|--------|------|--------|
| יצירת סיפורים | מוגבל | $8.99/חודש |
| גלריית אמנות | חלקי | מלא |
| פרסום | לא | כן |
| **מודל:** Freemium עם מגבלת תוכן |

#### Canva (Education)
| תכונה | חינם | Pro ($15/חודש) |
|--------|------|--------|
| תבניות | מוגבל | 100M+ |
| עיצוב | כן | כן |
| AI features | מוגבל | מלא |
| Brand Kit | לא | כן |
| רקעים/אלמנטים | מוגבל | פרימיום |
| **Education:** חינם מלא לבתי ספר |
| **מודל:** Freemium + Education חינם |

#### Toveedo (ישראלי)
| תכונה | חינם | בתשלום |
|--------|------|--------|
| תוכן וידאו | מוגבל | מנוי |
| **מודל:** מנוי חודשי לתוכן בטוח לילדים |

### נתוני המרה (Freemium → Paid)

| מדד | ערך |
|------|-----|
| **ממוצע SaaS** | 2-5% |
| **אפליקציות ילדים** | 1-3% (הורים זהירים יותר) |
| **Canva** | ~4-7% (value proposition חזק) |
| **Apps with trial** | 8-15% (trial טוב ממיר יותר) |
| **Consumer web apps** | 2-4% ממוצע |

### רגישות לתמחור - שוק ישראלי

| גורם | פרטים |
|-------|--------|
| **GDP per capita** | ~$52,000 - כוח קנייה גבוה |
| **נכונות לשלם** | אזורים עירוניים - גבוהה לתוכן איכותי |
| **רגישות מחיר** | בינונית - הורים ישראלים משווים הרבה |
| **מחיר מקובל לאפליקציית ילדים** | 19-39 ש"ח/חודש (~$5-10) |
| **מחיר מקובל לספר מודפס** | 60-120 ש"ח ($15-30) |
| **תחרות** | נמוכה - אין פלטפורמה דומה בעברית! |
| **יתרון** | שוק קטן = פחות תחרות, נאמנות גבוהה |

### מודל Freemium מומלץ ל-Sipurai

#### חינם (Free Tier)
| תכונה | מגבלה |
|--------|-------|
| יצירת ספרים | 2 ספרים/חודש |
| דפים לספר | עד 8 דפים |
| איורי AI | סגנון אחד (cartoon) |
| TTS הקראה | Web Speech API (בסיסי) |
| שיתוף | לינק ציבורי |
| ספריה | עד 5 ספרים |
| דמויות | 3 דמויות מוכנות |
| שפות | עברית בלבד |
| Gamification | XP + badges בסיסיים |
| קהילה | צפייה בלבד |

#### פרימיום (Premium - 29 ש"ח/חודש ~ $8)
| תכונה | כלול |
|--------|------|
| יצירת ספרים | ללא הגבלה |
| דפים לספר | עד 20 דפים |
| איורי AI | כל הסגנונות (watercolor, 3D, anime...) |
| TTS הקראה | Azure Neural (איכותי) |
| שיתוף | לינק + QR + embed |
| ספריה | ללא הגבלה |
| דמויות | ללא הגבלה + עיצוב מותאם |
| שפות | עברית + אנגלית + יידיש |
| Gamification | מלא + leaderboard |
| קהילה | פרסום + תגובות |
| PDF Export | כן |
| Animated Reader | כן (in-browser) |
| ללא פרסומות | כן |

#### פרימיום פלוס (49 ש"ח/חודש ~ $13)
| תכונה | כלול |
|--------|------|
| הכל בפרימיום | + |
| TTS Premium | ElevenLabs (voice cloning!) |
| Video Export | Remotion MP4 |
| AI Studio | בחירת מודל AI |
| הדפסה | הנחה 20% |
| דמויות AI | יצירת דמויות מאפס |
| שיתוף פעולה | collaborative editing |

#### הדפסה (One-time purchase)
| מוצר | מחיר |
|-------|-------|
| Softcover A5 | 49 ש"ח (~$13) |
| Hardcover A4 | 89 ש"ח (~$24) |
| Hardcover Premium | 129 ש"ח (~$35) |
| PDF Download | 19 ש"ח (~$5) |
| Video Export | כלול בפרימיום פלוס |

### אסטרטגיית המרה

| טקטיקה | פרטים |
|---------|--------|
| **Hook** | ספר ראשון חינם ללא מגבלה (onboarding) |
| **Limit Pain** | אחרי הספר הראשון - מגבלת 2/חודש |
| **Preview Premium** | "נסה TTS איכותי" - 30 שניות דמו |
| **Print Upsell** | "הספר שלך מוכן להדפסה! רק 49 ש"ח" |
| **Social Proof** | "1,200 ספרים נוצרו השבוע" |
| **Trial** | 7 ימים חינם לפרימיום |
| **Annual Discount** | 249 ש"ח/שנה (חיסכון של 2 חודשים) |
| **Family Plan** | 39 ש"ח/חודש ל-3 ילדים |

### מה ממיר הכי טוב בתוכן ילדים

| דרגה | Feature | סיבה |
|------|---------|-------|
| 1 | **הדפסת ספר** | מוצר פיזי = ערך מורגש מיידי |
| 2 | **ייצוא PDF** | "השארתי עותק" - תחושת בעלות |
| 3 | **TTS Premium** | הילד מקשיב לסיפור - WOW |
| 4 | **סגנונות נוספים** | הורה רוצה "ציור שמן" לא "קרטון" |
| 5 | **ללא מגבלה** | ילד פורה שרוצה ליצור עוד |

---

## סיכום והמלצות

### עדיפויות לפיתוח

| עדיפות | תכונה | ROI | מורכבות | עלות |
|---------|--------|-----|---------|------|
| 1 | **Azure TTS** (free tier) | גבוה | קלה | $0 |
| 2 | **In-Browser Animated Reader** | גבוה | קלה-בינונית | $0 |
| 3 | **Free/Premium Split** | קריטי | בינונית | $0 |
| 4 | **PDF Export** | גבוה | קלה (jsPDF קיים) | $0 |
| 5 | **Remotion Video Export** | בינוני | בינונית | $0 |
| 6 | **ElevenLabs Premium TTS** | בינוני | קלה | $4+/חודש |
| 7 | **Print Integration** | גבוה | גבוהה | צריך שותף |

### לו"ז מוצע

```
חודש 1: Azure TTS + Free/Premium Split + PDF Export
חודש 2: In-Browser Animated Reader + Gamification gates
חודש 3: Remotion Video Export (Premium)
חודש 4: ElevenLabs Integration (Premium Plus)
חודש 5: Print Partnership + Launch
```

### תקציב חודשי צפוי (1000 משתמשים)

| שירות | עלות/חודש |
|--------|-----------|
| Azure TTS (free tier) | $0 |
| Vercel Hosting | $0-20 |
| Supabase | $0-25 |
| ElevenLabs (אם premium users) | $11-82 |
| Sentry + Umami | $0 |
| **סה"כ** | **$11-127/חודש** |

---

## מקורות

### TTS
- [ElevenLabs Hebrew TTS](https://elevenlabs.io/text-to-speech/hebrew)
- [ElevenLabs Pricing](https://elevenlabs.io/pricing)
- [ElevenLabs Pricing Guide - Flexprice](https://flexprice.io/blog/elevenlabs-pricing-breakdown)
- [Google Cloud TTS Pricing](https://cloud.google.com/text-to-speech/pricing)
- [Google Cloud TTS Voices](https://docs.cloud.google.com/text-to-speech/docs/voices)
- [Azure TTS Language Support](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support)
- [Azure Hebrew Voices](https://json2video.com/ai-voices/azure/languages/hebrew/)
- [Amazon Polly Languages](https://docs.aws.amazon.com/polly/latest/dg/supported-languages.html)
- [Open Source TTS 2026 - Apatero](https://apatero.com/blog/open-source-text-to-speech-models-beyond-elevenlabs-2026)
- [Best Open Source TTS - BentoML](https://www.bentoml.com/blog/exploring-the-world-of-open-source-text-to-speech-models)
- [ivrit.ai - Hebrew AI](https://huggingface.co/ivrit-ai)
- [Coqui XTTS v2](https://huggingface.co/coqui/XTTS-v2)

### Video
- [Remotion](https://www.remotion.dev/)
- [Remotion License & Pricing](https://www.remotion.dev/docs/license)
- [Remotion Ken Burns Template](https://www.reactvideoeditor.com/remotion-templates/ken-burns)
- [Remotion Skills 2026](https://gaga.art/blog/remotion-skills/)
- [Runway AI Pricing](https://runwayml.com/pricing)
- [Pika Pricing](https://pika.art/pricing)
- [AI Video API Guide 2026](https://wavespeed.ai/blog/posts/complete-guide-ai-video-apis-2026/)

### Freemium & Market
- [StoryJumper Pricing](https://www.storyjumper.com/prices)
- [StoryJumper Reviews - G2](https://www.g2.com/products/storyjumper/reviews)
- [Canva Education](https://www.canva.com/education/)
- [SaaS Freemium Conversion Rates 2026](https://firstpagesage.com/seo-blog/saas-freemium-conversion-rates/)
- [Freemium Conversion Techniques](https://adapty.io/blog/freemium-to-premium-conversion-techniques/)
- [Storybird Alternatives](https://alternativeai.tools/tools/storybird)
- [Toveedo](https://toveedo.com/)
- [Israeli Apps for Kids](https://www.israel21c.org/top-10-israeli-apps-for-kids/)
