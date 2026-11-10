# Sipurai: product vision for the UX overhaul

Date: 10.11.2026 · Version 3: revised after the Codex critique (CRITIQUE.md) and the owner's answers to the eight decision cards (same day) · Visual language: DESIGN-DIRECTION.md (direction A, "לילה טוב", approved).

## One sentence
**Sipurai is the place where a family reads tonight's story together, about the people they love, and where a new story, full of playful options and smart suggestions, is a few taps away.**

Reading comes first, creating second: continuing and re-reading are free every night, while new stories come from the monthly gift.

## The quality bar (the owner, repeated)
Every screen, existing, rebuilt or not yet built, and every system and sub-system (emails, printed and PDF books, share pages, error pages, the admin tool) is built to an outstanding "wow" standard. People judge the product by it. No screen is left "for later, unstyled": PLAN.md maps every route to the PR that brings it to the bar.

## Three layers, one product

| Layer | Who | Feels | Principles (testable) |
|---|---|---|---|
| **1. Parent shell** | A parent on a phone in the evening; also a second parent or grandparent with a role | "Easy, calm, I trust it with my child" | P1 one obvious next action per screen, and at night that is reading · P2 no technical words in the default path · P3 four top destinations · P4 every amount, limit and status has a sentence plus a "?" · P5 privacy said next to the action, and only what is verified |
| **2. Child layer** | A child aged 3 to 8 | "Magic, and it is about me" | C1 restricted surface: reading, narration, page turns only · C2 usable without reading: big separate previous/next buttons, big play/pause, page dots · C3 nothing ranks or compares children · C4 exit by press-and-hold, described as a speed bump, plus help for the phone's screen pinning · C5 only stories an adult opened first appear here · C6 every evening of reading becomes a star in a collection; no streaks, countdowns or locked rewards |
| **3. Creator engine** | Power users, grandparents making a birthday book, teachers | "This can do amazing things" | E1 two doors: "פתיחה בסטודיו" from a book, "להתחיל בסטודיו" from the new-story screen · E2 only capabilities that work end to end · E3 task words first; model, availability and cost under "פרטים מתקדמים" · E4 everything lands on the same shelf and reads in the child layer |

## Decisions of 10.11.2026, and what they mean in the product

**1. Direction A "לילה טוב".** Adopted; B archived.

**2. Leaderboard out, star collection in.** Removed in phase 4; the star collection ships with the new home in phase 2.

**3. Sharing, private by default, in phase 2.** The public community stays hidden. Instead, an explicit per-book choice: **"קישור משפחתי"** for grandparents and relatives.
- Off until the parent turns it on for one book; no public feed, no comments, no likes, no search indexing (`noindex`).
- The recipient sees that one book only: the story with the child's **first name** as it appears in the story, and the **illustrations**. Never a surname, an uploaded photo, the family's other books, the parent's email or account details. The share preview says plainly that the story contains the first name and the illustrated hero before the link is created.
- Unguessable link, optional expiry (7 days by default, or "לא פג"), revoke at any time with immediate effect, a list of active links in הורים, a sentence that a link can be forwarded.
- Tested as a signed-out guest before it is called private.

**4. A personal sample before sign-up, inside our privacy policy.**
- The visitor types a first name; the sample book re-renders **in the browser only**. Nothing is sent to a server or a model, nothing is stored (not even local storage), and no analytics event carries the name or its length.
- The name is carried into the real flow after sign-up through `sessionStorage` only, cleared on read, **never the URL**: the sign-in redirect address and the page-view analytics both record URLs.
- One honest sentence under the field: **"השם נשאר רק בדפדפן שלכם. הוא לא נשלח אלינו ולא נשמר."**
- The policy clause this relies on, quoted from `src/data/privacyPolicyContent.js` (section 2, "איזה מידע אנחנו שומרים"): *"**על הילדים:** • שם, טווח גיל ותיאור של הדמות, כמו שהקלדתם אותם כשיצרתם ספר"*. The policy lists only what we keep; the sample keeps nothing, so it does not contradict it. The analytics clause it must not break: *"**Umami** (analytics.sipurai.ai): ספירת ביקורים בלי עוגיות."*
- The policy file's own rule is "say only what the code really does", so we propose one added sentence (decision D9 in PLAN.md).
- Narration starts only on tap and avoids saying the name; the sample is labelled and does not imply the illustration looks like their child.

