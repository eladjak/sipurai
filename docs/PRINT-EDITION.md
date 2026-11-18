# Sipurai print edition

Use the private wizard's **Print edition** export to stage a local handoff. The export includes the versioned JSON manifest and its artwork. Extract it to a private folder and run the compositor. BookPod integration takes the resulting PDFs, subject to human proof approval.

```sh
python3 -m venv .print-venv
.print-venv/bin/pip install -r scripts/print_edition/requirements.txt
.print-venv/bin/python scripts/print_edition/render.py path/to/edition.json proof
.print-venv/bin/python scripts/print_edition/render.py path/to/edition.json proof --check
```

Install Poppler CLI tools, Fontconfig, Pango and LittleCMS on the renderer host. Pillow must have RAQM support. The font files and their OFL licenses are bundled under `scripts/print_edition/fonts`. David Libre Medium comes from [Google Fonts](https://github.com/google/fonts/tree/main/ofl/davidlibre). Rubik comes from its [licensed upstream source](https://github.com/googlefonts/rubik/tree/9167c98fa8699d75ee51769eba20d81beb16bcb5).

## Manifest v1

Provide `title`, `creator`, `blurb`, `coverArt`, `closingArt`, and a nonempty `scenes` array. Set `version` to 1. Assets are relative to the JSON file. Absolute paths are supported for trusted local work. A scene has `layout` set to `single` or `spread`, one `art` asset, and one or two `text` and `zones` entries respectively. For spreads, entries appear in reading order, first the right half then the left. A wide source must be one continuous illustration. Select `top`, `bottom`, `top-left`, `top-right`, `bottom-left` or `bottom-right` after viewing the artwork. Optional `anchor` is the horizontal and vertical crop bias, each between 0 and 1. Optional `panel` is `cream` or `dark`, depending on artwork contrast. Use `panelWidthsMm` for optional per-block width caps in the same reading order.

Set `nikudStatus` to `approved` after the parent approves the exact pointed Hebrew text. Optional `pointing` entries allow intentionally unpointed blocks in an approved edition. `unpointed` uses unpointed body text. Use `--review-pending` to generate or check a review-only proof while approval is outstanding. The PDF subject and preflight preserve that status. Preflight checks consistency between the status and the presence of Hebrew vowel marks. Linguistic correctness is reviewed before approval.

`dedication`, `copyright`, `aboutAuthor`, `dedicationArt`, `endpaperArt`, and `characterSheet` are optional. Dedication artwork defaults to the cover illustration. The underlying endpaper colors and motif are derived from the closing illustration when no explicit endpaper art is provided. Check the closing illustration manually against the character sheet. Optional `qrUrl` must be a canonical Sipurai HTTPS printed-book link with no query or fragment, safe for a stranger to visit.

## Physical geometry

The supported trim presets are 220 × 220, 200 × 200 and 165 × 235 mm. The default is 220 × 220. The 3.2 mm bleed matches [BookPod's InDesign guide](https://bookpod.co.il/indesign/). Content text starts at least 12 mm in from trim, plus enough binding allowance for at least 16 mm. A panoramic artwork is cropped around its shared seam twice, with both page edges carrying the same 3.2 mm overlap across the seam. The story blocks and folios sit above the art. The physical fold, any binding loss and visual consistency require a human proof.

Opening page 1 stands on the left. Paired pages are even-right, odd-left. The renderer fills an unoccupied side with deliberate matter to preserve a true spread. The paperback sequence rounds up to a four-page signature, from 24 to 80, and ends on the illustrated closing page.

The outside wrap is front on the left, spine in the middle, back on the right. The measured spine is 1.8 mm for 24-page 220 × 220 white 110 gsm soft matte. Other estimates use sheet counts and supplier-average calipers: 0.15 mm for white 110 gsm, 0.125 mm for matte coated 130 gsm and 0.16 mm for matte coated 170 gsm; preflight flags supplier confirmation. `spineMm` allows an explicit dimension. Hardcovers require a supplier template with boards, hinge and wrap allowances. The June [BookPod API PDF](https://bookpod.co.il/wp-content/uploads/2025/01/BookPod-API-Documentation_-CreateBook_Jun2025-1.pdf) accepts a second cover page for inside design. The October vendor documentation warns a two-page cover may be flagged in its later production check. Use the one-page `cover.pdf` for that check. The optional `cover-with-inside.pdf` includes coordinated endpapers and a white 40 × 15 mm area near the bottom center of the left inside panel for the printer’s barcode. The 5 mm bottom-trim offset is inferred from the supplier example, not an exact published measurement; confirm in its preview. Set `insideCover` to false to skip it.

## Color and checks

The renderer labels the native placed resolution separately from 300 PPI interpolation. For previously upscaled assets, provide the known original dimensions as scene `nativePixels`, `coverNativePixels` and `closingNativePixels`; otherwise the provided file dimensions are used as the baseline. Images with embedded input profiles are normalized to sRGB. The `brightness` multiplier defaults to 1.07 for a gently lifted digital proof. An optional `iccProfile` applies an ICC conversion to the actual encoded PDF art and sets the output intent. Text and vector decoration use tagged sRGB. Generic CMYK exchange profiles support visual review. Confirm the actual press profile with the printer before setting `profileVendorVerified`, then inspect a printed copy under neutral light for tint and shadows. The compositor does not certify PDF/X conformance.

`preflight.json` records actual PDF boxes, font and resolution checks, intended layout text boxes, file hashes, warnings and review status. Inspect the final rendered glyphs, facing PNGs, wrap and both cover panels under `previews/`. A clean structural check is distinct from parent approval and supplier signoff. The checkout for the legacy 24-page product refuses books with private wizard drafts until the revised product and approved proof files have a verified fulfillment path.

```sh
.print-venv/bin/python -m unittest discover -s scripts/print_edition -p 'test_*.py'
node --test tests/print-spec.test.mjs tests/print-export.test.mjs tests/print-edition-model.test.mjs
```

## Private on-screen proof

The saved book opens the print editor at `/PrintEdition?id=…`. The viewer reads rasterized pages from the SPB PDFs, including their bleed. Turn a spread, choose a page to edit, and wait for the updated proof. A pending Hebrew review is marked on screen. The primary wrap is the one-page softcover PDF. The illustrated inside cover is a separate two-page alternative. Hardcover is unavailable; the paper-specific spine estimates need supplier confirmation.

The approved download packages the exact interior and cover that supplied the on-screen pages. Its receipt identifies the book, saved revision, trim, spine and SHA-256 of each PDF. Each download verifies the source and streams the file through a digest check. A changed source or saved edition requires a fresh proof. The original source bundle remains available for editorial work. For a future fulfillment integration, use the approved PDF pair and verify its receipt before dispatch.

The signed-in proof endpoint runs the bundled compositor in a short-lived Vercel Sandbox in the Sipurai project. Package installation precedes the network shutdown and upload of private art. The sandbox uses no public ports or persistent snapshots. Unfinished work and cached output expire with the session. `PRINT_PROOF_DISABLED=true` disables rendering without disabling manual editing. Set this variable in the affected Sipurai project and redeploy to apply it.

`VITE_PRINT_EDITION_POLICY=open` is the no-charge pilot default. `subscriber-preview` follows the existing plan for advanced controls. Manual text and nikud correction, dedication and binding remain available. The feature policy is in `src/lib/printEdition/policy.js`. AI assistance also requires the parent's explicit choice in the editor and the existing consent and provider quota checks.
