-- Slow Studio launch guardrails for real HBB onboarding.
-- Account caps are enforced in Postgres so the browser cannot bypass them.

alter table public.slow_studio_workspaces
  add column if not exists owner_notification_email text,
  add column if not exists owner_order_email_enabled boolean not null default true,
  add column if not exists customer_confirmation_email_enabled boolean not null default true,
  add column if not exists customer_ready_email_enabled boolean not null default true,
  add column if not exists whatsapp_enabled boolean not null default true,
  add column if not exists upload_quota_bytes bigint not null default 104857600
    check (upload_quota_bytes between 5242880 and 1073741824);

create table if not exists public.slow_studio_platform_limits (
  id text primary key default 'main' check (id = 'main'),
  singapore_hbb_limit integer not null default 2 check (singapore_hbb_limit between 0 and 1000),
  malaysia_hbb_limit integer check (malaysia_hbb_limit is null or malaysia_hbb_limit between 0 and 1000),
  database_quota_bytes bigint not null default 524288000,
  storage_quota_bytes bigint not null default 1073741824,
  image_file_limit_bytes bigint not null default 5242880,
  attachment_file_limit_bytes bigint not null default 10485760,
  gmail_daily_recipient_limit integer not null default 100,
  gmail_remaining_last_known integer,
  gmail_quota_checked_at timestamptz,
  updated_at timestamptz not null default now()
);

insert into public.slow_studio_platform_limits(id)
values ('main') on conflict (id) do nothing;

alter table public.slow_studio_platform_limits enable row level security;

drop policy if exists slow_studio_platform_limits_owner_read on public.slow_studio_platform_limits;
create policy slow_studio_platform_limits_owner_read
on public.slow_studio_platform_limits for select to authenticated
using (private.slow_studio_is_platform_admin());

drop policy if exists slow_studio_platform_limits_owner_update on public.slow_studio_platform_limits;
create policy slow_studio_platform_limits_owner_update
on public.slow_studio_platform_limits for update to authenticated
using (private.slow_studio_is_platform_admin())
with check (private.slow_studio_is_platform_admin());

grant select,update on public.slow_studio_platform_limits to authenticated,service_role;

create or replace function public.create_slow_studio_hbb_account(
  p_name text,
  p_country_code text,
  p_owner_email text,
  p_role text default 'owner'
)
returns table(workspace_id uuid, workspace_slug text, invite_id uuid)
language plpgsql
security definer
set search_path=''
as $$
declare
  v_workspace public.slow_studio_workspaces;
  v_invite public.slow_studio_workspace_invites;
  v_country text := upper(trim(coalesce(p_country_code,'')));
  v_email text := lower(trim(coalesce(p_owner_email,'')));
  v_role text := lower(trim(coalesce(p_role,'owner')));
  v_slug text;
  v_limit integer;
  v_current integer;
begin
  if not private.slow_studio_is_platform_admin() then
    raise exception 'Slow Studio owner access is required';
  end if;
  if length(trim(coalesce(p_name,''))) < 2 then raise exception 'Business name is required'; end if;
  if v_country not in ('SG','MY') then raise exception 'Country must be SG or MY'; end if;
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' then raise exception 'A valid owner email is required'; end if;
  if v_role not in ('owner','admin','operations','marketing','viewer') then raise exception 'Invalid role'; end if;

  perform pg_advisory_xact_lock(hashtext('slow-studio-hbb-cap-' || v_country));
  select case when v_country='SG' then singapore_hbb_limit else malaysia_hbb_limit end
  into v_limit from public.slow_studio_platform_limits where id='main';
  select count(*) into v_current from public.slow_studio_workspaces
  where country_code=v_country and status in ('setup','live','hidden');
  if v_limit is not null and v_current >= v_limit then
    raise exception '% HBB account limit reached (%).', v_country, v_limit;
  end if;

  v_slug := trim(both '-' from regexp_replace(lower(trim(p_name)),'[^a-z0-9]+','-','g'))
    || '-' || lower(v_country) || '-' || substr(replace(gen_random_uuid()::text,'-',''),1,6);
  insert into public.slow_studio_workspaces(
    slug,name,country_code,currency_code,status,created_by,owner_notification_email
  ) values (
    v_slug,trim(p_name),v_country,case when v_country='MY' then 'MYR' else 'SGD' end,
    'setup',(select auth.uid()),v_email
  ) returning * into v_workspace;
  insert into public.slow_studio_workspace_invites(workspace_id,email,role,status,invited_by)
  values (v_workspace.id,v_email,v_role,'pending',(select auth.uid()))
  returning * into v_invite;
  insert into public.slow_studio_activity(workspace_id,actor_id,action,page_name,detail)
  values (v_workspace.id,(select auth.uid()),'HBB account created','My stores',
    jsonb_build_object('owner_email',v_email,'role',v_role,'status','pending','market',v_country));
  return query select v_workspace.id,v_workspace.slug,v_invite.id;
