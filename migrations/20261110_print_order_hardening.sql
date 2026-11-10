-- Print orders hardening (round 3 review):
--  * submit_started_at: durable "in progress since" for the stuck-order sweeper (a hard function timeout cannot run a handler)
--  * print_vendor_state: shared circuit-breaker state for partner authentication failures (all serverless instances read it)
-- Idempotent. Service role only (RLS on, no policies).

ALTER TABLE public.print_orders ADD COLUMN IF NOT EXISTS submit_started_at timestamptz;
CREATE INDEX IF NOT EXISTS print_orders_submitting_idx ON public.print_orders (status, submit_started_at);

CREATE TABLE IF NOT EXISTS public.print_vendor_state (
  key        text PRIMARY KEY,
  value      text,
  until      timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.print_vendor_state ENABLE ROW LEVEL SECURITY;
