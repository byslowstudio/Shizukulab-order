-- Keep the 2 SG + 2 MY launch allowance separate from Slow Studio's own production stores.
alter table public.slow_studio_workspaces
  add column if not exists workspace_kind text not null default 'production'
  check (workspace_kind in ('production','hbb'));

create or replace function public.create_slow_studio_hbb_account(
  p_name text,
  p_country_code text,
  p_owner_email text,
  p_role text default 'owner'
)
returns table(workspace_id uuid,workspace_slug text,invite_id uuid)
language plpgsql security definer set search_path='' as $$
declare
  v_workspace public.slow_studio_workspaces;
  v_invite public.slow_studio_workspace_invites;
  v_country text:=upper(trim(coalesce(p_country_code,'')));
  v_email text:=lower(trim(coalesce(p_owner_email,'')));
  v_role text:=lower(trim(coalesce(p_role,'owner')));
  v_slug text;
  v_limit integer;
  v_current integer;
begin
  if not private.slow_studio_is_platform_admin() then raise exception 'Slow Studio owner access is required'; end if;
  if length(trim(coalesce(p_name,'')))<2 then raise exception 'Business name is required'; end if;
  if v_country not in ('SG','MY') then raise exception 'Country must be SG or MY'; end if;
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' then raise exception 'A valid owner email is required'; end if;
  if v_role not in ('owner','admin','operations','marketing','viewer') then raise exception 'Invalid role'; end if;

  perform pg_advisory_xact_lock(hashtext('slow-studio-hbb-cap-'||v_country));
  select case when v_country='SG' then singapore_hbb_limit else malaysia_hbb_limit end into v_limit
  from public.slow_studio_platform_limits where id='main';
  select count(*) into v_current from public.slow_studio_workspaces
  where workspace_kind='hbb' and country_code=v_country and status in ('setup','live','hidden');
  if v_limit is not null and v_current>=v_limit then raise exception '% HBB account limit reached (%).',v_country,v_limit; end if;

  v_slug:='hbb-'||trim(both '-' from regexp_replace(lower(trim(p_name)),'[^a-z0-9]+','-','g'))
    ||'-'||lower(v_country)||'-'||substr(replace(gen_random_uuid()::text,'-',''),1,6);
  insert into public.slow_studio_workspaces(
    slug,name,country_code,currency_code,status,created_by,owner_notification_email,workspace_kind
  ) values (
    v_slug,trim(p_name),v_country,case when v_country='MY' then 'MYR' else 'SGD' end,
    'setup',(select auth.uid()),v_email,'hbb'
  ) returning * into v_workspace;
  insert into public.slow_studio_workspace_invites(workspace_id,email,role,status,invited_by)
  values(v_workspace.id,v_email,v_role,'pending',(select auth.uid())) returning * into v_invite;
  insert into public.slow_studio_activity(workspace_id,actor_id,action,page_name,detail)
  values(v_workspace.id,(select auth.uid()),'HBB account created','My stores',
    jsonb_build_object('owner_email',v_email,'role',v_role,'status','pending','market',v_country));
  return query select v_workspace.id,v_workspace.slug,v_invite.id;
end;
$$;

create or replace function public.get_slow_studio_capacity()
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_limits public.slow_studio_platform_limits%rowtype;
  v_db bigint; v_storage bigint; v_sg integer; v_my integer;
begin
  if not private.slow_studio_is_platform_admin() then raise exception 'Slow Studio owner access is required'; end if;
  select * into v_limits from public.slow_studio_platform_limits where id='main';
  select pg_database_size(current_database()) into v_db;
  select coalesce(sum((metadata->>'size')::bigint),0) into v_storage from storage.objects;
  select count(*) into v_sg from public.slow_studio_workspaces where workspace_kind='hbb' and country_code='SG' and status in ('setup','live','hidden');
  select count(*) into v_my from public.slow_studio_workspaces where workspace_kind='hbb' and country_code='MY' and status in ('setup','live','hidden');
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
