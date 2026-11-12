begin;
select plan(40);

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000d1', 'dedup@teste.local');
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}';

create function pg_temp.reg(url text, ref text, imob text, preco numeric default 390000,
  tip text default 'T2', concelho text default 'Lisboa', telefone text default '+351900000001', foto text default null, zona text default 'Lumiar',
  email text default null, consultor text default 'Marta Exemplo')
returns table (imovel_id uuid, estado text) language sql as $$
  select * from public.registar_anuncio(url, ref, imob, tip, preco, 80, concelho, zona,
    2024, false, true, consultor, telefone, email, foto)
$$;
grant execute on function pg_temp.reg to authenticated;

select is((select estado from pg_temp.reg('https://www.imovirtual.com/x/', 'REF 1', 'Imobiliária Norte')), 'novo', 'primeiro anúncio cria imóvel');
select is((select estado from pg_temp.reg('http://m.imovirtual.com/x?utm_source=a', 'REF 1', 'Imobiliária Norte', 380000)), 'atualizado', 'variante com m. e utm = mesmo anúncio');
select is((select estado from pg_temp.reg('imovirtual.com/x#foto', 'REF 1', 'Imobiliária Norte', 380000)), 'atualizado', 'sem protocolo e com fragmento = mesmo anúncio');
select is((select estado from pg_temp.reg('HTTPS://WWW.IMOVIRTUAL.COM/x/?fbclid=1&gclid=2', 'REF 1', 'Imobiliária Norte', 380000)), 'atualizado', 'host em maiúsculas, fbclid e gclid ignorados');
select is((select count(*) from public.anuncios), 1::bigint, 'continua um anúncio');
select is((select chave_portal from public.anuncios), 'imovirtual.com/x', 'chave calculada no servidor');
select is((select portal from public.anuncios), 'Imovirtual', 'portal calculado no servidor');
select is((select preco from public.imoveis), 380000::numeric, 'preço = mínimo dos anúncios');

-- helpers de normalização não são executáveis pelo consultor: testam-se como dono
reset role;
select is(public.normalizar_url('https://exemplo.pt/p?b=2&a=1&utm_x=3'), public.normalizar_url('http://www.exemplo.pt/p/?a=1&b=2'), 'parâmetros ordenados e utm removido');
select isnt(public.normalizar_url('https://exemplo.pt/p?id=1'), public.normalizar_url('https://exemplo.pt/p?id=2'), 'parâmetros distintos não colidem');

set local role authenticated;

select is((select estado from pg_temp.reg('https://casa.sapo.pt/b1', 'ref1', 'imobiliaria  norte', 400000)), 'ligado', 'mesma referência, imobiliária, tipologia e concelho liga');
select is((select count(*) from public.imoveis), 1::bigint, 'continua um imóvel');
select is((select preco from public.imoveis), 380000::numeric, 'ligar anúncio mais caro não sobe o preço do imóvel');
select is((select estado from pg_temp.reg('https://casa.sapo.pt/b1', 'ref1', 'imobiliaria  norte', 350000)), 'atualizado', 'anúncio existente atualiza o seu preço');
select is((select preco from public.imoveis), 350000::numeric, 'preço do imóvel desce para o mínimo');

select is((select estado from pg_temp.reg('https://casayes.pt/c1', 'REF 1', 'Outra Imobiliária')), 'novo', 'mesma referência noutra imobiliária separa');
select is((select estado from pg_temp.reg('https://casayes.pt/c2', 'REF 1', 'Imobiliária Norte', 390000, 'T3')), 'novo', 'mesma referência noutra tipologia separa');
select is((select estado from pg_temp.reg('https://casayes.pt/c3', 'REF 1', 'Imobiliária Norte', 390000, 'T2', 'Porto')), 'novo', 'mesma referência noutro concelho separa');
select is((select estado from pg_temp.reg('https://casayes.pt/c4', null, 'Imobiliária Norte')), 'novo', 'sem referência é novo');
select is((select estado from pg_temp.reg('https://casayes.pt/c5', '', 'Imobiliária Norte')), 'novo', 'referência vazia não liga');

select is((select estado from pg_temp.reg('https://casayes.pt/p1', 'S/R', 'Imobiliária Sul')), 'novo', 'placeholder S/R cria imóvel');
select is((select estado from pg_temp.reg('https://casayes.pt/p2', 'S/R', 'Imobiliária Sul')), 'novo', 'placeholder S/R não liga a outro');
select is((select count(*) from public.imoveis where referencia is not null and imobiliaria = 'Imobiliária Sul'), 0::bigint, 'placeholder fica sem referência');

