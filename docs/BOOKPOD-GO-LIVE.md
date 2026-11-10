# Printed-book orders: go-live runbook (print partner API)

Status of this branch: code matches the partner's official API (Oct-2026 docs). Nothing is deployed, no flag is on,
no env was set, and **no live call has ever been made** with these credentials. Everything below is what the owner
does, in order. Users never see the partner: all customer-facing text says "Sipurai".

## 0. Official documents the code follows

| What | Version | Where |
|---|---|---|
| Create Book | v5.1 | linked from https://bookpod.co.il/api/ (public Google Docs) |
| Create Order | v1.2 | same page |
| Calculate Order Price | v1.1 | same page |
| Shipment Tracking | v1.1 | same page |

Base URL (from the docs): `https://cloud-function-bookpod-festjdz7ga-ey.a.run.app`, paths `/api/v1/...`.
Headers: `x-user-id`, `x-custom-token`. No sandbox exists in the docs.

## 1. Environment variables

Set on the Vercel project `ey.ai-kids-playground`. `P` = Production, `V` = Preview. **Preview must not hold the
real partner token** unless a preview deployment is meant to place real, paid orders.

| Name | P | V | Value / source | Note |
|---|---|---|---|---|
| `BOOKPOD_USER_ID` | yes | no | `Sipurai` | not secret |
| `BOOKPOD_API_TOKEN` | yes | no | server keyvault `/etc/elad-network/keyvault/bookpod-sipurai.env` | **secret**. `BOOKPOD_API_KEY` is read only as a legacy fallback; use the TOKEN name (same as the two sister stores and the store script). The doc calls the token "short-lived": see section 6 |
| `BOOKPOD_CONTACT_EMAIL` | yes | no | a Sipurai mailbox | sent as the recipient email so the partner never mails the customer; required |
| `BOOKPOD_ENABLED` | yes (last) | no | `true` | the vendor gate. Off = no vendor call is ever made |
| `BOOKPOD_API_BASE` | leave unset | no | the host is PINNED in code | any value that is not the documented partner origin makes the client refuse to run (the token is never sent elsewhere); redirects are refused too |
| `BOOKPOD_MAX_ORDER_AGOROT` | optional | no | default `100000` | absolute ceiling for one partner order (agorot), max 1,000,000 |
| `PRINT_READY_BUCKET` | optional | no | default `print-ready` | optional bucket for finished PDFs `<bookId>/interior.pdf`, `cover.pdf` (service role writes only) |
| `PRINT_SUBMITTING_STALE_MINUTES` | optional | no | default `10`, allowed 6 to 240 | an order left in `submitting` longer than this is parked as an UNKNOWN outcome and alerted |
| `BOOKPOD_PRICE_MARGIN_AGOROT` | optional | no | default `200`, allowed 0 to 1000 | allowed gap between the partner price and ours; above it the order is refused. Larger or non-numeric values make the client refuse to run (fail closed) |
| `BOOKPOD_EXPECTED_SHIP_AGOROT` | optional | no | default `2900` | partner shipping incl. VAT (measured: 24.58 + VAT = 29.00) |
| `PRINT_ARTWORK_BUCKET` | optional | no | default `print-artwork` | Supabase Storage bucket holding finished page art |
| `PRINT_ORDER_ENABLED` | yes (last) | no | `true` | server flag for the orders API |
| `VITE_PRINT_ORDER_ENABLED` | yes (last) | no | `true` | client flag (build time: needs a redeploy) |
| `PRINT_ADMIN_CLERK_IDS` | yes | no | owner's Clerk user id | admin screen and retry action |
| `CRON_SECRET` | yes | no | random 32+ chars | the stuck-order sweeper (runs every 10 minutes) |
| `PRINT_ALERT_WEBHOOK_URL` | **required before the flag goes on** | no | a channel URL somebody reads | alerts for stuck / failed / price-mismatch / auth orders. Without it the sweeper logs `NOBODY IS NOTIFIED` and the function log is the only trace. Send a test alert before go-live |
| `MORNING_API_KEY_ID`, `MORNING_API_KEY_SECRET` | yes | no | Morning (Green Invoice) API keys | payment |
| `MORNING_WEBHOOK_SECRET`, `MORNING_NOTIFY_SECRET` | yes | no | random | notify URL token |
| `CLERK_JWKS_URL`, `CLERK_ISSUER`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | yes | as today | existing | `CLERK_JWKS_URL` was **not found** in Vercel on 10.11 |
| `PRINT_MARGIN_AGOROT`, `PRINT_SHIP_AGOROT`, `PRINT_MAX_QTY`, `PRINT_PICKUP_ENABLED` | optional | no | defaults 5434 / 2900 / 10 / off | our customer prices (79 + 29 ILS) |

