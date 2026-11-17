-- Let a logged-in customer see their own sign-up (matched by email), so their account page
-- shows their plan and details before they're on the schedule. Safe to run more than once.
drop policy if exists signups_own_read on public.signups;
create policy signups_own_read on public.signups for select to authenticated
  using (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));
