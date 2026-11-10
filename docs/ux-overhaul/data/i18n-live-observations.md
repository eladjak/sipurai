# Live-site observations (signed-out), captured 2026-11-10 from https://www.sipurai.ai

Screenshots in `docs/ux-overhaul/shots/` (47 files: `375-*`/`1280-*`; the English-forced ones are named `375-en-home-fold.png`, `375-en-pricing-fold.png`). Data: `data/i18n-live-pages.json`. Script: `tools/live-shots.cjs`.

**Screenshots I actually looked at (viewed as images):** 375-home-fold, 375-en-home-fold, 375-pricing-fold, 375-signin-fold, 375-404-fold, 375-blog-fold, 375-privacy-fold.
**Not looked at (captured and measured only):** all *-full.png, all 1280-*, welcome, terms, accessibility, contact, signup, blogpost, bookwizard/library/settings folds, 375-en-pricing-fold.

## Observations (from the viewed screenshots)
- **/ (home, he):** clean, strong first screen. RTL hero, big purple gradient, one clear white CTA ("צרו ספר עכשיו — חינם!") and a secondary one. Small mixed-language spots: badge "יוצרים ספרי ילדים עם AI" and avatar bubbles "E D C B A" (Latin letters, decorative). Nunito/Fredoka have no Hebrew glyphs; the Hebrew shown is a system fallback face.
- **/ with localStorage language=english:** whole page flips to English and LTR (lang=en, dir=ltr, 140 Latin text nodes, 12 Hebrew), logo/menu mirror. So language choice is per browser via localStorage 'language'; a fresh he-IL visitor gets Hebrew.
- **/pricing (he):** Hebrew, but heading and body use a different font from the home page (a plain grotesque, not the Nunito/Fredoka feel), page has no site header/nav (only a small underlined "דף הבית ←" link). "PDF" Latin inside a Hebrew bullet is fine. Feels like a different product than the home page.
- **/sign-in (Clerk):** Hebrew labels, but Clerk widget is half-localized: "Apple"/"Google" buttons are Latin, "Secured by clerk" footer is English, email input has accessible name "Example format: name@example.com" (English aria). Primary button is dark grey, not the brand purple. "המשך" arrow sits on the wrong side for RTL.
- **Unknown URL (/this-does-not-exist) -> redirects to /sign-in?redirect_url=...:** there is NO 404 page for signed-out users; screenshot is byte-identical to sign-in. Same for /BookWizard, /Library, /Settings (all redirect to sign-in with redirect_url).
- **/blog (he):** Hebrew, chips ("AI", "חינוך"...). The featured card's gradient placeholder shows the post title as clipped text on the left edge ("...איך AI משנה את חוויית הקריאה של ילד" cut off) next to a book emoji: a visible clipping/placeholder bug.
- **/privacy (he):** well-formed Hebrew legal page, vendor names in Latin (Clerk, Supabase, Vercel, Google, OpenAI, Creem) are intentional. Date line mixes ISO "2026-11-10" with Hebrew "10 בנובמבר 2026".
