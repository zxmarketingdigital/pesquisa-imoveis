create function public.registar_anuncio(
  p_portal text, p_chave text, p_url text, p_referencia text, p_imobiliaria text,
  p_tipologia text, p_preco numeric, p_area numeric, p_concelho text, p_zona text,
  p_ano integer, p_nova boolean, p_garagem boolean, p_consultor text,
  p_telefone text, p_email text, p_foto_url text, p_origem text default 'manual'
) returns table (imovel_id uuid, estado text)
language plpgsql security invoker set search_path = public as $$
declare
  v_imovel uuid;
  v_novo boolean;
begin
  select a.imovel_id into v_imovel from anuncios a where a.portal = p_portal and a.chave_portal = p_chave;

  if v_imovel is not null then
    update imoveis i set
      preco = p_preco,
      area_m2 = coalesce(p_area, i.area_m2),
      ano_construcao = coalesce(p_ano, i.ano_construcao),
      construcao_nova = coalesce(p_nova, i.construcao_nova),
      garagem = coalesce(p_garagem, i.garagem),
      consultor_nome = coalesce(p_consultor, i.consultor_nome),
      telefone = coalesce(p_telefone, i.telefone),
      email = coalesce(p_email, i.email),
      foto_url = coalesce(p_foto_url, i.foto_url),
      ultima_vez = now()
    where i.id = v_imovel;
    update anuncios a set ultima_vez = now(), url = p_url
    where a.portal = p_portal and a.chave_portal = p_chave;
    return query select v_imovel, 'atualizado'::text;
    return;
  end if;

  insert into imoveis as i (referencia, imobiliaria, tipologia, preco, area_m2, concelho, zona,
    ano_construcao, construcao_nova, garagem, consultor_nome, telefone, email, foto_url, origem)
  values (nullif(trim(p_referencia), ''), p_imobiliaria, p_tipologia, p_preco, p_area, p_concelho, p_zona,
    p_ano, p_nova, p_garagem, p_consultor, p_telefone, p_email, p_foto_url, p_origem)
  on conflict (referencia_norm, imobiliaria_norm) where referencia_norm <> ''
  do update set
    ano_construcao = coalesce(i.ano_construcao, excluded.ano_construcao),
    construcao_nova = coalesce(i.construcao_nova, excluded.construcao_nova),
    garagem = coalesce(i.garagem, excluded.garagem),
    consultor_nome = coalesce(i.consultor_nome, excluded.consultor_nome),
    telefone = coalesce(i.telefone, excluded.telefone),
    email = coalesce(i.email, excluded.email),
    foto_url = coalesce(i.foto_url, excluded.foto_url),
    ultima_vez = now()
  returning i.id, (i.xmax = 0) into v_imovel, v_novo;

  insert into anuncios (imovel_id, portal, chave_portal, url)
  values (v_imovel, p_portal, p_chave, p_url);

  return query select v_imovel, case when v_novo then 'novo' else 'ligado' end;
end $$;

create function public.criar_comprador(
  p_nome text, p_contacto text, p_tipologia text, p_preco_max numeric,
  p_zonas text[], p_garagem_obrigatoria boolean, p_menos_de_anos integer
) returns uuid
language plpgsql security invoker set search_path = public as $$
declare v_id uuid;
begin
  insert into compradores (nome, contacto) values (p_nome, nullif(trim(p_contacto), '')) returning id into v_id;
  insert into pesquisas (comprador_id, tipologia, preco_max, zonas, garagem_obrigatoria, menos_de_anos)
  values (v_id, p_tipologia, p_preco_max, p_zonas, p_garagem_obrigatoria, p_menos_de_anos);
  return v_id;
end $$;

create function public.atualizar_pesquisa(p_pesquisa uuid) returns void
language sql security invoker set search_path = public as $$
  update pesquisas set novos_desde = now(), ultima_atualizacao = now()
  where id = p_pesquisa;
$$;

revoke execute on function public.registar_anuncio from anon, public;
revoke execute on function public.criar_comprador from anon, public;
revoke execute on function public.atualizar_pesquisa from anon, public;
grant execute on function public.registar_anuncio to authenticated, service_role;
grant execute on function public.criar_comprador to authenticated, service_role;
grant execute on function public.atualizar_pesquisa to authenticated, service_role;
