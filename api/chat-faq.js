/**
 * Sipurai FAQ chatbot — Hebrew, free-form interactive replacement for FAQ accordion.
 *
 * Wired into landing FAQSection: replaces accordion with chat UI.
 *
 * Uses Gemini 2.5-Flash (fast + cheap; FAQ is short Q/A).
 *
 * Wave-12 (2026-05-10) per Council 3-LLM recommendation.
 */

const SYSTEM_PROMPT = `אתה צ'אטבוט ידידותי באתר סיפוראי — sipurai.ai — פלטפורמת AI בעברית ליצירת ספרי ילדים מותאמים אישית.

תשובות בעברית, חמות ואישיות, קצרות (2-4 משפטים). אם מישהו רוצה ניסיון — שלח אותו ל"התחילו בחינם".

מה סיפוראי עושה:
- ילד/הורה בוחר נושא, דמויות, סגנון איור, שפה
- ה-AI יוצר ספר שלם עם סיפור + 8-12 איורים מקצועיים + הקראה אופציונלית
- שפות: עברית (עם ניקוד), אנגלית, ייִדיש
- 18 סגנונות איור (Disney, Cartoon, Watercolor, Pixar וכו')
- ייצוא PDF להדפסה

מסלולים (USD):
- חינם: 5 ספרים בחודש, 6 סגנונות, ייצוא PDF אחד
- לייט ($3.90): 15 ספרים, 18 סגנונות, ייצוא ללא הגבלה
- פרימיום ($7.90): ספרים ללא הגבלה, תמיכה מועדפת ⭐
- משפחתי ($9.90): עד 5 פרופילי ילדים, כל תכונות הפרימיום

חוקים חשובים:
- כל המחירים בש״ח: כפל ב-3.65 (לייט ~₪14, פרימיום ~₪29, משפחתי ~₪36)
- כל ספר נשאר אצלך לתמיד
- בלי פרסומות (גם בחינם)
- המידע נשמר באופן מאובטח ב-Supabase
- אם שואלים משהו שלא יודעים — הפנה ל-support@sipurai.ai

מטרה: לעזור לילדים ישראלים לקבל ספרים בעברית מותאמים — הילד הוא הגיבור.`;

export default async function handler(req, res) {
  // CORS for sipurai.ai
  const allowedOrigins = ['https://sipurai.ai', 'https://www.sipurai.ai', 'http://localhost:5173'];
  const origin = req.headers.origin;
  const corsOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', corsOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).end();
  }
  res.setHeader('Access-Control-Allow-Origin', corsOrigin);
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(200).json({
      content: "הצ'אט עדיין בהרצה — בינתיים אפשר לשלוח לי שאלה ב-support@sipurai.ai 😊"
    });
  }

  try {
    const { messages = [] } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages array required' });
    }
    const recent = messages.slice(-10);
    const conversationText = recent.map(m => `${m.role === 'user' ? 'משתמש' : 'אסיסטנט'}: ${m.content}`).join('\n');
    const fullPrompt = `${SYSTEM_PROMPT}\n\nשיחה עד כה:\n${conversationText}\n\nאסיסטנט:`;

    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text: fullPrompt }] }],
        // thinkingBudget:0 — without it gemini-2.5-flash burns the whole budget on hidden
        // "thinking" and the visible answer comes back empty/truncated. Bumped to 600.
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 600,
          thinkingConfig: { thinkingBudget: 0 }
        }
      })
    });

    if (!r.ok) {
      const errText = await r.text();
      console.error('[chat-faq] Gemini failed:', r.status, errText.substring(0, 200));
      return res.status(200).json({
        content: "סליחה, יש בעיה זמנית. נסה שוב או שלח שאלה ל-support@sipurai.ai"
      });
    }

    const data = await r.json();
    const content = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "סליחה, לא הבנתי. נסה לנסח שאלה אחרת.";
    return res.status(200).json({ content });
  } catch (err) {
    console.error('[chat-faq] error:', err.message);
    return res.status(500).json({ error: 'Internal error', content: "סליחה, נסה שוב בעוד רגע." });
  }
}
