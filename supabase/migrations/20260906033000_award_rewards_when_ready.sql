create or replace function public.award_loyalty_when_order_collected()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  settings public.loyalty_settings%rowtype;
  balance public.customer_loyalty%rowtype;
  phone_digits text;
  member_key text;
  earned numeric := 0;
  goal numeric := 1;
  new_balance numeric := 0;
  completed_rewards integer := 0;
begin
  if lower(coalesce(new.order_status, '')) <> 'ready'
     or lower(coalesce(old.order_status, '')) = 'ready'
     or new.loyalty_reward_awarded_at is not null then
    return new;
  end if;

  select * into settings from public.loyalty_settings where id = 1;
  if not found or coalesce(settings.enabled, false) = false then return new; end if;

  phone_digits := regexp_replace(coalesce(new.customer_phone, ''), '[^0-9]', '', 'g');
  if length(phone_digits) = 10 and left(phone_digits, 2) = '65' then phone_digits := right(phone_digits, 8); end if;
  member_key := coalesce(nullif(phone_digits, ''), nullif(btrim(coalesce(new.instagram, '')), ''), nullif(btrim(coalesce(new.customer_name, '')), ''));
  if member_key is null then return new; end if;

  if coalesce(settings.reward_type, 'stamps') = 'points' then
    earned := greatest(0, floor(coalesce(new.total, 0) * greatest(coalesce(settings.points_per_dollar, 1), 0)));
    goal := greatest(coalesce(settings.points_required, 50), 1);
  else
    earned := case when coalesce(new.total, 0) >= greatest(coalesce(settings.minimum_spend, 0), 0) then 1 else 0 end;
    goal := greatest(coalesce(settings.stamps_required, 10), 1);
  end if;

  new.loyalty_reward_awarded_at := now();
  new.loyalty_reward_amount := earned;
  if earned <= 0 then return new; end if;

  insert into public.customer_loyalty (customer_key, stamps, points, rewards_available)
  values (member_key, 0, 0, 0)
  on conflict (customer_key) do nothing;

  select * into balance from public.customer_loyalty where customer_key = member_key for update;
  if coalesce(settings.reward_type, 'stamps') = 'points' then
    new_balance := greatest(coalesce(balance.points, 0), 0) + earned;
    completed_rewards := floor(new_balance / goal);
    update public.customer_loyalty
    set points = mod(new_balance, goal), rewards_available = greatest(coalesce(rewards_available, 0), 0) + completed_rewards
    where customer_key = member_key;
    new_balance := mod(new_balance, goal);
  else
    new_balance := greatest(coalesce(balance.stamps, 0), 0) + earned;
    completed_rewards := floor(new_balance / goal);
    update public.customer_loyalty
    set stamps = mod(new_balance, goal), rewards_available = greatest(coalesce(rewards_available, 0), 0) + completed_rewards
    where customer_key = member_key;
    new_balance := mod(new_balance, goal);
  end if;

  insert into public.loyalty_transactions (order_id, order_number, customer_key, reward_type, amount, balance_after, created_at)
  values (new.id::text, coalesce(new.order_number, new.id::text), member_key,
    case when coalesce(settings.reward_type, 'stamps') = 'points' then 'points' else 'stamps' end,
    earned, new_balance, now())
  on conflict (order_id) do nothing;
  return new;
end;
$$;

revoke all on function public.award_loyalty_when_order_collected() from public;

drop trigger if exists award_loyalty_on_collected on public.orders;
drop trigger if exists award_loyalty_on_ready on public.orders;
create trigger award_loyalty_on_ready
before update of order_status on public.orders
for each row
execute function public.award_loyalty_when_order_collected();
