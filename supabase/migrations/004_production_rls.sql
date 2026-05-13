grant select on table public.app_state to anon, authenticated;
revoke insert, update, delete on table public.app_state from anon, authenticated;

drop policy if exists "Public can read app state" on public.app_state;
drop policy if exists "Public can write app state" on public.app_state;
drop policy if exists "Anyone can select main app state" on public.app_state;
drop policy if exists "Anyone can insert main app state" on public.app_state;
drop policy if exists "Anyone can update main app state" on public.app_state;

create policy "Public can read app state"
on public.app_state
for select
to anon, authenticated
using (id = 'main');
