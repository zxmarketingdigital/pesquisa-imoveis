create extension if not exists unaccent with schema extensions;

create function public.normalizar_nome(t text) returns text
language sql immutable parallel safe set search_path = '' as $$
  select trim(regexp_replace(lower(extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(t, ''))), '\s+', ' ', 'g'))
$$;

create function public.normalizar_referencia(t text) returns text
language sql immutable parallel safe set search_path = '' as $$
  select upper(regexp_replace(coalesce(t, ''), '\s+', '', 'g'))
$$;

-- Chave de dedup calculada no servidor: o cliente nunca decide o que é "o mesmo anúncio".
-- minúsculas no host, sem protocolo/credenciais/porta, sem www./m., sem fragmento,
-- sem utm_*/fbclid/gclid, parâmetros restantes ordenados, sem barra final.
create function public.normalizar_url(u text) returns text
language plpgsql immutable parallel safe set search_path = '' as $$
declare
  s text := split_part(trim(coalesce(u, '')), '#', 1);
  v_resto text; v_query text := ''; v_host text; v_path text; v_params text;
begin
  s := regexp_replace(s, '^[a-zA-Z][a-zA-Z0-9+.-]*://', '');
  v_resto := split_part(s, '?', 1);
  if position('?' in s) > 0 then v_query := substr(s, position('?' in s) + 1); end if;
  v_host := split_part(v_resto, '/', 1);
  v_path := substr(v_resto, length(v_host) + 1);
  v_host := lower(regexp_replace(regexp_replace(v_host, '^[^@]*@', ''), ':\d*$', ''));
  v_host := regexp_replace(v_host, '^(www|m)\.', '');
  v_path := regexp_replace(v_path, '/+$', '');
  select coalesce(string_agg(p, '&' order by p collate "C"), '') into v_params
  from unnest(string_to_array(v_query, '&')) as p
  where p <> '' and lower(split_part(p, '=', 1)) !~ '^(utm_.*|fbclid|gclid)$';
  return v_host || v_path || case when v_params <> '' then '?' || v_params else '' end;
end $$;

-- Referência "útil": placeholders (S/R, N/D, -, 0, 1, só pontuação, <3 alfanuméricos) contam como vazia.
create function public.referencia_util(t text) returns text
language sql immutable parallel safe set search_path = '' as $$
  select case when char_length(regexp_replace(coalesce(t, ''), '[^[:alnum:]]', '', 'g')) >= 3 then nullif(trim(t), '') end
$$;

create function public.portal_da_chave(k text) returns text
language sql immutable parallel safe set search_path = '' as $$
  select case
    when split_part(split_part(k, '?', 1), '/', 1) ~ '(^|\.)imovirtual\.com$' then 'Imovirtual'
    when split_part(split_part(k, '?', 1), '/', 1) ~ '(^|\.)casa\.sapo\.pt$' then 'Casa Sapo'
    when split_part(split_part(k, '?', 1), '/', 1) ~ '(^|\.)casayes\.pt$' then 'CasaYes'
    else 'Outro'
  end
$$;

create table public.compradores (
  id uuid primary key default gen_random_uuid(),
  consultor_id uuid not null default auth.uid() references auth.users(id) on delete restrict,
  nome text not null check (char_length(trim(nome)) between 1 and 120),
  contacto text check (contacto is null or char_length(contacto) <= 160),
  criado_em timestamptz not null default now()
);
create index compradores_consultor_idx on public.compradores (consultor_id);

create table public.pesquisas (
  id uuid primary key default gen_random_uuid(),
  comprador_id uuid not null unique references public.compradores(id) on delete cascade,
  tipologia text not null check (tipologia in ('T0','T1','T2','T3','T4','T5+')),
  preco_max numeric(12,2) not null check (preco_max > 0),
  zonas text[] not null check (cardinality(zonas) > 0),
  garagem_obrigatoria boolean not null default false,
  menos_de_anos integer check (menos_de_anos is null or menos_de_anos between 1 and 100),
  ultima_atualizacao timestamptz not null default now(),
  novos_desde timestamptz -- corte do selo "Novo"; nulo = tudo é novo nesta pesquisa
);

