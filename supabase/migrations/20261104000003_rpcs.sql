-- Única porta de escrita em imoveis/anuncios (authenticated só tem SELECT nessas tabelas).
-- security definer + search_path vazio: corre como dono, por isso tudo vai qualificado.
-- Portal e chave de dedup são calculados aqui a partir do URL; o cliente não os decide.
create function public.registar_anuncio(
  p_url text, p_referencia text, p_imobiliaria text,
  p_tipologia text, p_preco numeric, p_area numeric, p_concelho text, p_zona text,
  p_ano integer, p_nova boolean, p_garagem boolean, p_consultor text,
  p_telefone text, p_email text, p_foto_caminho text
) returns table (imovel_id uuid, estado text)
language plpgsql security definer set search_path = '' as $$
declare
  v_url text := trim(coalesce(p_url, ''));
  v_chave text;
  v_portal text;
  v_ref text := public.referencia_util(p_referencia);
  v_consultor text := nullif(trim(p_consultor), '');
  v_telefone text := nullif(trim(p_telefone), '');
  v_email text := nullif(trim(p_email), '');
  v_foto text := nullif(trim(p_foto_caminho), '');
  v_imovel uuid;
  v_novo boolean;
  v_estado text;
begin
  if auth.uid() is null then
    raise exception 'sessão em falta' using errcode = '42501';
  end if;
  -- aceita URL colado sem protocolo; recusa outros esquemas (javascript:, data:, ftp://...)
  if v_url = '' or v_url ~ '[[:space:]<>"]'
     or (v_url ~* '^([a-z][a-z0-9+.-]*://|(javascript|data|vbscript|file|mailto):)' and v_url !~* '^https?://') then
    raise exception 'URL de anúncio inválido' using errcode = '22023';
  end if;
  if v_url !~* '^https?://' then v_url := 'https://' || v_url; end if;
  -- "\" em qualquer parte e "@"/%40/%5c na autoridade desviam o host (ver normalizar_url)
  if v_url ~ '\\' or split_part(split_part(split_part(regexp_replace(v_url, '^https?://', '', 'i'), '#', 1), '?', 1), '/', 1) ~* '[@\\]|%40|%5c' then
    raise exception 'URL de anúncio inválido' using errcode = '22023';
  end if;
  v_chave := public.normalizar_url(v_url);
  v_portal := public.portal_da_chave(v_chave);
  -- serializa registos do mesmo anúncio (evita imóvel órfão em corrida)
  perform pg_advisory_xact_lock(hashtextextended(v_portal || '|' || v_chave, 0));

  select a.imovel_id into v_imovel from public.anuncios a
  where a.portal = v_portal and a.chave_portal = v_chave;

  if v_imovel is not null then
    -- Decisão: o banco é partilhado, por isso um registo nunca sobrescreve dados de outro.
    -- Telefone, e-mail, nome do anunciante e foto só se preenchem quando estão vazios.
    -- O preço é por anúncio (imoveis.preco = mínimo). Área, ano, nova e garagem só são
    -- atualizados com valores não nulos. O url só muda se o anúncio guardado tiver a mesma chave
    -- (o mesmo host), para um registo nunca trocar o link para outro domínio.
    update public.anuncios a set preco = p_preco,
      url = case when public.normalizar_url(a.url) = v_chave then v_url else a.url end,
      ultima_vez = now()
    where a.portal = v_portal and a.chave_portal = v_chave;
    update public.imoveis i set
      area_m2 = coalesce(p_area, i.area_m2),
      ano_construcao = coalesce(p_ano, i.ano_construcao),
      construcao_nova = coalesce(p_nova, i.construcao_nova),
      garagem = coalesce(p_garagem, i.garagem),
      consultor_nome = coalesce(i.consultor_nome, v_consultor),
      telefone = coalesce(i.telefone, v_telefone),
      email = coalesce(i.email, v_email),
      foto_caminho = coalesce(i.foto_caminho, v_foto),
      ultima_vez = now()
    where i.id = v_imovel;
    v_estado := 'atualizado';
  else
    insert into public.imoveis as i (referencia, imobiliaria, tipologia, preco, area_m2, concelho, zona,
      ano_construcao, construcao_nova, garagem, consultor_nome, telefone, email, foto_caminho, origem)
    values (v_ref, p_imobiliaria, p_tipologia, p_preco, p_area, p_concelho, p_zona,
      p_ano, p_nova, p_garagem, v_consultor, v_telefone, v_email, v_foto, 'manual')
    on conflict (referencia_norm, imobiliaria_norm, tipologia, concelho_norm, zona_norm) where referencia_norm <> ''
    do update set
      area_m2 = coalesce(i.area_m2, excluded.area_m2),
      ano_construcao = coalesce(i.ano_construcao, excluded.ano_construcao),
      construcao_nova = coalesce(i.construcao_nova, excluded.construcao_nova),
      garagem = coalesce(i.garagem, excluded.garagem),
      consultor_nome = coalesce(i.consultor_nome, excluded.consultor_nome),
      telefone = coalesce(i.telefone, excluded.telefone),
      email = coalesce(i.email, excluded.email),
      foto_caminho = coalesce(i.foto_caminho, excluded.foto_caminho),
      ultima_vez = now()
    returning i.id, (i.xmax = 0) into v_imovel, v_novo;

    insert into public.anuncios (imovel_id, portal, chave_portal, url, preco)
    values (v_imovel, v_portal, v_chave, v_url, p_preco)
    on conflict (portal, chave_portal) do nothing;
    v_estado := case when v_novo then 'novo' else 'ligado' end;
  end if;

  -- regra única de preço: o do imóvel é o mínimo dos preços dos seus anúncios
  update public.imoveis i set preco = (select min(a.preco) from public.anuncios a where a.imovel_id = i.id)
  where i.id = v_imovel;

  return query select v_imovel, v_estado;
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
grant execute on function public.registar_anuncio to authenticated;
grant execute on function public.criar_comprador to authenticated, service_role;
grant execute on function public.atualizar_pesquisa to authenticated, service_role;
