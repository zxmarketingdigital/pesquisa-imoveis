insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, confirmation_token, recovery_token, email_change, email_change_token_new)
values
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-00000000000a', 'authenticated', 'authenticated', 'a@teste.local', crypt('teste-local-a', gen_salt('bf')), now(), now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-00000000000b', 'authenticated', 'authenticated', 'b@teste.local', crypt('teste-local-b', gen_salt('bf')), now(), now(), now(), '', '', '', '');

insert into auth.identities (id, user_id, provider_id, provider, identity_data, created_at, updated_at, last_sign_in_at)
select gen_random_uuid(), id, id::text, 'email', jsonb_build_object('sub', id::text, 'email', email), now(), now(), now()
from auth.users where email like '%@teste.local';
