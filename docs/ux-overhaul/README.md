# UX overhaul planning (Sipurai)

Planning set produced 10 Nov 2026 for the Sipurai UX/i18n overhaul. Documents only: no application code changed.

## Contents
- AUDIT.md, VISION.md, DESIGN-DIRECTION.md, PLAN.md, CRITIQUE.md, SUMMARY-HE.md: the audit, direction, work plan (PLAN.md has the numbered items), an independent critique, and the Hebrew summary for the owner.
- briefs/: one self-contained execution brief per work package (COMMON.md first).
- data/: audit data (i18n audit as JSON and Markdown, screen inventory, live-page observations, raw critique). Counts and code paths; the one live-site contact address and phone were redacted.
- tools/: the scripts that produced the data (i18n-audit.mjs, live-shots.cjs). Not wired into CI.
- mockups/: direction A as HTML/CSS/SVG (a-home, a-read, a-wizard), shoot.cjs to re-capture screenshots, archive/ holds the rejected direction B. Six recompressed screenshots under mockups/shots/ (a-home 1280 and 375 folds, a-read, a-wizard at both widths).
- archive/: the first version of the design direction.

## Left out
All 47 full-page live-site screenshots (about 27 MB), the full-size mockup screenshots (about 2 MB; only 6 kept, recompressed), and the rejected direction B screenshots.

## Where the full set lives
On the server at /root/work/sipurai-ux-plan/ (shots/ and mockups/shots/).