Measured on 10.11.2026 (names only): none of the `BOOKPOD_*`, `PRINT_*`, `MORNING_*`, `CRON_SECRET` exist in Vercel yet.
Order of switching on: everything else first, then `BOOKPOD_ENABLED`, then `PRINT_ORDER_ENABLED`, then `VITE_PRINT_ORDER_ENABLED` last.

## 2. Migrations

Apply in the Supabase SQL editor of project `furviizyohryyqubosut`, in this order (the third one is new in round 3):

1. `migrations/20261108_book_print_size.sql` (adds `books.print_size`, a check, and an aspect guard trigger)
2. `migrations/20261108_print_orders.sql` (tables `print_orders`, `print_order_events`, indexes, RLS, append-only trigger)
3. `migrations/20261110_print_order_hardening.sql` (column `print_orders.submit_started_at` for the sweeper, table `print_vendor_state` for the shared auth breaker). **Required**: without it the sweeper and the breaker cannot work.

Check they were applied (read-only, run in the SQL editor):

```sql
select
  (select count(*) from information_schema.columns where table_schema='public' and table_name='books' and column_name='print_size') as books_print_size,       -- expect 1
  (select count(*) from information_schema.tables  where table_schema='public' and table_name in ('print_orders','print_order_events')) as order_tables,        -- expect 2
  (select count(*) from pg_trigger where tgname in ('guard_book_print_aspect','print_order_events_no_update') and not tgisinternal) as triggers,                 -- expect 2
  (select count(*) from pg_policies where schemaname='public' and tablename='print_orders') as policies,                                                        -- expect >= 1
  (select count(*) from information_schema.columns where table_schema='public' and table_name='print_orders' and column_name='submit_started_at') as sweeper_column, -- expect 1
  (select count(*) from information_schema.tables  where table_schema='public' and table_name='print_vendor_state') as breaker_table;                          -- expect 1
```

Anything below the expected number means that migration was not applied.

Storage: create two **private** buckets, none public: `print-artwork` (finished page art, see section 4).
The interior PDF is built in memory and sent straight to the partner; it is not stored by us (it is 125-155 MB,
above the default 50 MB object limit).

## 3. One-command live smoke test (price call only)

Needs the owner's permission for the host `cloud-function-bookpod-festjdz7ga-ey.a.run.app` in the containment guard.
One read-only request (`POST /api/v1/orders/price`). It creates, uploads and orders nothing.

```bash
set -a; . /etc/elad-network/keyvault/bookpod-sipurai.env; set +a
BOOKPOD_CONTACT_EMAIL=you@example.com npm run bookpod:smoke -- --bookid 33377 --method ship
```

Expected, if everything is right: `partner total : 53.66 ILS`, `our expected  : 53.66 ILS`, `VERDICT: OK`.
Run on the server on 10.11.2026 (round 2 code): token accepted, total 53.66, shipping 29, items 24.66, book 33377 visible to the API user. Measured: the answer includes VAT and carries `currency: ILS`.
How to read the other outcomes:

| Output | Meaning | Do |
|---|---|---|
| `code=vendor_token_expired` | the docs mention "Token expired" | ask the partner for a new token, store it, rerun |
| `code=vendor_auth_failed` | wrong user/token, or "token is not enabled for the API" (403) | check the deposit and API registration with the partner |
| `PRICE GAP` about 18% | the API `total` may exclude VAT | tell the maintainer; set `BOOKPOD_EXPECTED_...` deliberately, do not just widen the margin |
| `code=vendor_rejected ... 1506/1601` | book 33377 is not visible to the API user | it may be registered under the website account, not the API user `Sipurai`; ask the partner |

