-- Printed-book orders (closed checkout). NOT APPLIED to any database by the build.
-- Apply manually, after review, before turning PRINT_ORDER_ENABLED on.
-- Writes happen only through the Supabase service role (it bypasses RLS);
-- authenticated users may only SELECT their own rows.

CREATE TABLE IF NOT EXISTS public.print_orders (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                text NOT NULL,                       -- Clerk sub
  book_id                text NOT NULL,
  preset_id              text NOT NULL,
  page_count             integer NOT NULL CHECK (page_count > 0),
  qty                    integer NOT NULL CHECK (qty > 0),
  method                 text NOT NULL CHECK (method IN ('ship', 'pickup')),
  address                jsonb,
  quote                  jsonb NOT NULL,                      -- price snapshot incl. priceVersion
  total_agorot           integer NOT NULL CHECK (total_agorot >= 0),
  currency               text NOT NULL DEFAULT 'ILS',
  status                 text NOT NULL DEFAULT 'awaiting_payment' CHECK (status IN (
    'awaiting_payment', 'paid', 'submitting', 'submitted', 'in_production',
    'shipped', 'ready_for_pickup', 'cancelled', 'failed_needs_attention')),
  idempotency_key        text NOT NULL,
  payment_provider       text,
  payment_ref            text,
  checkout_url           text,
  paid_at                timestamptz,
  vendor_ref             text,
  vendor_submit_attempts integer NOT NULL DEFAULT 0,
  vendor_last_error      text,
  tracking_url           text,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  -- same key from the same user can never create a second order
  CONSTRAINT print_orders_idem_unique UNIQUE (user_id, idempotency_key),
  -- one payment can settle one order only (blocks double processing)
  CONSTRAINT print_orders_payment_ref_unique UNIQUE (payment_ref)
);

CREATE INDEX IF NOT EXISTS print_orders_user_idx   ON public.print_orders (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS print_orders_status_idx ON public.print_orders (status, paid_at);

-- Append-only log. The service role only ever INSERTs.
CREATE TABLE IF NOT EXISTS public.print_order_events (
  id         bigserial PRIMARY KEY,
  order_id   uuid NOT NULL REFERENCES public.print_orders (id),
  type       text NOT NULL,
  data       jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS print_order_events_order_idx ON public.print_order_events (order_id, created_at);

CREATE OR REPLACE FUNCTION public.print_order_events_append_only() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'print_order_events is append-only';
END $$;
DROP TRIGGER IF EXISTS print_order_events_no_update ON public.print_order_events;
CREATE TRIGGER print_order_events_no_update BEFORE UPDATE OR DELETE ON public.print_order_events
  FOR EACH ROW EXECUTE FUNCTION public.print_order_events_append_only();

-- RLS (same style as scripts/migrations/2026-05-25-rls-lockdown.sql:
-- ownership keyed on the Clerk sub = auth.jwt()->>'sub', via current_clerk_id()).
ALTER TABLE public.print_orders       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.print_order_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "print_orders_owner_select" ON public.print_orders;
CREATE POLICY "print_orders_owner_select" ON public.print_orders
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.jwt() ->> 'sub'));

-- Events are internal (they can hold vendor diagnostics): no policy for any
-- client role, so only the service role can read or write them.

REVOKE ALL ON public.print_orders       FROM anon, authenticated;
REVOKE ALL ON public.print_order_events FROM anon, authenticated;
-- Column-level grant: vendor diagnostics (vendor_ref, vendor_last_error, attempts) stay server-only.
GRANT SELECT (id, user_id, book_id, preset_id, page_count, qty, method, address, quote,
  total_agorot, currency, status, payment_provider, paid_at, tracking_url, created_at, updated_at)
  ON public.print_orders TO authenticated;
-- No INSERT/UPDATE/DELETE grants for clients: writes go through api/orders/* (service role).
