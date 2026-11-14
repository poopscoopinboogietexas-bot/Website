-- DATABASE UPDATES TO RUN
-- Everything here is safe to run more than once. Paste this whole file into
-- Supabase > SQL Editor and click Run, once, when you're done setting up.
-- Included (in order): 0003_texts.sql

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