Also useful once, same credentials, read-only: tracking of the proof copy:
`curl -H "x-user-id: $BOOKPOD_USER_ID" -H "x-custom-token: $BOOKPOD_API_TOKEN" "$BASE/api/v1/shipments/track?trackingNumber=42079"`
(run it so the token is not typed on the command line; it only finds shipments of the same account).

Balance cannot be read through the API (not in the docs). Check https://dash.bookpod.co.il/dashboard/deposits/ :
auto-deposit must be connected or a balance kept, otherwise API orders do not enter printing.

## 4. How a paid order becomes two PDFs (and what is still missing)

1. Payment is confirmed (Morning), the order moves `awaiting_payment -> paid`, then `submitting`.
2. `api/_lib/orders/printFiles.js` reads finished artwork from the `print-artwork` bucket:
   `<bookId>/page-01.png ... page-24.png`, `<bookId>/front.png`, `<bookId>/back.png` (`.jpg` accepted).
3. `src/utils/printExporter.js` builds: interior pages 226.4 x 226.4 mm (22 x 22 + 2 x 3.2 mm bleed), and the cover as
   **one flat spread** of 448.2 x 226.4 mm (2 x 220 + 1.8 spine + 2 x 3.2), the size that processed correctly for the proof.
   Artwork under 300 dpi is refused (the order is parked with `print_files_error`).
4. The vendor client uploads both PDFs to the partner's signed URLs, creates the (unlisted) book, **asks the price**,
   refuses on a gap, and only then creates the order with `reference_num1 = our order id`.

**Not built, and blocking: the step that produces `print-artwork/...`.** Nothing in the app yet composes the finished
page images (illustration plus Hebrew text, at 300 dpi, 24 pages, front, back) and stores them. The proof copy was
made by a separate pipeline. Until that step exists, every paid order stops at `print_files_missing` with an alert.
Smallest next step: at checkout, in the browser, render each page to a PNG (>= 2362 px for the 200 mm safe area) and
upload to `print-artwork/<bookId>/` with a signed upload URL issued after the ownership check.

### Can PDF generation run in a Vercel function?
Measured on this machine with 24 synthetic 2400 px pages (~5.7 MB PNG each, 137 MB in total), real exporter code:

| | measured |
|---|---|
| time to build both PDFs | about 47 s |
| peak memory (RSS) | about 630 MB |
| interior PDF / cover PDF | 123 MB / 10 MB (the real proof: 154 MB / 10.7 MB) |

Not measured: speed on a Vercel vCPU, which is slower than this PC; assume 2 to 3 times (100 to 150 s). Account-level limits
(maximum duration and memory per plan) were not verified here, so check them on the Vercel project. `vercel.json` now
asks for `maxDuration: 300` for `api/webhooks/morning.js` (where submit runs after payment) and `api/orders/admin-action.js`.
If the plan does not allow 300 s or about 1 GB, use the browser alternative above for the PDFs too and place the
finished files in the `print-ready` bucket (`<bookId>/interior.pdf`, `cover.pdf`); the code uses them as they are.
Nothing is ever fetched from a URL: the earlier `books.print_content_url` / `print_cover_url` columns are ignored on purpose.

**A killed function is handled by the sweeper, not by the function.** If Vercel stops the invocation (timeout or memory)
no code can run, so each claim writes `print_orders.submit_started_at`. The cron `/api/cron/print-orders-watch` (every 10 minutes;
sub-daily crons need a paid Vercel plan, which the previous hourly schedule already required) moves any order left in
`submitting` longer than `PRINT_SUBMITTING_STALE_MINUTES` to `failed_needs_attention` with
`unknown_outcome(stuck_submitting)` and sends the alert, naming the reference to look up at the partner.

## 5. First real order (book 33377, to the owner's address)

Prerequisites: sections 1 to 3 green, deposit balance visible in the partner dashboard.

