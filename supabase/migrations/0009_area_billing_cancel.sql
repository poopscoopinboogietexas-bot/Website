-- North/south booking, online payments (Stripe) and cancelling. Safe to run more than once.

-- Where the yard is (looked up from the address at sign-up), and payment / cancel state.
alter table public.signups add column if not exists lat double precision;
alter table public.signups add column if not exists lng double precision;
alter table public.signups add column if not exists cancelled_at timestamptz;
alter table public.signups add column if not exists stripe_customer_id text;
alter table public.signups add column if not exists stripe_subscription_id text;
alter table public.signups add column if not exists paid_through date;
alter table public.clients add column if not exists stripe_subscription_id text;
alter table public.clients add column if not exists cancel_requested_at timestamptz;

-- Automatic service day at sign-up (replaces the 0008 version).
-- North of downtown Tyler: Monday first, then Wednesday. South: Wednesday first, then Monday.
-- Address not found: whichever of Monday or Wednesday has room. Then Tuesday, Thursday, Friday.
-- 16 yards a day (one every half hour, 9 to 5). Skips days the customer said don't work.
-- Keep in step with WORK_DAY and SERVICE_AREA in src/lib/business.ts.
create or replace function public.book_signup_day()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  picked smallint;
begin
  -- Only the payment system (with the service key) sets these, never the sign-up form.
  new.assigned_day := null;
  new.cancelled_at := null;
  new.stripe_customer_id := null;
  new.stripe_subscription_id := null;
  new.paid_through := null;
  if new.plan = 'one_time' then
    return new;
  end if;

  select d.day into picked
  from (values
    (1::smallint, 1, 2, 1),
    (3::smallint, 2, 1, 1),
    (2::smallint, 3, 3, 2),
    (4::smallint, 3, 3, 2),
    (5::smallint, 3, 3, 2)
  ) as d(day, north_tier, south_tier, unknown_tier)
  cross join lateral (
    select
      (select count(*) from public.clients c
        where c.service_day = d.day and c.status in ('active', 'payment_issue'))
      + (select count(*) from public.signups s
        where s.assigned_day = d.day and s.handled = false and s.cancelled_at is null) as booked
  ) b
  where not (d.day = any (coalesce(new.blocked_days, '{}'::smallint[])))
    and b.booked < 16
  order by
    case when new.lat is null then d.unknown_tier when new.lat >= 32.3513 then d.north_tier else d.south_tier end,
    b.booked,
    d.day
  limit 1;

  new.assigned_day := picked; -- null when every open day is full; staff picks by hand
  return new;
end;
$$;

drop trigger if exists signups_book_day on public.signups;
create trigger signups_book_day before insert on public.signups
  for each row execute function public.book_signup_day();

-- Customer taps "Cancel my service" (or cancels a sign-up that isn't scheduled yet).
-- Staff see it on the Clients page; billing stops at the end of the paid month.
create or replace function public.cancel_my_service()
returns void
language sql
security definer
set search_path = public
as $$
  update public.clients set cancel_requested_at = coalesce(cancel_requested_at, now())
  where id in (select public.my_client_ids()) and status <> 'cancelled';
  update public.signups set cancelled_at = coalesce(cancelled_at, now())
  where lower(email) = lower(auth.jwt() ->> 'email') and handled = false;
$$;

-- Customer changes their mind.
create or replace function public.keep_my_service()
returns void
language sql
security definer
set search_path = public
as $$
  update public.clients set cancel_requested_at = null
  where id in (select public.my_client_ids()) and status <> 'cancelled';
  update public.signups set cancelled_at = null
  where lower(email) = lower(auth.jwt() ->> 'email') and handled = false;
$$;

revoke execute on function public.cancel_my_service() from public, anon;
revoke execute on function public.keep_my_service() from public, anon;
grant execute on function public.cancel_my_service() to authenticated;
grant execute on function public.keep_my_service() to authenticated;

-- 7-day grace: a payment problem older than 7 days pauses service (puts them on the Call list).
-- The staff app runs this each time Today's jobs opens.
create or replace function public.pause_overdue()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  if not public.is_staff() then
    return 0;
  end if;
  update public.clients set status = 'paused'
  where status = 'payment_issue' and payment_issue_since <= current_date - 7;
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke execute on function public.pause_overdue() from public, anon;
grant execute on function public.pause_overdue() to authenticated;
