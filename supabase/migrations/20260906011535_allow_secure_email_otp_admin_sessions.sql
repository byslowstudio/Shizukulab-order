-- Supabase treats email OTP as AAL1, not native MFA/AAL2. Slow Studio accepts
-- either native AAL2 or a session issued specifically through the email OTP
-- method. Password-only, magic-link, invite and anonymous sessions do not pass.
create or replace function private.slow_studio_has_aal2()
returns boolean language sql stable security invoker set search_path='' as $$
  select coalesce((select auth.jwt()->>'aal'),'aal1')='aal2'
    or exists (
      select 1
      from jsonb_array_elements(coalesce((select auth.jwt()->'amr'),'[]'::jsonb)) as method
      where method->>'method'='otp'
    );
$$;
