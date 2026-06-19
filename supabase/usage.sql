-- Per-user lifetime spend tracking for Founders Room guardrails.
-- Run this once in the Supabase SQL editor (Project -> SQL -> New query).
--
-- The backend (service_role key) reads spent vs. budget before a session and
-- atomically adds the session's real cost after. Every non-owner user is capped
-- at budget_usd (default $2) FOREVER; raise an individual cap by bumping their
-- budget_usd row. The owner email is exempt in code (OWNER_EMAIL).

create table if not exists public.user_usage (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  email      text,
  spent_usd  double precision not null default 0,
  budget_usd double precision not null default 2,
  updated_at timestamptz not null default now()
);

alter table public.user_usage enable row level security;

-- Users may read their own usage (e.g. to show "$0.40 of $2 used" in the UI).
-- Writes happen only via the service_role key, which bypasses RLS.
drop policy if exists "read own usage" on public.user_usage;
create policy "read own usage" on public.user_usage
  for select using (auth.uid() = user_id);

-- Atomic upsert-and-increment. SECURITY DEFINER so it runs with table-owner
-- rights; the backend calls it through /rest/v1/rpc/add_usage.
create or replace function public.add_usage(
  p_user uuid,
  p_email text,
  p_amount double precision
)
returns double precision
language plpgsql
security definer
set search_path = public
as $$
declare
  new_total double precision;
begin
  insert into public.user_usage (user_id, email, spent_usd)
  values (p_user, p_email, p_amount)
  on conflict (user_id) do update
    set spent_usd  = public.user_usage.spent_usd + excluded.spent_usd,
        email      = coalesce(excluded.email, public.user_usage.email),
        updated_at = now()
  returning spent_usd into new_total;
  return new_total;
end;
$$;
