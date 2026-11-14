-- Where to leave the bagged poop if the trash bin can't be reached (asked at sign-up).
-- Safe to run more than once.
alter table public.signups add column if not exists bag_backup text not null default ''
  check (length(bag_backup) <= 200);
alter table public.clients add column if not exists bag_backup text not null default '';