1. Run the smoke test for `--bookid 33377 --method ship`. Read the printed `partner total`.
2. **Tell the owner the exact total before anything is paid.** Expected 53.66 ILS (24.66 print + 29.00 shipping), which equals the proof order 42079.
3. Only after the owner says yes, run the guarded script. It prices first and refuses unless `--confirm-total` equals the live total to the agora:
   ```bash
   # addr.json = the owner's address: {"fullName","phone","city","street","houseNumber","zip"}
   node scripts/bookpod-first-order.mjs --address-file addr.json    # prints the exact total AND a request fingerprint, orders nothing
   node scripts/bookpod-first-order.mjs --address-file addr.json --confirm-total 53.66 --confirm-request <fingerprint from step 1>   # orders (spends money)
   ```
   The approved total and the fingerprint (hash of the exact request: address, book, quantity, reference) are passed into the order call,
   which re-prices and refuses unless the new price equals the approved one to the agora and the request is byte-for-byte the approved one.
   It uses book 33377 (already registered, so no upload) and the same price gate as production. Its `reference_num1` is `first-live-<date>` (a run across midnight changes the fingerprint and is refused).
4. Check `GET /shipments/track?trackingNumber=<order_no returned>` and the partner dashboard. Compare to the proof copy.
5. Only then a full end-to-end test through our own checkout (79 + 29 ILS in Morning, small real payment to the owner), which
   exercises: Morning notify, PDF generation, upload, price gate, order, status.

## 6. Failure handling (what the owner will see)

| Admin shows `lastError` | Nothing ordered? | Do |
|---|---|---|
| `token_expired: ...` + alert | yes | renew token, update `BOOKPOD_API_TOKEN`, redeploy, press retry on the order. The client stops calling for 10 minutes after a 401 (no retry storm) |
| `auth_failed: ...` | yes | check credentials / API registration |
| `price_mismatch: ...` + alert | yes | compare the price with the dashboard. Retry only after the cause is understood |
| `print_files_missing` | yes | artwork not uploaded (section 4) |
| `print_files_error: ...` | yes | e.g. artwork below 300 dpi |
| `rejected: ...` | yes | the partner refused the request; the text is in the message (codes 1100 to 1512 in the docs) |
| `unknown_outcome(...)` (including `stuck_submitting`) | **maybe not** | the order may exist. The admin screen asks for a confirmation and the API refuses the retry (`reconcile_required`) until a person has looked in the partner dashboard for `reference_num1` = our order id. There is no documented lookup-by-reference API; the partner answering code 1502 on a repeat is the last line of defence, not the plan. At the order call only the documented refusal codes (1100, 1110, 1111, 1200, 1501, 1505 to 1509, 1512 with `success:false`) count as "not created"; every other 4xx, 5xx, timeout or odd body is unknown |
| `alert_submitted_after_sweep` | order exists | the sweeper parked an order that then finished; the partner reference was kept on the order |
| `vendor_created_with_errors` | order exists, in error | fix it in the partner dashboard; it is not retried |

Paid and failed orders have no automatic refund flow yet: a refund is a manual action in Morning.

## 7. Open items (narrow, each quoted from the docs)

- Create Book documents only the request. "Create a book - POST /api/v1/books (JSON) with all metadata": the success
  response is not shown, so the book id is read from `bookid` / `book_id` / `id`; if none exists the order is refused (nothing ordered).
- Create Book step 3 says `contentUrl` is "the link you obtained in the previous interface" while the upload-url response
  lists only signed URLs and file names. The client builds `gs://<bucket>/<file name>` from the signed URL path (the docs' example form).
- Calculate Order Price does not state whether `total` includes VAT. The gate compares with 53.66 for the proof case; a gap refuses the order.
- `shippingDetails.email` is required by the docs. We send `BOOKPOD_CONTACT_EMAIL`. `acceptTerms` is not sent (docs: optional, default false).
- `zipCode` is required for home delivery; the checkout form now requires a 7 digit zip.
- Page counts other than 24 use a derived spine (0.15 mm per sheet) and estimated prices: ordering is blocked for them by `size_not_available`.
