-- Malaysia-specific admin settings and mandatory second-factor guardrails.
alter table public.store_settings
  add column if not exists show_touchngo_name boolean not null default true,
  add column if not exists show_touchngo_number boolean not null default true;

alter table public.products
  add column if not exists myr_discount_price numeric check (myr_discount_price is null or myr_discount_price >= 0);

create or replace function private.slow_studio_has_aal2()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and coalesce((auth.jwt()->>'is_anonymous')::boolean, false) is false
    and coalesce(auth.jwt()->>'aal', 'aal1') = 'aal2';
$$;

revoke all on function private.slow_studio_has_aal2() from public;
grant execute on function private.slow_studio_has_aal2() to authenticated;

create or replace function public.is_shizuku_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.slow_studio_has_aal2()
    and (
      lower(coalesce(auth.jwt() ->> 'email', '')) = 'tinghuioh29@gmail.com'
      or exists (
        select 1
        from public.studio_users su
        where su.is_active
          and (
            su.auth_user_id = (select auth.uid())
            or lower(su.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
          )
      )
    );
$$;

create or replace function private.slow_studio_is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.slow_studio_has_aal2()
    and exists (
      select 1 from public.slow_studio_platform_admins a
      where a.user_id = (select auth.uid())
    );
$$;

create or replace function private.slow_studio_has_role(
  p_workspace_id uuid,
  p_roles text[] default null
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.slow_studio_has_aal2()
    and (
      private.slow_studio_is_platform_admin()
      or exists (
        select 1
        from public.slow_studio_memberships m
        where m.workspace_id = p_workspace_id
          and m.user_id = (select auth.uid())
          and m.is_active
          and (p_roles is null or m.role = any(p_roles))
      )
    );
$$;

-- Private event log: only a verified admin may inspect it.
alter table public.order_email_events enable row level security;
drop policy if exists "Admins can view email events" on public.order_email_events;
create policy "Admins can view email events"
on public.order_email_events for select
to authenticated
using (public.is_shizuku_admin());
