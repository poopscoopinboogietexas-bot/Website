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
