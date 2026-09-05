create extension if not exists pgcrypto;

alter table public.orders
  add column if not exists email_unsubscribe_token uuid not null default gen_random_uuid(),
  add column if not exists email_notifications_opted_out boolean not null default false,
  add column if not exists email_unsubscribed_at timestamptz;

alter table public.marketing_contacts
  add column if not exists email_unsubscribe_token uuid not null default gen_random_uuid(),
  add column if not exists email_notifications_opted_out boolean not null default false,
  add column if not exists email_unsubscribed_at timestamptz;

create unique index if not exists orders_email_unsubscribe_token_idx on public.orders(email_unsubscribe_token);
create unique index if not exists marketing_contacts_email_unsubscribe_token_idx on public.marketing_contacts(email_unsubscribe_token);

create or replace function public.inherit_shizuku_email_opt_out()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if nullif(lower(trim(coalesce(new.customer_email,''))),'') is null then return new; end if;
  if exists(select 1 from public.marketing_contacts m where lower(trim(coalesce(m.customer_email,'')))=lower(trim(new.customer_email)) and m.email_notifications_opted_out)
     or exists(select 1 from public.orders o where o.id is distinct from new.id and lower(trim(coalesce(o.customer_email,'')))=lower(trim(new.customer_email)) and o.email_notifications_opted_out)
  then new.email_notifications_opted_out:=true; new.email_unsubscribed_at:=coalesce(new.email_unsubscribed_at,now()); end if;
  return new;
end $$;
revoke all on function public.inherit_shizuku_email_opt_out() from public,anon,authenticated;
drop trigger if exists inherit_shizuku_email_opt_out on public.orders;
create trigger inherit_shizuku_email_opt_out before insert or update of customer_email on public.orders for each row execute function public.inherit_shizuku_email_opt_out();

