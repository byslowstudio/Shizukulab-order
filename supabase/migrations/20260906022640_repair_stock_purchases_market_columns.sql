set local lock_timeout = '5s';

-- stock_purchases predates the Slow Studio market-aware purchasing flow.
-- CREATE TABLE IF NOT EXISTS did not add the newer columns to that legacy table,
-- so retrofit them without replacing or deleting any existing purchase history.
alter table public.stock_purchases
  add column if not exists market_code text,
  add column if not exists supplier text,
  add column if not exists purchased_at timestamptz;

update public.stock_purchases purchases
set market_code = upper(coalesce(items.market_code, 'SG'))
from public.inventory_items items
where purchases.inventory_item_id = items.id
  and purchases.market_code is null;

update public.stock_purchases
set market_code = 'SG'
where market_code is null or upper(trim(market_code)) not in ('SG', 'MY');

update public.stock_purchases
set purchased_at = coalesce(created_at, purchase_date::timestamptz, now())
where purchased_at is null;

alter table public.stock_purchases
  alter column market_code set default 'SG',
  alter column market_code set not null,
  alter column purchased_at set default now(),
  alter column purchased_at set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.stock_purchases'::regclass
      and conname = 'stock_purchases_market_code_check'
  ) then
    alter table public.stock_purchases
      add constraint stock_purchases_market_code_check
      check (market_code in ('SG', 'MY'));
  end if;
end
$$;

create index if not exists stock_purchases_market_purchased_at_idx
  on public.stock_purchases (market_code, purchased_at desc);

create or replace function public.record_shizuku_stock_purchase(
  p_inventory_item_id uuid,
  p_market_code text,
  p_quantity numeric,
  p_total_cost numeric,
  p_supplier text default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_market text := upper(trim(coalesce(p_market_code, 'SG')));
  v_item_name text;
  v_unit text;
begin
  if not public.is_shizuku_admin() then
    raise exception 'Not authorised';
  end if;

  if v_market not in ('SG', 'MY') or p_quantity <= 0 or p_total_cost < 0 then
    raise exception 'Invalid stock purchase';
  end if;

  select name, unit
  into v_item_name, v_unit
  from public.inventory_items
  where id = p_inventory_item_id
    and upper(coalesce(market_code, 'SG')) = v_market;

  if not found then
    raise exception 'Inventory item does not belong to this market';
  end if;

  insert into public.stock_purchases (
    market_code,
    inventory_item_id,
    item_name,
    unit,
    quantity,
    total_cost,
    supplier,
    notes,
    purchased_at
  ) values (
    v_market,
    p_inventory_item_id,
    v_item_name,
    coalesce(nullif(trim(v_unit), ''), 'unit'),
    p_quantity,
    p_total_cost,
    p_supplier,
    p_notes,
    now()
  )
  returning id into v_id;

  update public.inventory_items
  set stock_quantity = stock_quantity + p_quantity,
      updated_at = now()
  where id = p_inventory_item_id;

  insert into public.inventory_movements (
    inventory_item_id,
    quantity_change,
    reason
  ) values (
    p_inventory_item_id,
    p_quantity,
    'stock_purchase'
  );

  insert into public.cash_flow_entries (
    market_code,
    entry_type,
    category,
    amount,
    reference_type,
    reference_id,
    notes
  ) values (
    v_market,
    'expense',
    'stock_purchase',
    p_total_cost,
    'stock_purchase',
    v_id,
    p_notes
  );

  return v_id;
end
$$;

revoke all on function public.record_shizuku_stock_purchase(uuid, text, numeric, numeric, text, text)
  from public, anon;
grant execute on function public.record_shizuku_stock_purchase(uuid, text, numeric, numeric, text, text)
  to authenticated, service_role;
