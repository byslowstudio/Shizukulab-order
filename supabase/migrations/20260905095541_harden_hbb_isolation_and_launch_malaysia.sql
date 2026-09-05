-- Restrict private Shizuku Lab operations to the Shizuku admin allow-list.
-- Public storefront SELECT policies remain intentionally public because the
-- customer ordering page needs products, options, availability and branding.

drop policy if exists "admin inspiration access" on public.inspiration_ideas;
create policy "admin inspiration access" on public.inspiration_ideas
for all to authenticated
using ((select public.is_shizuku_admin()))
with check ((select public.is_shizuku_admin()));

drop policy if exists "admin inventory access" on public.inventory_items;
create policy "admin inventory access" on public.inventory_items
for all to authenticated
using ((select public.is_shizuku_admin()))
with check ((select public.is_shizuku_admin()));

drop policy if exists "admin movement access" on public.inventory_movements;
create policy "admin movement access" on public.inventory_movements
for select to authenticated
using ((select public.is_shizuku_admin()));

drop policy if exists "admin margin guide access" on public.margin_guide_settings;
create policy "admin margin guide access" on public.margin_guide_settings
for all to authenticated
using ((select public.is_shizuku_admin()))
with check ((select public.is_shizuku_admin()));

drop policy if exists "Authenticated users manage product option mappings" on public.product_option_groups;
create policy "Shizuku admins manage product option mappings" on public.product_option_groups
for all to authenticated
using ((select public.is_shizuku_admin()))
with check ((select public.is_shizuku_admin()));

drop policy if exists "admin recipe access" on public.product_recipes;
create policy "admin recipe access" on public.product_recipes
for all to authenticated
using ((select public.is_shizuku_admin()))
with check ((select public.is_shizuku_admin()));

drop policy if exists "admin suppliers access" on public.suppliers;
create policy "admin suppliers access" on public.suppliers
for all to authenticated
using ((select public.is_shizuku_admin()))
with check ((select public.is_shizuku_admin()));

drop policy if exists "admin wholesale access" on public.wholesale_products;
create policy "admin wholesale access" on public.wholesale_products
for all to authenticated
using ((select public.is_shizuku_admin()))
with check ((select public.is_shizuku_admin()));

revoke all on function public.is_shizuku_admin() from public;
revoke all on function public.is_shizuku_admin() from anon;
grant execute on function public.is_shizuku_admin() to authenticated;

-- Trigger functions must never be callable as public RPC endpoints. Revoking
-- EXECUTE does not stop PostgreSQL triggers from running them internally.
do $$
declare fn record;
begin
  for fn in
    select n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prorettype = 'trigger'::regtype
  loop
    execute format('revoke execute on function %I.%I(%s) from public', fn.nspname, fn.proname, fn.args);
    execute format('revoke execute on function %I.%I(%s) from anon', fn.nspname, fn.proname, fn.args);
    execute format('revoke execute on function %I.%I(%s) from authenticated', fn.nspname, fn.proname, fn.args);
  end loop;
end
$$;

-- Launch the already-configured Malaysia storefront. Singapore remains live
-- and its SGD, PayNow, inventory and costing records are not changed.
update public.store_settings
set malaysia_enabled = true,
    malaysia_website_visibility = 'live',
    updated_at = now()
where id = 1;
