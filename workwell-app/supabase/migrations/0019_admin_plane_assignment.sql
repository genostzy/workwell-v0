-- Admin plane assignment.
--
-- Users don't choose their plane — admins assign it. This migration adds
-- the plane column, admin helpers, and functions for managing assignments.

-- Add plane column to people
ALTER TABLE identity.people
  ADD COLUMN IF NOT EXISTS plane text CHECK (plane IN ('private', 'hr'));

-- Admin helper: same pattern as is_hr()
create or replace function identity.is_admin() returns boolean
  language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from identity.person_roles
     where person_id = identity.current_person_id()
       and role = 'admin'
  )
$$;

revoke all on function identity.is_admin() from public;
grant execute on function identity.is_admin() to authenticated;

-- Admin audit log
create table if not exists identity.admin_audit_log (
  id             uuid primary key default gen_random_uuid(),
  admin_id       uuid not null references auth.users(id),
  action         text not null,
  target_user_id uuid references auth.users(id),
  details        jsonb,
  created_at     timestamptz not null default now()
);

alter table identity.admin_audit_log enable row level security;

create policy admin_audit_read on identity.admin_audit_log
  for select to authenticated
  using (identity.is_admin());

create policy admin_audit_insert on identity.admin_audit_log
  for insert to authenticated
  with check (identity.is_admin());

grant select, insert on identity.admin_audit_log to authenticated;

-- Function: admin assigns plane to a user
create or replace function public.admin_assign_plane(
  p_user_id    uuid,
  p_plane      text
) returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  if not identity.is_admin() then
    raise exception 'access denied: admin role required' using errcode = '42501';
  end if;

  if p_plane not in ('private', 'hr') then
    raise exception 'invalid plane: must be private or hr' using errcode = '22023';
  end if;

  -- Update the person's plane
  update identity.people
     set plane = p_plane
   where auth_user_id = p_user_id;

  -- Grant appropriate role
  insert into identity.person_roles (person_id, role)
  select id, case when p_plane = 'hr' then 'hr' else 'employee' end
    from identity.people
   where auth_user_id = p_user_id
  on conflict (person_id, role) do nothing;

  -- Log the action
  insert into identity.admin_audit_log (admin_id, action, target_user_id, details)
  values (
    auth.uid(),
    'assign_plane',
    p_user_id,
    jsonb_build_object('plane', p_plane)
  );
end;
$$;

revoke all on function public.admin_assign_plane(uuid, text) from public;
grant execute on function public.admin_assign_plane(uuid, text) to authenticated;

-- Function: list users needing plane assignment
create or replace function public.admin_pending_assignments()
returns table (
  user_id    uuid,
  email      text,
  full_name  text,
  created_at timestamptz,
  has_plane  boolean
)
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  if not identity.is_admin() then
    raise exception 'access denied: admin role required' using errcode = '42501';
  end if;

  return query
  select
    p.auth_user_id as user_id,
    p.email,
    p.full_name,
    p.created_at,
    (p.plane is not null) as has_plane
  from identity.people p
  where p.auth_user_id is not null
    and (p.plane is null)
  order by p.created_at desc;
end;
$$;

revoke all on function public.admin_pending_assignments() from public;
grant execute on function public.admin_pending_assignments() to authenticated;

-- Function: list all accounts (admin view)
create or replace function public.admin_list_accounts()
returns table (
  user_id       uuid,
  email         text,
  full_name     text,
  plane         text,
  created_at    timestamptz,
  is_active     boolean,
  last_sign_in  timestamptz
)
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  if not identity.is_admin() then
    raise exception 'access denied: admin role required' using errcode = '42501';
  end if;

  return query
  select
    p.auth_user_id as user_id,
    p.email,
    p.full_name,
    p.plane,
    p.created_at,
    (p.status = 'active') as is_active,
    au.last_sign_in_at
  from identity.people p
  join auth.users au on au.id = p.auth_user_id
  order by p.created_at desc;
end;
$$;

revoke all on function public.admin_list_accounts() from public;
grant execute on function public.admin_list_accounts() to authenticated;

-- Function: admin deactivates an account
create or replace function public.admin_deactivate_account(
  p_user_id uuid
) returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  if not identity.is_admin() then
    raise exception 'access denied: admin role required' using errcode = '42501';
  end if;

  if p_user_id = auth.uid() then
    raise exception 'cannot deactivate your own account' using errcode = '23505';
  end if;

  update identity.people
     set status = 'left'
   where auth_user_id = p_user_id;

  delete from identity.person_roles
   where person_id = (select id from identity.people where auth_user_id = p_user_id);

  insert into identity.admin_audit_log (admin_id, action, target_user_id, details)
  values (auth.uid(), 'deactivate_account', p_user_id, null);
end;
$$;

revoke all on function public.admin_deactivate_account(uuid) from public;
grant execute on function public.admin_deactivate_account(uuid) to authenticated;

-- Update the me view to include plane info
create or replace view public.me
  with (security_invoker = true)
  as select id, org_id, full_name, status, plane
       from identity.people
      where id = identity.current_person_id();

grant select on public.me to authenticated;
