begin;
select plan(6);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@teste.local'),
  ('00000000-0000-0000-0000-00000000000b', 'b@teste.local');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';

select lives_ok($$ select public.criar_comprador('Ana R.', null, 'T2', 400000, array['Lisboa/Lumiar'], true, 4) $$, 'A cria comprador');
select is((select count(*) from public.compradores), 1::bigint, 'A vê o seu comprador');
select lives_ok($$ select * from public.registar_anuncio('Imovirtual','x1','https://exemplo.pt/x1','R1','Norte','T2',390000,80,'Lisboa','Lumiar',2024,false,true,null,null,null,null,'manual') $$, 'A regista anúncio');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}';
select is((select count(*) from public.compradores), 0::bigint, 'B não vê compradores de A');
select is((select count(*) from public.imoveis), 1::bigint, 'B vê o banco partilhado');

reset role;
set local role anon;
select throws_ok($$ select count(*) from public.imoveis $$, '42501', null, 'anónimo não lê imóveis');

select * from finish();
rollback;
