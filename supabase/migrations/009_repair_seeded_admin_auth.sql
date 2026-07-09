create extension if not exists pgcrypto;

do $$
declare
  seeded_admin record;
begin
  for seeded_admin in
    select *
    from (
      values
        (
          '00000000-0000-4000-8000-000000000001'::uuid,
          'admin'::text,
          'admin@yjms.local'::text,
          '관리자'::text,
          'manager'::text
        ),
        (
          '00000000-0000-4000-8000-000000000002'::uuid,
          'heonhwi'::text,
          'heonhwi@yjms.local'::text,
          '하헌휘'::text,
          'dev'::text
        )
    ) as admins(user_id, username, email, display_name, admin_role)
  loop
    insert into auth.users (
      id,
      instance_id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      confirmation_token,
      recovery_token,
      email_change_token_new,
      email_change,
      email_change_token_current,
      reauthentication_token,
      raw_app_meta_data,
      raw_user_meta_data,
      is_sso_user,
      is_anonymous,
      created_at,
      updated_at
    )
    values (
      seeded_admin.user_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      seeded_admin.email,
      extensions.crypt('admin', extensions.gen_salt('bf')),
      now(),
      '',
      '',
      '',
      '',
      '',
      '',
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{}'::jsonb,
      false,
      false,
      now(),
      now()
    )
    on conflict (id) do update
    set
      aud = excluded.aud,
      role = excluded.role,
      email = excluded.email,
      encrypted_password = excluded.encrypted_password,
      email_confirmed_at = coalesce(auth.users.email_confirmed_at, excluded.email_confirmed_at),
      confirmation_token = '',
      recovery_token = '',
      email_change_token_new = '',
      email_change = '',
      email_change_token_current = '',
      reauthentication_token = '',
      raw_app_meta_data = excluded.raw_app_meta_data,
      raw_user_meta_data = excluded.raw_user_meta_data,
      is_sso_user = false,
      is_anonymous = false,
      updated_at = now();

    insert into auth.identities (
      id,
      user_id,
      provider_id,
      identity_data,
      provider,
      last_sign_in_at,
      created_at,
      updated_at
    )
    values (
      seeded_admin.user_id,
      seeded_admin.user_id,
      seeded_admin.email,
      jsonb_build_object(
        'sub',
        seeded_admin.user_id::text,
        'email',
        seeded_admin.email,
        'email_verified',
        true,
        'phone_verified',
        false
      ),
      'email',
      now(),
      now(),
      now()
    )
    on conflict (provider, provider_id) do update
    set
      user_id = excluded.user_id,
      identity_data = excluded.identity_data,
      updated_at = now();

    insert into public.admin_profiles (
      user_id,
      username,
      display_name,
      role,
      is_active
    )
    values (
      seeded_admin.user_id,
      seeded_admin.username,
      seeded_admin.display_name,
      seeded_admin.admin_role,
      true
    )
    on conflict (user_id) do update
    set
      username = excluded.username,
      display_name = excluded.display_name,
      role = excluded.role,
      is_active = excluded.is_active,
      updated_at = now();
  end loop;
end $$;
