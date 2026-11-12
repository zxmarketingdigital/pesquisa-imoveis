begin;
select plan(27);

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000d1', 'dedup@teste.local');
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}';

create function pg_temp.reg(url text, ref text, imob text, preco numeric default 390000,
  tip text default 'T2', concelho text default 'Lisboa', telefone text default '+351900000001', foto text default null)
returns table (imovel_id uuid, estado text) language sql as $$
  select * from public.registar_anuncio(url, ref, imob, tip, preco, 80, concelho, 'Lumiar',
    2024, false, true, 'Marta Exemplo', telefone, null, foto)
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

select * from finish();
rollback;
