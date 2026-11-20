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
