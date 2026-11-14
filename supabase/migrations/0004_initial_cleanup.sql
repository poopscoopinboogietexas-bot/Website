-- One-time initial cleanup fee for yards that haven't been cleaned in a while.
-- Safe to run more than once.
alter table public.signups add column if not exists last_cleaned text not null default ''
  check (last_cleaned in ('', 'under_1_week', '1_2_weeks', '2_4_weeks', 'over_month'));
alter table public.signups add column if not exists initial_fee_cents integer not null default 0
  check (initial_fee_cents between 0 and 100000);

-- On the client: the fee still owed, added to their first bill only.
alter table public.clients add column if not exists initial_fee_cents integer not null default 0
  check (initial_fee_cents >= 0);
alter table public.clients add column if not exists initial_fee_paid boolean not null default false;