end;
$$;

revoke all on function public.create_slow_studio_hbb_account(text,text,text,text) from public,anon;
grant execute on function public.create_slow_studio_hbb_account(text,text,text,text) to authenticated,service_role;

create or replace function public.get_slow_studio_capacity()
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_limits public.slow_studio_platform_limits%rowtype;
  v_db bigint;
  v_storage bigint;
  v_sg integer;
  v_my integer;
begin
  if not private.slow_studio_is_platform_admin() then
    raise exception 'Slow Studio owner access is required';
  end if;
  select * into v_limits from public.slow_studio_platform_limits where id='main';
  select pg_database_size(current_database()) into v_db;
  select coalesce(sum((metadata->>'size')::bigint),0) into v_storage from storage.objects;
  select count(*) into v_sg from public.slow_studio_workspaces where country_code='SG' and status in ('setup','live','hidden');
  select count(*) into v_my from public.slow_studio_workspaces where country_code='MY' and status in ('setup','live','hidden');
  return jsonb_build_object(
    'database_bytes',v_db,'database_quota_bytes',v_limits.database_quota_bytes,
    'storage_bytes',v_storage,'storage_quota_bytes',v_limits.storage_quota_bytes,
    'image_file_limit_bytes',v_limits.image_file_limit_bytes,
    'attachment_file_limit_bytes',v_limits.attachment_file_limit_bytes,
    'singapore_hbb_count',v_sg,'singapore_hbb_limit',v_limits.singapore_hbb_limit,
    'malaysia_hbb_count',v_my,'malaysia_hbb_limit',v_limits.malaysia_hbb_limit,
    'gmail_daily_recipient_limit',v_limits.gmail_daily_recipient_limit,
    'gmail_remaining_last_known',v_limits.gmail_remaining_last_known,
    'gmail_quota_checked_at',v_limits.gmail_quota_checked_at
  );
end;
$$;

revoke all on function public.get_slow_studio_capacity() from public,anon;
grant execute on function public.get_slow_studio_capacity() to authenticated,service_role;

-- Bucket limits are stricter than the provider maximum and protect the shared plan.
update storage.buckets
set file_size_limit=5242880,
    allowed_mime_types=array['image/jpeg','image/png','image/webp','image/heic','image/heif']::text[]
where id in ('payment-proofs','Paynow','storefront-images');

update storage.buckets
set file_size_limit=10485760,
    allowed_mime_types=array['image/jpeg','image/png','image/webp','image/heic','image/heif','video/mp4']::text[]
where id='website-media';

update storage.buckets
set file_size_limit=10485760
where id='purchase-receipts';

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values (
  'marketing-attachments','marketing-attachments',true,10485760,
  array['image/jpeg','image/png','image/webp','image/heic','image/heif','application/pdf','text/plain','text/csv','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']::text[]
)
on conflict (id) do update set
  public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "Public reads marketing attachments" on storage.objects;
create policy "Public reads marketing attachments" on storage.objects
for select to public using (bucket_id='marketing-attachments');

drop policy if exists "Admin uploads marketing attachments" on storage.objects;
create policy "Admin uploads marketing attachments" on storage.objects
for insert to authenticated with check (bucket_id='marketing-attachments' and public.is_shizuku_admin());

drop policy if exists "Admin updates marketing attachments" on storage.objects;
create policy "Admin updates marketing attachments" on storage.objects
for update to authenticated using (bucket_id='marketing-attachments' and public.is_shizuku_admin())
with check (bucket_id='marketing-attachments' and public.is_shizuku_admin());

drop policy if exists "Admin deletes marketing attachments" on storage.objects;
create policy "Admin deletes marketing attachments" on storage.objects
for delete to authenticated using (bucket_id='marketing-attachments' and public.is_shizuku_admin());
