-- Four launch slots (2 Singapore + 2 Malaysia) and isolated HBB data storage.
update public.slow_studio_platform_limits
set singapore_hbb_limit=2, malaysia_hbb_limit=2, updated_at=now()
where id='main';

create table if not exists public.slow_studio_store_settings (
  workspace_id uuid primary key references public.slow_studio_workspaces(id) on delete cascade,
  store_name text not null,
  country_code text not null check (country_code in ('SG','MY')),
  currency_code text not null check (currency_code in ('SGD','MYR')),
  website_visibility text not null default 'hidden' check (website_visibility in ('hidden','live')),
  payment_method text not null,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.slow_studio_products (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.slow_studio_workspaces(id) on delete cascade,
  name text not null,
  price numeric not null default 0 check (price >= 0),
  stock numeric not null default 0 check (stock >= 0),
  is_available boolean not null default true,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists slow_studio_products_workspace_idx on public.slow_studio_products(workspace_id);

create table if not exists public.slow_studio_inventory (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.slow_studio_workspaces(id) on delete cascade,
  name text not null,
  quantity numeric not null default 0,
  unit text,
  unit_cost numeric not null default 0 check (unit_cost >= 0),
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists slow_studio_inventory_workspace_idx on public.slow_studio_inventory(workspace_id);

create table if not exists public.slow_studio_orders (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.slow_studio_workspaces(id) on delete cascade,
  order_number text not null,
  status text not null default 'pending',
  payment_status text not null default 'awaiting_payment',
  total numeric not null default 0 check (total >= 0),
  customer_name text,
  customer_email text,
  customer_phone text,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_id,order_number)
);
create index if not exists slow_studio_orders_workspace_created_idx on public.slow_studio_orders(workspace_id,created_at desc);

create table if not exists public.slow_studio_marketing_contacts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.slow_studio_workspaces(id) on delete cascade,
  name text,
  email text,
  phone text,
  email_opt_in boolean not null default false,
  whatsapp_opt_in boolean not null default false,
  unsubscribed_at timestamptz,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists slow_studio_marketing_workspace_idx on public.slow_studio_marketing_contacts(workspace_id);

create table if not exists public.slow_studio_messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.slow_studio_workspaces(id) on delete cascade,
  order_id uuid references public.slow_studio_orders(id) on delete cascade,
  sender_type text not null check (sender_type in ('customer','store')),
  message text not null,
  created_at timestamptz not null default now()
);
create index if not exists slow_studio_messages_workspace_idx on public.slow_studio_messages(workspace_id,created_at desc);

alter table public.slow_studio_store_settings enable row level security;
alter table public.slow_studio_products enable row level security;
alter table public.slow_studio_inventory enable row level security;
alter table public.slow_studio_orders enable row level security;
alter table public.slow_studio_marketing_contacts enable row level security;
alter table public.slow_studio_messages enable row level security;

create policy slow_studio_settings_member_read on public.slow_studio_store_settings for select to authenticated using (private.slow_studio_has_role(workspace_id,array['owner','admin','operations','marketing','viewer']));
create policy slow_studio_settings_admin_write on public.slow_studio_store_settings for all to authenticated using (private.slow_studio_has_role(workspace_id,array['owner','admin'])) with check (private.slow_studio_has_role(workspace_id,array['owner','admin']));
create policy slow_studio_products_member_read on public.slow_studio_products for select to authenticated using (private.slow_studio_has_role(workspace_id,array['owner','admin','operations','marketing','viewer']));
create policy slow_studio_products_admin_write on public.slow_studio_products for all to authenticated using (private.slow_studio_has_role(workspace_id,array['owner','admin'])) with check (private.slow_studio_has_role(workspace_id,array['owner','admin']));
create policy slow_studio_inventory_ops on public.slow_studio_inventory for all to authenticated using (private.slow_studio_has_role(workspace_id,array['owner','admin','operations'])) with check (private.slow_studio_has_role(workspace_id,array['owner','admin','operations']));
create policy slow_studio_orders_ops on public.slow_studio_orders for all to authenticated using (private.slow_studio_has_role(workspace_id,array['owner','admin','operations'])) with check (private.slow_studio_has_role(workspace_id,array['owner','admin','operations']));
create policy slow_studio_marketing_team on public.slow_studio_marketing_contacts for all to authenticated using (private.slow_studio_has_role(workspace_id,array['owner','admin','marketing'])) with check (private.slow_studio_has_role(workspace_id,array['owner','admin','marketing']));
create policy slow_studio_messages_ops on public.slow_studio_messages for all to authenticated using (private.slow_studio_has_role(workspace_id,array['owner','admin','operations'])) with check (private.slow_studio_has_role(workspace_id,array['owner','admin','operations']));

grant select,insert,update,delete on public.slow_studio_store_settings,public.slow_studio_products,public.slow_studio_inventory,public.slow_studio_orders,public.slow_studio_marketing_contacts,public.slow_studio_messages to authenticated,service_role;

create or replace function private.slow_studio_seed_workspace()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  insert into public.slow_studio_store_settings(workspace_id,store_name,country_code,currency_code,payment_method,settings)
  values (new.id,new.name,new.country_code,new.currency_code,case when new.country_code='MY' then 'touchngo_or_bank_transfer' else 'paynow' end,
    jsonb_build_object('phone_country_code',case when new.country_code='MY' then '+60' else '+65' end,'email_notifications',true,'ready_email',true,'whatsapp_enabled',true))
  on conflict (workspace_id) do nothing;
  return new;
end;
$$;

drop trigger if exists slow_studio_seed_workspace_after_insert on public.slow_studio_workspaces;
create trigger slow_studio_seed_workspace_after_insert after insert on public.slow_studio_workspaces for each row execute function private.slow_studio_seed_workspace();

insert into public.slow_studio_store_settings(workspace_id,store_name,country_code,currency_code,payment_method,settings)
select w.id,w.name,w.country_code,w.currency_code,case when w.country_code='MY' then 'touchngo_or_bank_transfer' else 'paynow' end,
  jsonb_build_object('phone_country_code',case when w.country_code='MY' then '+60' else '+65' end,'email_notifications',true,'ready_email',true,'whatsapp_enabled',true)
from public.slow_studio_workspaces w on conflict (workspace_id) do nothing;

create or replace function public.accept_slow_studio_hbb_invitation()
returns integer language plpgsql security definer set search_path='' as $$
declare v_email text; v_count integer:=0; v_invite record;
begin
  if not private.slow_studio_has_aal2() then raise exception 'Two-step verification is required'; end if;
  select lower(email) into v_email from auth.users where id=(select auth.uid());
  if coalesce(v_email,'')='' then return 0; end if;
  for v_invite in select * from public.slow_studio_workspace_invites where lower(email)=v_email and status='pending' for update loop
    insert into public.slow_studio_memberships(workspace_id,user_id,role,is_active)
    values(v_invite.workspace_id,(select auth.uid()),v_invite.role,true)
    on conflict(workspace_id,user_id) do update set role=excluded.role,is_active=true;
    update public.slow_studio_workspace_invites set status='accepted',accepted_by=(select auth.uid()),accepted_at=now() where id=v_invite.id;
    v_count:=v_count+1;
  end loop;
  return v_count;
end;
$$;
revoke all on function public.accept_slow_studio_hbb_invitation() from public,anon;
grant execute on function public.accept_slow_studio_hbb_invitation() to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('slow-studio-private','slow-studio-private',false,10485760,array['image/jpeg','image/png','image/webp','image/heic','image/heif','application/pdf']::text[])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create or replace function private.slow_studio_storage_workspace_id(object_name text)
returns uuid language plpgsql immutable security invoker set search_path='' as $$
declare v_part text;
begin
  v_part:=(storage.foldername(object_name))[1];
  return v_part::uuid;
exception when invalid_text_representation then return null;
end;
$$;

create policy slow_studio_private_files_read on storage.objects for select to authenticated using (bucket_id='slow-studio-private' and private.slow_studio_has_role(private.slow_studio_storage_workspace_id(name),array['owner','admin','operations']));
create policy slow_studio_private_files_insert on storage.objects for insert to authenticated with check (bucket_id='slow-studio-private' and private.slow_studio_has_role(private.slow_studio_storage_workspace_id(name),array['owner','admin','operations']));
create policy slow_studio_private_files_update on storage.objects for update to authenticated using (bucket_id='slow-studio-private' and private.slow_studio_has_role(private.slow_studio_storage_workspace_id(name),array['owner','admin','operations'])) with check (bucket_id='slow-studio-private' and private.slow_studio_has_role(private.slow_studio_storage_workspace_id(name),array['owner','admin','operations']));
create policy slow_studio_private_files_delete on storage.objects for delete to authenticated using (bucket_id='slow-studio-private' and private.slow_studio_has_role(private.slow_studio_storage_workspace_id(name),array['owner','admin','operations']));
