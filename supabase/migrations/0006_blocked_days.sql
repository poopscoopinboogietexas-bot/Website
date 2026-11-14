-- Days that don't work for a customer (0 = Sunday ... 6 = Saturday), asked at sign-up.
-- The business picks the service day by area and avoids these. Safe to run more than once.
alter table public.signups add column if not exists blocked_days smallint[] not null default '{}';
alter table public.clients add column if not exists blocked_days smallint[] not null default '{}';
