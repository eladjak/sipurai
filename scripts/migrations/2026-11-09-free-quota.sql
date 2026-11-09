-- Server-side free-tier quota ("5 free books a month") + global daily safety cap.
-- ADDITIVE ONLY: three new tables, three functions. Touches no existing table.
-- Rollback: drop function sipurai_reserve_book, sipurai_use_call, sipurai_quota_status;
--           drop table book_quota_reservations, generation_daily, generation_loose_daily;
-- Only the service role (the Vercel API) may read or write these. RLS is on with
-- no policies, and EXECUTE is revoked from anon/authenticated.

create table if not exists book_quota_reservations (
  id          bigserial primary key,
  user_id     text    not null,               -- Clerk sub
  book_key    text    not null,               -- client-generated attempt id, or the books.id on resume
  month_key   text    not null,               -- 'YYYY-MM', Asia/Jerusalem
  paid        boolean not null default false,
  calls       integer not null default 0,     -- AI calls spent on this book
  created_at  timestamptz not null default now(),
  constraint book_quota_unique_book unique (user_id, book_key)
);
create index if not exists book_quota_user_month on book_quota_reservations (user_id, month_key);

create table if not exists generation_daily (
  day     date primary key,                    -- Asia/Jerusalem day
  books   integer not null default 0,
  alerted boolean not null default false
);

create table if not exists generation_loose_daily (
  user_id text not null,
  day     date not null,
  calls   integer not null default 0,
  primary key (user_id, day)
);

alter table book_quota_reservations enable row level security;
alter table generation_daily        enable row level security;
alter table generation_loose_daily  enable row level security;
revoke all on book_quota_reservations, generation_daily, generation_loose_daily from anon, authenticated;
revoke all on sequence book_quota_reservations_id_seq from anon, authenticated;

-- A paid user = an active, non-free subscription on the email their Clerk profile carries.
create or replace function sipurai_is_paid(p_user text) returns boolean
language sql stable as $$
  select exists (
    select 1 from profiles p join subscriptions s on lower(s.user_email) = lower(p.email)
    where p.clerk_id = p_user and s.status = 'active' and s.plan is not null and s.plan <> 'free'
  );
$$;

-- Atomic: one advisory lock per user serialises that user's reservations, so parallel
-- requests cannot both pass the count. The global counter is a single guarded UPDATE.
create or replace function sipurai_reserve_book(
  p_user text, p_book text, p_month text, p_day date, p_limit integer, p_daily_cap integer
) returns jsonb
language plpgsql as $$
declare
  v_paid boolean; v_used integer; v_books integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('sipurai_quota:' || p_user, 0));

  select count(*) into v_used from book_quota_reservations where user_id = p_user and month_key = p_month;

  if exists (select 1 from book_quota_reservations where user_id = p_user and book_key = p_book) then
    return jsonb_build_object('status', 'already', 'used', v_used);
  end if;

  v_paid := sipurai_is_paid(p_user);
  if not v_paid and v_used >= p_limit then
    return jsonb_build_object('status', 'monthly_limit', 'used', v_used);
  end if;

  insert into generation_daily (day, books) values (p_day, 0) on conflict (day) do nothing;
  update generation_daily set books = books + 1 where day = p_day and books < p_daily_cap returning books into v_books;
  if not found then
    return jsonb_build_object('status', 'daily_cap', 'used', v_used);
  end if;

  insert into book_quota_reservations (user_id, book_key, month_key, paid) values (p_user, p_book, p_month, v_paid);
  return jsonb_build_object('status', 'ok', 'used', v_used + 1, 'paid', v_paid, 'daily_books', v_books);
end $$;

-- One AI call. With a reserved book: counts against that book's ceiling.
-- Without one: counts against a small per-user daily allowance (ideas, avatars...).
-- Paid users skip the per-user allowance but the per-book ceiling still protects cost.
create or replace function sipurai_use_call(
  p_user text, p_book text, p_day date, p_book_max integer, p_loose_max integer
) returns jsonb
language plpgsql as $$
declare v_calls integer; v_paid boolean;
begin
  if p_book is not null and p_book <> '' then
    update book_quota_reservations set calls = calls + 1
      where user_id = p_user and book_key = p_book and calls < p_book_max returning calls into v_calls;
    if found then return jsonb_build_object('status', 'ok', 'calls', v_calls); end if;
    if exists (select 1 from book_quota_reservations where user_id = p_user and book_key = p_book) then
      return jsonb_build_object('status', 'book_call_cap');
    end if;
  end if;
  if sipurai_is_paid(p_user) then return jsonb_build_object('status', 'ok', 'loose', true); end if;
  insert into generation_loose_daily (user_id, day, calls) values (p_user, p_day, 0) on conflict do nothing;
  update generation_loose_daily set calls = calls + 1
    where user_id = p_user and day = p_day and calls < p_loose_max returning calls into v_calls;
  if not found then return jsonb_build_object('status', 'loose_cap'); end if;
  return jsonb_build_object('status', 'ok', 'calls', v_calls, 'loose', true);
end $$;

-- Read-only view of the user's month, for the UI.
create or replace function sipurai_quota_status(p_user text, p_month text) returns jsonb
language sql stable as $$
  select jsonb_build_object(
    'used', (select count(*) from book_quota_reservations where user_id = p_user and month_key = p_month),
    'paid', sipurai_is_paid(p_user));
$$;

revoke execute on function sipurai_is_paid(text), sipurai_reserve_book(text,text,text,date,integer,integer),
  sipurai_use_call(text,text,date,integer,integer), sipurai_quota_status(text,text) from public, anon, authenticated;
grant execute on function sipurai_is_paid(text), sipurai_reserve_book(text,text,text,date,integer,integer),
  sipurai_use_call(text,text,date,integer,integer), sipurai_quota_status(text,text) to service_role;
