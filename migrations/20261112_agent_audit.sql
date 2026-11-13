-- סוכן agent audit trail for Sipurai. NOT APPLIED to any database by this PR.
-- Apply manually in the go-live phase, before enabling SIPURAI_AGENT_KEY_SHA256.
-- Service role only (RLS on, no policies). Rollback: migrations/rollbacks/20261112_agent_audit.rollback.sql
CREATE TABLE IF NOT EXISTS public.agent_audit (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor        text NOT NULL,             -- 'סוכן'
  action       text NOT NULL,             -- e.g. orders.cancel
  guard_class  text NOT NULL CHECK (guard_class IN ('money','send','delete','access')),
  target       text,                      -- order id
  confirm_text text NOT NULL,             -- the human instruction from X-Agent-Confirm
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS agent_audit_created_idx ON public.agent_audit (created_at DESC);
ALTER TABLE public.agent_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.agent_audit FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.agent_audit TO service_role;
