begin;
select plan(9);

create function pg_temp.reg(portal text, chave text, ref text, imob text, preco numeric default 390000)
returns table (imovel_id uuid, estado text) language sql as $$
  select * from public.registar_anuncio(
    portal, chave, 'https://exemplo.pt/' || chave, ref, imob, 'T2', preco, 80, 'Lisboa', 'Lumiar',
    2024, false, true, 'Marta Exemplo', '+351900000001', null, null, 'manual')
$$;

select is((select estado from pg_temp.reg('Imovirtual','a1','REF 1','Imobiliária Norte')), 'novo', 'primeiro anúncio cria imóvel');
select is((select estado from pg_temp.reg('Imovirtual','a1','REF 1','Imobiliária Norte', 380000)), 'atualizado', 'mesmo portal e chave atualiza');
select is((select preco from public.imoveis where referencia_norm = 'REF1'), 380000::numeric, 'preço atualizado');
select is((select estado from pg_temp.reg('Casa Sapo','b1','ref1','imobiliaria  norte')), 'ligado', 'mesma referência e imobiliária noutro portal liga');
select is((select count(*) from public.imoveis), 1::bigint, 'continua um imóvel');
select is((select count(*) from public.anuncios), 2::bigint, 'com dois links');
select is((select estado from pg_temp.reg('CasaYes','c1','REF 1','Outra Imobiliária')), 'novo', 'mesma referência noutra imobiliária separa');
select is((select estado from pg_temp.reg('CasaYes','c2',null,'Imobiliária Norte')), 'novo', 'sem referência é novo');
select is((select estado from pg_temp.reg('Outro','c3','','Imobiliária Norte')), 'novo', 'referência vazia não liga');

select * from finish();
rollback;
