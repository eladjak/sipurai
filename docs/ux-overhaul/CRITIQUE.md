# Independent critique and what changed

**Reviewer:** Codex on the server, through the owner's subscription (`/opt/shared/ask-engine -t 1200 -f <brief> codex`), read-only. Run 10.11.2026, about 4 minutes. Raw answer: `data/codex-critique-raw.txt`.
**What it was given:** product facts, the owner's goals, paths to VISION.md, DESIGN-DIRECTION.md, the mockups and screenshots, the audit data and the real source. It was asked to attack (generic, bad for children, missing for parents, wrong navigation, its own direction choice, feasibility). It was not told which direction we recommend beyond what the documents say.
**Its verdict:** "Choose direction A as a starting point; reject the proposal for implementation until the reader, child safety, family sharing, quota and failure states are designed and tested."

## Where it disagreed, and what we did

| # | Its finding (severity) | Decision | What changed |
|---|---|---|---|
| 1 | Streaks and a 7-night reward turn a ritual into pressure; our three documents even contradicted each other (high) | **Accepted** | No streaks, countdowns or locked rewards. A star collection that keeps every evening and loses nothing (VISION C6; mockup `a-home.html` now says "12 ערבים של סיפור יחד... בלי רצף ובלי מה לפספס") |
| 2 | "Child mode" was a label, not a safety design; press-and-hold is not security (high) | **Accepted** | Child layer defined as a restricted surface (no purchase, sharing, open text, microphone, links, notifications); exit gesture described honestly as a speed bump; we point parents to the phone's screen pinning (VISION C1, C4) |
| 3 | No response to an unsafe or upsetting story (high) | **Accepted** | Per-reader age defaults, optional sensitivities, and skip, edit, report or replace on every page in the parent view; a new story is read by an adult first (VISION "Safety and trust", C5) |
| 4 | The photo copy in our mockup ("stays only with you, deleted after drawing") contradicts the product's own privacy policy (high) | **Accepted. This was a claim I wrote without checking** | Copy replaced with what is true: the photo is sent to our drawing service to create the character, and the character can be deleted; photo-free path kept; any retention claim must be verified before shipping (`a-wizard.html`, VISION) |
| 5 | "Private link for grandma" was undefined access control (high) | **Accepted** | Sharing spec: explicit, previewed, unguessable per book, optional expiry, revoke, forwarding warning, tested as a guest (VISION) |
| 6 | Slow, interrupted or failed generation was not designed; the "under 3 minutes" promise was unmeasured (high) | **Accepted** | Queued, slow, disconnected, partial and failed states; no quota charged on failure; the time target is now "measure first, then advertise" (VISION, PLAN PR 2.2) |
| 7 | A permanent raised "new story" button pushes a quota-consuming act every night (high) | **Accepted** | Navigation is now four tabs; "new story" is a contextual, quieter third option on הלילה, with the remaining gift stories and "a failed story is not counted" next to it. Open question on the $1.90 cap added as decision D8 |
| 8 | Offline was only an illustration (high) | **Accepted** | Offline is not promised in phase 1; honest state copy; a later "save for reading without internet" spec (VISION) |
| 9 | Single-child demo, not a household (high) | **Accepted** | "מי קורא הלילה?" on the home, several children with their own ages and positions, roles for other adults (VISION "The family model"; mockup chip "קוראים: נועה ויואב") |
| 10 | The reader is the product and neither direction designed it (high) | **Accepted** | New mockup `a-read.html`: night surface, big separate previous/next buttons (no swipe-only), big play/pause, replay page, page dots, word highlight, adult exit. Reading-mode PR moved first in phase 2; a child test is a gate |
| 11 | Pre-recorded narration cannot say an arbitrary typed name (high) | **Accepted** | Sample is labelled; narration starts on tap and uses wording without the name while the name shows in the text; no likeness implied (VISION F1) |
| 12 | Direction A's magic is generic (moon, dots, gold glow, anonymous avatars, colour-block covers) (med) | **Partly accepted** | Kept A (Codex also chose A). Added to the plan: a commissioned storybook identity (an illustrated family shelf, recurring characters, a tactile page motif) and a gate to test the system with real generated covers before the tokens are locked (PLAN Track V, PR 1.1 acceptance) |
| 13 | B is louder and less focused, not more child-friendly (med) | **Accepted** | B not adopted; only its concrete hero selection and the voice idea are borrowed |
| 14 | Navigation repetitive; heroes as a permanent tab; bell with no job (med) | **Mostly accepted** | Bell removed; creation contextual. **Kept heroes as a tab** (disagreement): the family characters are the product's difference and where looks are approved. Recorded as the first question for the usability test |
| 15 | Studio overpromised and buried; hiding model names hurts power users (med) | **Accepted** | Two doors to the studio ("להתחיל בסטודיו" and from a book); only end-to-end tested capabilities shown; model, availability and cost under "פרטים מתקדמים" (VISION E1 to E3) |
| 16 | Autosave is local and silent on failure; reading position is per device; redirects must keep IDs and query strings (high) | **Accepted** | Persistence definition (device vs account), drafts from the first choice, visible save failures, account-level reading position, table-driven redirect test including `/BookView?id=` (VISION, PLAN PR 1.3, 2.2) |
| 17 | Mockup accessibility errors: checkboxes inside a `radiogroup`, photo switch was a non-focusable `span`, low-contrast secondary text (med) | **Accepted** | Fixed in `a-wizard.html` (role `group`, real `button role="switch"`); contrast check on every token pair is now part of PR 1.1 acceptance; 200% text scaling added to the general acceptance |
| 18 | "The illustrations will remember how they look" promises consistency nobody proved (med) | **Accepted** | Copy is now "נשתדל לשמור על המראה שלהם"; parents approve and correct a hero's look; multi-page consistency tested across ages, skin tones, hair, disabilities and several heroes before it is advertised |

## Where we still disagree
- **Heroes tab (finding 14).** Kept as a tab; to be measured in the first test with parents (do they find and use it in week one).
- **Nothing else.** All other findings were accepted in full or in part.

## Limits of this critique
Source and static-mockup review only, plus four 375px screenshots. It did not run the app, see real generated books, verify backend privacy enforcement, or watch parents and children. A second, independent design critique (Grok or Antigravity) on a working preview is planned after phase 2.