create or replace function public.unsubscribe_shizuku_email(p_token uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_email text; v_name text; v_market text; v_webhook text;
begin
  select customer_email,customer_name,market_code into v_email,v_name,v_market from public.marketing_contacts where email_unsubscribe_token=p_token limit 1;
  if not found then select customer_email,customer_name,coalesce(market_code,'SG') into v_email,v_name,v_market from public.orders where email_unsubscribe_token=p_token limit 1; end if;
  if nullif(trim(coalesce(v_email,'')),'') is null then return jsonb_build_object('ok',false); end if;
  update public.marketing_contacts set marketing_email_opt_in=false,email_notifications_opted_out=true,email_unsubscribed_at=now(),updated_at=now() where lower(trim(customer_email))=lower(trim(v_email));
  update public.orders set marketing_email_opt_in=false,email_notifications_opted_out=true,email_unsubscribed_at=now() where lower(trim(customer_email))=lower(trim(v_email));
  select webhook_url into v_webhook from public.notification_settings where id=1;
  if nullif(trim(coalesce(v_webhook,'')),'') is not null then
    perform net.http_post(url:=v_webhook,headers:=jsonb_build_object('Content-Type','application/json'),body:=jsonb_build_object('event','email_unsubscribed','send_owner',true,'send_customer',false,'customer_name',v_name,'customer_email',v_email,'market_code',coalesce(v_market,'SG')));
  end if;
  return jsonb_build_object('ok',true);
end $$;
revoke all on function public.unsubscribe_shizuku_email(uuid) from public;
grant execute on function public.unsubscribe_shizuku_email(uuid) to anon,authenticated,service_role;

alter table public.store_settings
  add column if not exists membership_enabled boolean not null default false,
  add column if not exists membership_name text not null default 'Shizuku Club',
  add column if not exists membership_description text not null default 'Rewards and member updates, crafted for returning customers.',
  add column if not exists admin_theme_primary text not null default '#4B5D3A',
  add column if not exists admin_theme_background text not null default '#F3EEE3',
  add column if not exists admin_theme_card text not null default '#FFFFFF',
  add column if not exists admin_theme_text text not null default '#2A2A22';

alter table public.slow_studio_workspaces
  add column if not exists logo_url text,
  add column if not exists logo_visible boolean not null default true;

create table if not exists public.stock_purchases(
  id uuid primary key default gen_random_uuid(),
  market_code text not null check(market_code in('SG','MY')),
  inventory_item_id uuid not null references public.inventory_items(id) on delete restrict,
  quantity numeric not null check(quantity>0),
  total_cost numeric not null check(total_cost>=0),
  supplier text,
  notes text,
  purchased_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create table if not exists public.cash_flow_entries(
  id uuid primary key default gen_random_uuid(),
  market_code text not null check(market_code in('SG','MY')),
  entry_type text not null check(entry_type in('income','expense')),
  category text not null,
  amount numeric not null check(amount>=0),
  reference_type text,
  reference_id uuid,
  notes text,
  occurred_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
alter table public.stock_purchases enable row level security;
alter table public.cash_flow_entries enable row level security;
drop policy if exists "admin stock purchases access" on public.stock_purchases;
drop policy if exists stock_purchases_admin_all on public.stock_purchases;
create policy stock_purchases_admin_all on public.stock_purchases for all to authenticated using((select public.is_shizuku_admin())) with check((select public.is_shizuku_admin()));
drop policy if exists cash_flow_admin_all on public.cash_flow_entries;
create policy cash_flow_admin_all on public.cash_flow_entries for all to authenticated using((select public.is_shizuku_admin())) with check((select public.is_shizuku_admin()));
grant select,insert,update,delete on public.stock_purchases,public.cash_flow_entries to authenticated,service_role;

create or replace function public.record_shizuku_stock_purchase(p_inventory_item_id uuid,p_market_code text,p_quantity numeric,p_total_cost numeric,p_supplier text default null,p_notes text default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_market text:=upper(trim(coalesce(p_market_code,'SG')));
begin
  if not public.is_shizuku_admin() then raise exception 'Not authorised'; end if;
  if v_market not in('SG','MY') or p_quantity<=0 or p_total_cost<0 then raise exception 'Invalid stock purchase'; end if;
  if not exists(select 1 from public.inventory_items where id=p_inventory_item_id and upper(coalesce(market_code,'SG'))=v_market) then raise exception 'Inventory item does not belong to this market'; end if;
  insert into public.stock_purchases(market_code,inventory_item_id,quantity,total_cost,supplier,notes) values(v_market,p_inventory_item_id,p_quantity,p_total_cost,p_supplier,p_notes) returning id into v_id;
  update public.inventory_items set stock_quantity=stock_quantity+p_quantity,updated_at=now() where id=p_inventory_item_id;
  insert into public.inventory_movements(inventory_item_id,quantity_change,reason) values(p_inventory_item_id,p_quantity,'stock_purchase');
  insert into public.cash_flow_entries(market_code,entry_type,category,amount,reference_type,reference_id,notes) values(v_market,'expense','stock_purchase',p_total_cost,'stock_purchase',v_id,p_notes);
  return v_id;
end $$;
revoke all on function public.record_shizuku_stock_purchase(uuid,text,numeric,numeric,text,text) from public,anon;
grant execute on function public.record_shizuku_stock_purchase(uuid,text,numeric,numeric,text,text) to authenticated,service_role;

create or replace function public.send_shizuku_order_email()
returns trigger language plpgsql security definer set search_path='public','extensions' as $$
declare settings record; alert_event text; items jsonb; send_owner boolean:=false; send_customer boolean:=false; base_url text:='https://shizukulab.vercel.app/unsubscribe?token=';
begin
  select * into settings from public.notification_settings where id=1;
  if not found or nullif(trim(coalesce(settings.webhook_url,'')),'') is null then return new; end if;
  if new.payment_status='submitted' and old.payment_status is distinct from 'submitted' then alert_event:='payment_proof';send_owner:=coalesce(settings.enabled,false) and coalesce(settings.alert_payment_proof,false);
  elsif new.payment_status='rejected' and old.payment_status is distinct from 'rejected' then alert_event:='payment_rejected';send_owner:=coalesce(settings.enabled,false);
  elsif new.payment_status='paid' and old.payment_status is distinct from 'paid' then alert_event:='order_confirmed';send_owner:=coalesce(settings.enabled,false);
  elsif new.order_status='ready' and old.order_status is distinct from 'ready' then alert_event:='order_ready_for_collection';send_owner:=coalesce(settings.enabled,false);
  else return new; end if;
  send_customer:=coalesce(settings.customer_email_enabled,true) and not coalesce(new.email_notifications_opted_out,false) and nullif(trim(coalesce(new.customer_email,'')),'') is not null;
  if alert_event='order_ready_for_collection' then send_customer:=send_customer and coalesce(settings.customer_ready_email_enabled,true); end if;
  if not send_owner and not send_customer then return new; end if;
  select coalesce(jsonb_agg(jsonb_build_object('product_name',oi.product_name,'quantity',oi.quantity,'unit_price',oi.unit_price) order by oi.id),'[]'::jsonb) into items from public.order_items oi where oi.order_id=new.id;
  perform net.http_post(url:=settings.webhook_url,headers:=jsonb_build_object('Content-Type','application/json'),body:=jsonb_build_object('event',alert_event,'send_owner',send_owner,'send_customer',send_customer,'customer_email',case when send_customer then new.customer_email else null end,'customer_name',new.customer_name,'customer_phone',new.customer_phone,'order_number',new.order_number,'collection_date',new.collection_date,'collection_time',new.collection_time,'collection_point',new.collection_point,'total',new.total,'payment_status',new.payment_status,'order_status',new.order_status,'notes',new.notes,'items',items,'unsubscribe_url',base_url||new.email_unsubscribe_token::text,'payment_review_email_subject_template',settings.payment_review_email_subject_template,'payment_review_email_heading_template',settings.payment_review_email_heading_template,'payment_review_email_message_template',settings.payment_review_email_message_template,'customer_email_subject_template',settings.customer_email_subject_template,'customer_email_heading_template',settings.customer_email_heading_template,'customer_email_message_template',settings.customer_email_message_template,'customer_ready_email_enabled',settings.customer_ready_email_enabled,'customer_ready_email_subject_template',settings.customer_ready_email_subject_template,'customer_ready_email_heading_template',settings.customer_ready_email_heading_template,'customer_ready_email_message_template',settings.customer_ready_email_message_template));
  return new;
end $$;
revoke all on function public.send_shizuku_order_email() from public,anon,authenticated;

create or replace function public.send_marketing_campaign_email(p_customer_email text,p_market_code text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c record;s record;n record;request_id bigint;email text:=lower(trim(coalesce(p_customer_email,'')));market text:=upper(trim(coalesce(p_market_code,'SG')));
begin
  if not public.is_shizuku_admin() then raise exception 'Not authorised'; end if;
  select customer_name,customer_email,email_unsubscribe_token into c from public.marketing_contacts where lower(trim(coalesce(customer_email,'')))=email and market_code=market and marketing_email_opt_in and not email_notifications_opted_out order by consent_at desc limit 1;
  if not found then select customer_name,customer_email,email_unsubscribe_token into c from public.orders where lower(trim(coalesce(customer_email,'')))=email and upper(coalesce(market_code,'SG'))=market and marketing_email_opt_in and not email_notifications_opted_out order by coalesce(marketing_consent_at,created_at) desc limit 1; end if;
  if not found then raise exception 'Customer is not subscribed to email'; end if;
  select marketing_email_subject,marketing_email_body,marketing_attachment_url,marketing_attachment_name,marketing_attachment_type into s from public.store_settings order by created_at limit 1;
  select webhook_url into n from public.notification_settings where id=1;
  select net.http_post(url:=n.webhook_url,headers:=jsonb_build_object('Content-Type','application/json'),body:=jsonb_build_object('event','marketing_campaign','send_owner',false,'customer_email',c.customer_email,'customer_name',c.customer_name,'market_code',market,'marketing_email_subject',s.marketing_email_subject,'marketing_email_body',s.marketing_email_body,'attachment_url',s.marketing_attachment_url,'attachment_name',s.marketing_attachment_name,'attachment_type',s.marketing_attachment_type,'unsubscribe_url','https://shizukulab.vercel.app/unsubscribe?token='||c.email_unsubscribe_token::text)) into request_id;
  return jsonb_build_object('ok',true,'queued',true,'request_id',request_id);
end $$;
revoke all on function public.send_marketing_campaign_email(text,text) from public,anon;
grant execute on function public.send_marketing_campaign_email(text,text) to authenticated,service_role;

create or replace function public.send_customer_order_confirmation(p_order_id bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare o public.orders%rowtype; n public.notification_settings%rowtype; items jsonb; req bigint;
begin
  if not public.is_shizuku_admin() then raise exception 'Not authorised'; end if;
  select * into o from public.orders where id=p_order_id and lower(coalesce(payment_status,''))='paid' and lower(coalesce(order_status,''))<>'cancelled';
  if not found then raise exception 'Confirm payment before emailing the customer.'; end if;
  if coalesce(trim(o.customer_email),'')='' then raise exception 'This customer did not provide an email.'; end if;
  if coalesce(o.email_notifications_opted_out,false) then raise exception 'This customer unsubscribed from all emails.'; end if;
  select * into n from public.notification_settings where id=1;
  if not coalesce(n.customer_email_enabled,false) or coalesce(trim(n.webhook_url),'')='' then raise exception 'Customer email is not enabled or the Web app URL is missing.'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('product_name',product_name,'quantity',quantity,'unit_price',unit_price,'options',options) order by id),'[]'::jsonb) into items from public.order_items where order_id=o.id;
  select net.http_post(url:=n.webhook_url,headers:=jsonb_build_object('Content-Type','application/json'),body:=jsonb_build_object('event','order_confirmed','send_owner',false,'send_customer',true,'recipient_email',n.recipient_email,'customer_email',o.customer_email,'customer_email_subject_template',n.customer_email_subject_template,'customer_email_heading_template',n.customer_email_heading_template,'customer_email_message_template',n.customer_email_message_template,'unsubscribe_url','https://shizukulab.vercel.app/unsubscribe?token='||o.email_unsubscribe_token::text,'order',to_jsonb(o),'items',items)) into req;
  update public.orders set customer_confirmation_email_sent_at=now() where id=o.id;
  return jsonb_build_object('ok',true,'request_id',req);
end $$;
revoke all on function public.send_customer_order_confirmation(bigint) from public,anon;
grant execute on function public.send_customer_order_confirmation(bigint) to authenticated,service_role;
