-- DATABASE UPDATES TO RUN
-- Everything here is safe to run more than once. Paste this whole file into
-- Supabase > SQL Editor and click Run, once, when you're done setting up.
-- Included (in order): 0003_texts.sql, 0004_initial_cleanup.sql, 0005_bag_backup.sql, 0006_blocked_days.sql, 0007_signup_self_read.sql, 0008_auto_day.sql, 0009_area_billing_cancel.sql, 0010_my_dogs.sql

-- Text message preferences per client (reminder the day before, "service done" after).
-- Paste into Supabase > SQL Editor and click Run. Safe to run more than once.
alter table public.clients add column if not exists reminder_texts boolean not null default true;
alter table public.clients add column if not exists done_texts boolean not null default true;

-- Customers turn their own texts on or off from their account page.
create or replace function public.update_my_texts(p_reminder_texts boolean, p_done_texts boolean)
returns void
language sql
security definer
set search_path = public
as $$
  update public.clients
  set reminder_texts = coalesce(p_reminder_texts, reminder_texts),
      done_texts = coalesce(p_done_texts, done_texts)
  where id in (select public.my_client_ids());
$$;
revoke all on function public.update_my_texts(boolean, boolean) from public, anon;
grant execute on function public.update_my_texts(boolean, boolean) to authenticated;


-- ===== 0004_initial_cleanup.sql =====
-- One-time initial cleanup fee for yards that haven't been cleaned in a while.
-- Safe to run more than once.
alter table public.signups add column if not exists last_cleaned text not null default ''
  check (last_cleaned in ('', 'under_2_weeks', '2_4_weeks', '1_2_months', 'over_2_months'));
alter table public.signups add column if not exists initial_fee_cents integer not null default 0
  check (initial_fee_cents between 0 and 100000);

-- On the client: the fee still owed, added to their first bill only.
alter table public.clients add column if not exists initial_fee_cents integer not null default 0
  check (initial_fee_cents >= 0);
alter table public.clients add column if not exists initial_fee_paid boolean not null default false;


-- ===== 0005_bag_backup.sql =====
-- Where to leave the bagged poop if the trash bin can't be reached (asked at sign-up).
-- Safe to run more than once.
alter table public.signups add column if not exists bag_backup text not null default ''
  check (length(bag_backup) <= 200);
alter table public.clients add column if not exists bag_backup text not null default '';


-- ===== 0006_blocked_days.sql =====
-- Days that don't work for a customer (0 = Sunday ... 6 = Saturday), asked at sign-up.
-- The business picks the service day by area and avoids these. Safe to run more than once.
alter table public.signups add column if not exists blocked_days smallint[] not null default '{}';
alter table public.clients add column if not exists blocked_days smallint[] not null default '{}';


-- ===== 0007_signup_self_read.sql =====
-- Let a logged-in customer see their own sign-up (matched by email), so their account page
-- shows their plan and details before they're on the schedule. Safe to run more than once.
drop policy if exists signups_own_read on public.signups;
create policy signups_own_read on public.signups for select to authenticated
  using (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));

-- ===== 0008_auto_day.sql =====
-- Automatic service day at sign-up. Safe to run more than once.
-- Monday and Wednesday fill first, then Tuesday, Thursday and Friday.
-- One yard every half hour from 9 to 5 = 16 yards a day.
-- Skips days the customer said don't work. Keep in step with WORK_DAY in src/lib/business.ts.
alter table public.signups add column if not exists assigned_day smallint
  check (assigned_day is null or assigned_day between 0 and 6);

create or replace function public.book_signup_day()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  picked smallint;
begin
  new.assigned_day := null;
  if new.plan = 'one_time' then
    return new;
  end if;

  select d.day into picked
  from (values (1::smallint, 1), (3::smallint, 1), (2::smallint, 2), (4::smallint, 2), (5::smallint, 2)) as d(day, tier)
  cross join lateral (
    select
      (select count(*) from public.clients c
        where c.service_day = d.day and c.status in ('active', 'payment_issue'))
      + (select count(*) from public.signups s
        where s.assigned_day = d.day and s.handled = false) as booked
  ) b
  where not (d.day = any (coalesce(new.blocked_days, '{}'::smallint[])))
    and b.booked < 16
  order by d.tier, b.booked, d.day
  limit 1;

  new.assigned_day := picked; -- null when every open day is full; staff picks by hand
  return new;
end;
$$;

drop trigger if exists signups_book_day on public.signups;
create trigger signups_book_day before insert on public.signups
  for each row execute function public.book_signup_day();

-- The sign-up page asks which day was booked, right after saving.
-- Only recent sign-ups, and only by their id (which the page made itself).
create or replace function public.signup_day(p_id uuid)
returns smallint
language sql
security definer
set search_path = public
stable
as $$
  select assigned_day from public.signups
  where id = p_id and created_at > now() - interval '1 hour';
$$;

grant execute on function public.signup_day(uuid) to anon, authenticated;

-- ===== 0009_area_billing_cancel.sql =====
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

-- ===== 0010_my_dogs.sql =====
-- Customers add and remove their own dogs from their account page. Safe to run more than once.
-- Each change leaves a note on the client so staff see it (new dog's temperament, etc.).

create or replace function public.add_my_dog(p_name text, p_breed text, p_temperament text, p_notes text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  cid uuid;
  new_id uuid;
begin
  select id into cid from public.my_client_ids() as m(id) limit 1;
  if cid is null then
    raise exception 'no client record';
  end if;
  if length(trim(coalesce(p_name, ''))) not between 1 and 60 then
    raise exception 'name required';
  end if;
  insert into public.dogs (client_id, name, breed, temperament, notes)
  values (
    cid,
    trim(p_name),
    left(trim(coalesce(p_breed, '')), 80),
    case when p_temperament in ('friendly', 'shy', 'jumpy', 'keep_out') then p_temperament else 'friendly' end,
    left(trim(coalesce(p_notes, '')), 500)
  )
  returning id into new_id;
  insert into public.client_notes (client_id, body, created_by)
  values (cid, 'Added a dog on the website: ' || trim(p_name)
    || case when length(trim(coalesce(p_breed, ''))) > 0 then ' (' || trim(p_breed) || ')' else '' end
    || case when length(trim(coalesce(p_notes, ''))) > 0 then '. Notes: ' || left(trim(p_notes), 500) else '' end, null);
  return new_id;
end;
$$;

create or replace function public.remove_my_dog(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  d record;
begin
  delete from public.dogs
  where id = p_id and client_id in (select public.my_client_ids())
  returning client_id, name into d;
  if d.client_id is not null then
    insert into public.client_notes (client_id, body, created_by)
    values (d.client_id, 'Removed a dog on the website: ' || d.name, null);
  end if;
end;
$$;

revoke execute on function public.add_my_dog(text, text, text, text) from public, anon;
revoke execute on function public.remove_my_dog(uuid) from public, anon;
grant execute on function public.add_my_dog(text, text, text, text) to authenticated;
grant execute on function public.remove_my_dog(uuid) to authenticated;