**5. Yiddish by our models, released as beta.** Hidden from the language pickers now (users who already chose Yiddish keep it, with Hebrew filling any gap). A model translation pass fills the 129 missing and 146 used-but-missing keys and every new text; two other models review it; disagreements are listed. When complete, Yiddish returns to the pickers marked **"בטא"**.

**6. Dead settings removed now, rebuilt properly.** The 8 settings that do nothing leave the screen now. Parental controls and the AI studio settings are researched, specified and built as real features in phase 2, each with a test proving that a saved setting changes behaviour. Parental controls move from one browser to the account.

**7. Short lower-case addresses** with permanent redirects that keep IDs and query strings.

**8. The gift covers at least 5 short stories, maybe more.** The per-account cost cap is set so 5 short bedtime stories always fit, failures never count, and the number may grow once the real cost of a short story is measured (PR 2.4).

**8b. Playful options and smart suggestions all along the way.** An assistive suggestions layer in the new-story flow and the reader:
- Contextual, optional, never blocking; one tap each; if a suggestion costs a gift story or a credit, the chip shows the cost before the tap.
- In the flow: "רוצים להיות בעצמכם הדמות הראשית? אפשר ליצור אותה כאן" · "נועה אהבה את בונבון בסיפור הקודם. להוסיף אותו?" · "סיפור קצר לפני השינה, 5 דקות" · "להפוך את זה לסיפור בחרוזים?" · "תנו לי רעיון".
- After a story (parent side of the reader's end screen): "לקרוא שוב" · "המשך לסיפור הזה" · "אותו גיבור, הרפתקה חדשה" · "להדפיס ספר אמיתי" · "לשתף עם סבתא בקישור משפחתי".
- Rules first (the family's heroes, past books, time of day), a model only where it adds real value; at most 3 chips at a time; parents can turn suggestions off.

## Safety and trust, designed in
- **Story safety:** age per reader, optional sensitivities, screening as today, and per page in the parent view: skip, edit, report, replace with a story already read.
- **Slow or failed generation:** queued, slow, disconnected, partial and failed states; the request is saved; no duplicate submission; no gift story charged for a failure; a familiar book one tap away; time to first readable page measured before it is advertised.
- **Photos:** optional, the photo-free path equally prominent; copy limited to the verified truth (the policy says the uploaded photo is not stored by us and only the drawing is kept; the drawing provider's handling is under its own terms).
- **Offline:** not promised in phase 2; honest state copy; a later "שמירה לקריאה בלי אינטרנט" spec.
- **Persistence:** account-level reading position and "who reads tonight"; drafts saved from the first choice; save failures shown.

## The family model
"מי קורא הלילה?" on the home; several children, each with their own age and reading positions; shared sessions; other adults invited with a role (read, create, or receive one shared book).

## Navigation
Four tabs: **הלילה** (`/`), **המדף** (`/shelf`), **הגיבורים** (`/heroes`), **הורים** (`/parents`). New story is a button on הלילה and המדף and in the desktop rail. Help is reachable from every error. No notification bell until notifications have a job. Every existing screen and its target are in the route map in PLAN.md.

## Core flows
- **F1 first visit:** name typed in the browser → personal sample (labelled) → sign-up → new-story flow with the name filled in.
- **F2 first story:** מי הגיבור → על מה → מוכנים, with suggestions along the way and the cost line before the button; writing theatre with read-along and per-page skip, edit, report; first star and a free dedication page.
- **F3 tonight:** who reads → continue or a favourite → the night reader; a new story is the quieter third option with the gift count.
- **F4 shelf:** covers grid; read, read aloud, family link, edit, studio, print.
- **F5 print:** size, preview of the printed book, address, payment, status. The supplier is never named in the product; never Grow; no VAT wording.

## Keep and strengthen
The brand and splash; the landing's energy; draft autosave and the hand-off to the reader; the reader's building, paused and missing-art states; topic photography and "הפתיעו אותי"; gamification persistence, re-aimed at stars; page-flip, read-aloud and RTL keys; the print checkout's stepper and `dir="ltr"` fields; the privacy gate and Clerk-gated APIs; English and Yiddish as product languages.