create table public.imoveis (
  id uuid primary key default gen_random_uuid(),
  referencia text check (referencia is null or char_length(referencia) <= 80),
  referencia_norm text generated always as (public.normalizar_referencia(referencia)) stored,
  imobiliaria text not null check (char_length(trim(imobiliaria)) between 1 and 160),
  imobiliaria_norm text generated always as (public.normalizar_nome(imobiliaria)) stored,
  tipologia text not null check (tipologia in ('T0','T1','T2','T3','T4','T5+')),
  preco numeric(12,2) not null check (preco > 0),
  area_m2 numeric(8,2) check (area_m2 is null or area_m2 > 0),
  concelho text not null check (char_length(concelho) between 1 and 120),
  concelho_norm text generated always as (public.normalizar_nome(concelho)) stored,
  zona text not null check (char_length(zona) between 1 and 120),
  ano_construcao integer check (ano_construcao is null or ano_construcao between 1800 and 2100),
  construcao_nova boolean,
  garagem boolean,
  consultor_nome text check (consultor_nome is null or char_length(consultor_nome) <= 160),
  telefone text check (telefone is null or char_length(telefone) <= 40),
  email text check (email is null or char_length(email) <= 254),
  -- só o caminho do ficheiro no bucket `fotos` (<uuid>.jpg); o cliente monta o URL público.
  -- Assim nenhum consultor consegue apontar a foto para um host externo.
  foto_caminho text check (foto_caminho is null or foto_caminho ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$'),
  origem text not null default 'manual' check (origem in ('manual','coletor')),
  primeira_vez timestamptz not null default now(),
  ultima_vez timestamptz not null default now()
);
-- Só liga por referência quando imobiliária, tipologia e concelho coincidem (referências repetem-se entre imóveis diferentes).
create unique index imoveis_referencia_unica on public.imoveis (referencia_norm, imobiliaria_norm, tipologia, concelho_norm) where referencia_norm <> '';
create index imoveis_busca_idx on public.imoveis (tipologia, preco);

create table public.anuncios (
  id uuid primary key default gen_random_uuid(),
  imovel_id uuid not null references public.imoveis(id) on delete cascade,
  portal text not null check (portal in ('Imovirtual','Casa Sapo','CasaYes','Outro')),
  preco numeric(12,2) not null check (preco > 0), -- imoveis.preco = mínimo dos preços dos anúncios
  chave_portal text not null check (char_length(chave_portal) between 1 and 500),
  url text not null check (url ~* '^https?://' and char_length(url) <= 2000),
  primeira_vez timestamptz not null default now(),
  ultima_vez timestamptz not null default now(),
  unique (portal, chave_portal)
);
create index anuncios_imovel_idx on public.anuncios (imovel_id);

create table public.contactos (
  id uuid primary key default gen_random_uuid(),
  comprador_id uuid not null references public.compradores(id) on delete cascade,
  imovel_id uuid not null references public.imoveis(id) on delete cascade,
  canal text not null check (canal in ('whatsapp','email')),
  texto text not null,
  consultor_id uuid not null default auth.uid() references auth.users(id) on delete restrict,
  criado_em timestamptz not null default now()
);
create index contactos_comprador_idx on public.contactos (comprador_id, imovel_id);

-- Permissões explícitas: desde 30/Out/26 o Supabase não dá GRANT automático a tabela
-- nova no schema public. Parte do zero e dá só o que o app usa; a RLS (migration 2) filtra as linhas.
revoke all on public.compradores, public.pesquisas, public.imoveis, public.anuncios, public.contactos from anon, authenticated;

grant select, insert, update, delete on public.compradores, public.pesquisas, public.imoveis, public.anuncios, public.contactos to service_role;

grant select, insert, update, delete on public.compradores to authenticated;
grant select, insert, update on public.pesquisas to authenticated; -- o app não apaga pesquisa (cai com o comprador por cascata)
-- Banco partilhado: só leitura direta. A escrita em imoveis/anuncios passa SEMPRE pela RPC registar_anuncio.
grant select on public.imoveis to authenticated;
grant select on public.anuncios to authenticated;
grant select, insert, delete on public.contactos to authenticated; -- "Desfazer" apaga; contacto não se edita

-- Funções auxiliares só servem a RPC (que corre como dono) e aos defaults/colunas geradas.
revoke execute on function public.normalizar_nome(text), public.normalizar_referencia(text),
  public.normalizar_url(text), public.portal_da_chave(text), public.referencia_util(text) from public, anon, authenticated;
