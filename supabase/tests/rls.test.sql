begin;
select plan(45);

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

select lives_ok($$ select set_config('t.pid', (select id::text from public.pesquisas), true) $$, 'A guarda o id da sua pesquisa');
select lives_ok($$ select public.atualizar_pesquisa(current_setting('t.pid')::uuid) $$, 'A atualiza a sua pesquisa');

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

select throws_ok($$ select public.atualizar_pesquisa(current_setting('t.pid')::uuid) $$, 'P0002', 'pesquisa não encontrada', 'B não atualiza a pesquisa de A');

-- storage
select throws_ok($$ insert into storage.objects (bucket_id, name) values ('fotos', 'nao-uuid.png') $$, '42501', null, 'upload com nome fora do padrão é recusado');
select lives_ok($$ insert into storage.objects (bucket_id, name, owner_id) values ('fotos', '22222222-2222-2222-2222-222222222222.jpg', '00000000-0000-0000-0000-00000000000b') $$, 'B envia foto com nome válido');
select throws_ok($$ insert into storage.objects (bucket_id, name) values ('outro', '33333333-3333-3333-3333-333333333333.jpg') $$, '42501', null, 'upload noutro bucket é recusado');

-- NaN no preço (escrita pela RPC; CHECK recusa)
select throws_ok($$ select * from public.registar_anuncio('https://www.imovirtual.com/nan','RN','Norte','T2','NaN',80,'Lisboa','Lumiar',2024,false,true,null,null,null,null) $$, '23514', null, 'RPC recusa preço NaN');

-- consultor não apaga fotos: nem em uso, nem livres, nem de outro
select lives_ok($$ select * from public.registar_anuncio('https://www.imovirtual.com/foto','RF','Norte','T2',300000,80,'Lisboa','Lumiar',2024,false,true,null,null,null,'22222222-2222-2222-2222-222222222222.jpg') $$, 'B regista imóvel com a foto que enviou');
insert into storage.objects (bucket_id, name, owner_id) values ('fotos', '44444444-4444-4444-4444-444444444444.jpg', '00000000-0000-0000-0000-00000000000b');
set local storage.allow_delete_query = 'true';
with d as (delete from storage.objects where name = '22222222-2222-2222-2222-222222222222.jpg' returning 1) select is((select count(*) from d), 0::bigint, 'foto em uso não se apaga, nem pelo dono');
with d as (delete from storage.objects where name = '44444444-4444-4444-4444-444444444444.jpg' returning 1) select is((select count(*) from d), 0::bigint, 'foto própria sem uso também não se apaga');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';
insert into storage.objects (bucket_id, name, owner_id) values ('fotos', '55555555-5555-5555-5555-555555555555.jpg', '00000000-0000-0000-0000-00000000000a');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}';
with d as (delete from storage.objects where name = '55555555-5555-5555-5555-555555555555.jpg' returning 1) select is((select count(*) from d), 0::bigint, 'B não apaga foto de A');

-- A não regista imóvel com a foto de B
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';
select throws_ok($$ select * from public.registar_anuncio('https://www.imovirtual.com/foto-alheia','RG','Norte','T2',300000,80,'Lisboa','Lumiar',2024,false,true,null,null,null,'22222222-2222-2222-2222-222222222222.jpg') $$, '22023', 'foto inválida', 'A não usa a foto de B');


-- trigger: nem o dono do banco apaga um objeto que um imóvel usa; foto livre apaga-se
reset role;
set local storage.allow_delete_query = 'true';
select throws_ok($$ delete from storage.objects where name = '22222222-2222-2222-2222-222222222222.jpg' $$, '23503', 'foto em uso por um imóvel', 'delete direto de foto em uso falha pelo trigger');
select throws_ok($$ update storage.objects set name = '99999999-9999-9999-9999-999999999999.jpg' where name = '22222222-2222-2222-2222-222222222222.jpg' $$, '23503', 'foto em uso por um imóvel', 'renomear foto em uso falha');
select throws_ok($$ update storage.objects set archived_at = now() where name = '22222222-2222-2222-2222-222222222222.jpg' $$, '23503', 'foto em uso por um imóvel', 'arquivar foto em uso falha');
select throws_ok($$ truncate storage.objects cascade $$, '23503', 'foto em uso por um imóvel', 'truncate com foto em uso falha');
select lives_ok($$ update storage.objects set metadata = '{"x":1}' where name = '22222222-2222-2222-2222-222222222222.jpg' $$, 'atualizar metadados de foto em uso passa');
with d as (delete from storage.objects where name = '44444444-4444-4444-4444-444444444444.jpg' returning 1) select is((select count(*) from d), 1::bigint, 'dono do banco apaga foto livre');

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
