begin;
select plan(30);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'rls-a@teste.local'),
  ('00000000-0000-0000-0000-00000000000b', 'rls-b@teste.local');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';

select lives_ok($$ select public.criar_comprador('Ana R.', null, 'T2', 400000, array['Lisboa/Lumiar'], true, 4) $$, 'A cria comprador');
select is((select count(*) from public.compradores), 1::bigint, 'A vê o seu comprador');
select lives_ok($$ select * from public.registar_anuncio('https://www.imovirtual.com/x1','R1','Norte','T2',390000,80,'Lisboa','Lumiar',2024,false,true,null,null,null,null) $$, 'A regista anúncio pela RPC');

-- escrita direta em imoveis/anuncios (contorna a RPC) é recusada
select throws_ok($$ insert into public.imoveis (imobiliaria, tipologia, preco, concelho, zona) values ('X','T2',1,'Lisboa','Lumiar') $$, '42501', null, 'A não insere direto em imoveis');
select throws_ok($$ update public.imoveis set preco = 1 $$, '42501', null, 'A não atualiza direto imoveis');
select throws_ok($$ delete from public.imoveis $$, '42501', null, 'A não apaga imoveis');
select throws_ok($$ insert into public.anuncios (imovel_id, portal, chave_portal, url, preco) select id, 'Outro', 'k', 'https://k', 1 from public.imoveis $$, '42501', null, 'A não insere direto em anuncios');
select throws_ok($$ update public.anuncios set url = 'https://evil' $$, '42501', null, 'A não atualiza direto anuncios');
select throws_ok($$ delete from public.pesquisas $$, '42501', null, 'A não apaga pesquisas');

select lives_ok($$ insert into public.contactos (comprador_id, imovel_id, canal, texto) select c.id, i.id, 'email', 't' from public.compradores c, public.imoveis i $$, 'A regista contacto');

-- B
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}';
select is((select count(*) from public.compradores), 0::bigint, 'B não vê compradores de A');
select is((select count(*) from public.pesquisas), 0::bigint, 'B não vê pesquisas de A');
select is((select count(*) from public.contactos), 0::bigint, 'B não vê contactos de A');
select is((select count(*) from public.imoveis), 1::bigint, 'B vê o banco partilhado');
select is((select count(*) from public.anuncios), 1::bigint, 'B vê os anúncios partilhados');
select throws_ok($$ insert into public.compradores (consultor_id, nome) values ('00000000-0000-0000-0000-00000000000a', 'Intruso') $$, '42501', null, 'B não cria comprador em nome de A');
select throws_ok($$ insert into public.pesquisas (comprador_id, tipologia, preco_max, zonas) select id, 'T1', 1, array['x'] from (select '00000000-0000-0000-0000-00000000000a'::uuid as id) t $$, '42501', null, 'B não cria pesquisa para comprador inexistente/alheio');
select throws_ok($$ insert into public.contactos (comprador_id, imovel_id, canal, texto) select c.id, i.id, 'email', 'x' from (select 1) s, public.imoveis i, lateral (select '00000000-0000-0000-0000-00000000000a'::uuid as id) c $$, '42501', null, 'B não regista contacto sobre comprador de A');
with u as (update public.compradores set nome = 'x' returning 1) select is((select count(*) from u), 0::bigint, 'B não edita compradores de A');
with d as (delete from public.compradores returning 1) select is((select count(*) from d), 0::bigint, 'B não apaga compradores de A');
with d as (delete from public.contactos returning 1) select is((select count(*) from d), 0::bigint, 'B não apaga contactos de A');

-- storage
select throws_ok($$ insert into storage.objects (bucket_id, name) values ('fotos', 'nao-uuid.png') $$, '42501', null, 'upload com nome fora do padrão é recusado');
select lives_ok($$ insert into storage.objects (bucket_id, name, owner_id) values ('fotos', '22222222-2222-2222-2222-222222222222.jpg', '00000000-0000-0000-0000-00000000000b') $$, 'B envia foto com nome válido');
select throws_ok($$ insert into storage.objects (bucket_id, name) values ('outro', '33333333-3333-3333-3333-333333333333.jpg') $$, '42501', null, 'upload noutro bucket é recusado');

-- anónimo
reset role;
set local role anon;
select throws_ok($$ select count(*) from public.imoveis $$, '42501', null, 'anónimo não lê imoveis');
select throws_ok($$ select count(*) from public.anuncios $$, '42501', null, 'anónimo não lê anuncios');
select throws_ok($$ select count(*) from public.compradores $$, '42501', null, 'anónimo não lê compradores');
select throws_ok($$ select count(*) from public.pesquisas $$, '42501', null, 'anónimo não lê pesquisas');
select throws_ok($$ select count(*) from public.contactos $$, '42501', null, 'anónimo não lê contactos');
-- (chamar a função como anon rebenta o postgres desta imagem local ao formatar o erro; verifica-se o privilégio)
select is(has_function_privilege('anon', 'public.registar_anuncio(text,text,text,text,numeric,numeric,text,text,integer,boolean,boolean,text,text,text,text)', 'execute'), false, 'anónimo sem execute na RPC');

select * from finish();
rollback;