select is((select estado from pg_temp.reg('https://casayes.pt/f1', 'FOTO-1', 'Imobiliária Foto', 300000, 'T2', 'Lisboa', '+351911111111', '11111111-1111-1111-1111-111111111111.jpg')), 'novo', 'imóvel com contacto e foto');
select is((select estado from pg_temp.reg('https://casayes.pt/f1', 'FOTO-1', 'Imobiliária Foto', 300000, 'T2', 'Lisboa', null, null)), 'atualizado', 'reenvio sem contacto nem foto');
select is((select telefone || '|' || foto_caminho from public.imoveis where referencia = 'FOTO-1'), '+351911111111|11111111-1111-1111-1111-111111111111.jpg', 'nulo não apaga contacto nem foto');
select throws_ok($$ select * from pg_temp.reg('https://casayes.pt/f2', 'FOTO-2', 'Imob', 300000, 'T2', 'Lisboa', null, 'https://evil.example/x.jpg') $$, '23514', null, 'foto fora do bucket é recusada');

-- mesma referência noutra zona separa
select is((select estado from pg_temp.reg('https://casayes.pt/z1', 'REF 1', 'Imobiliária Norte', 390000, 'T2', 'Lisboa', '+351900000001', null, 'Alvalade')), 'novo', 'mesma referência noutra zona separa');

-- autoridade manipulada (\, @, %5C, user:pass@) é recusada
select throws_ok($$ select * from pg_temp.reg('https://evil.example\@imovirtual.com/anuncio/123', 'E1', 'Imob') $$, '22023', null, 'barra invertida na autoridade recusada');
select throws_ok($$ select * from pg_temp.reg('https://evil.example%5C@imovirtual.com/anuncio/123', 'E2', 'Imob') $$, '22023', null, '%5C na autoridade recusado');
select throws_ok($$ select * from pg_temp.reg('https://user:pass@imovirtual.com/anuncio/123', 'E3', 'Imob') $$, '22023', null, 'user:pass@ recusado');
select throws_ok($$ select * from pg_temp.reg('https://evil.example/\x', 'E4', 'Imob') $$, '22023', null, 'barra invertida no caminho recusada');
select is((select count(*) from public.anuncios where url like '%evil%'), 0::bigint, 'nenhum anúncio com host desviado');

-- NaN
select throws_ok($$ select * from pg_temp.reg('https://casayes.pt/n1', 'NAN-1', 'Imob', 'NaN') $$, '23514', null, 'preço NaN recusado');

-- um registo nunca sobrescreve contacto, e-mail, nome nem foto já preenchidos
select is((select estado from pg_temp.reg('https://casayes.pt/s1', 'SOBRE-1', 'Imob S', 200000, 'T2', 'Lisboa', '+351911000001', '11111111-1111-1111-1111-1111111111aa.jpg', 'Lumiar', 'a@exemplo.pt', 'Primeiro')), 'novo', 'imóvel com dados completos');
select is((select estado from pg_temp.reg('https://casayes.pt/s1', 'SOBRE-1', 'Imob S', 200000, 'T2', 'Lisboa', '+351922000002', '22222222-2222-2222-2222-2222222222bb.jpg', 'Lumiar', 'b@exemplo.pt', 'Segundo')), 'atualizado', 'segundo registo do mesmo anúncio');
select is((select consultor_nome || '|' || telefone || '|' || email || '|' || foto_caminho from public.imoveis where referencia = 'SOBRE-1'), 'Primeiro|+351911000001|a@exemplo.pt|11111111-1111-1111-1111-1111111111aa.jpg', 'dados existentes não são sobrescritos (ramo atualizado)');
select is((select estado from pg_temp.reg('https://casa.sapo.pt/s2', 'SOBRE-1', 'Imob S', 210000, 'T2', 'Lisboa', '+351933000003', '33333333-3333-3333-3333-3333333333cc.jpg', 'Lumiar', 'c@exemplo.pt', 'Terceiro')), 'ligado', 'segundo portal liga por referência');
select is((select consultor_nome || '|' || telefone || '|' || email || '|' || foto_caminho from public.imoveis where referencia = 'SOBRE-1'), 'Primeiro|+351911000001|a@exemplo.pt|11111111-1111-1111-1111-1111111111aa.jpg', 'dados existentes não são sobrescritos (ramo ligado)');
select is((select preco from public.imoveis where referencia = 'SOBRE-1'), 200000::numeric, 'preço continua o mínimo dos anúncios');

select * from finish();
rollback;
