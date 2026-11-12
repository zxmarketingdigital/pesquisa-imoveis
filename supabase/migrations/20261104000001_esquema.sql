create extension if not exists unaccent with schema extensions;

create function public.normalizar_nome(t text) returns text
language sql immutable parallel safe set search_path = '' as $$
  select trim(regexp_replace(lower(extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(t, ''))), '\s+', ' ', 'g'))
$$;

create function public.normalizar_referencia(t text) returns text
language sql immutable parallel safe set search_path = '' as $$
  select upper(regexp_replace(coalesce(t, ''), '\s+', '', 'g'))
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
  referencia text,
  referencia_norm text generated always as (public.normalizar_referencia(referencia)) stored,
  imobiliaria text not null check (char_length(trim(imobiliaria)) between 1 and 160),
  imobiliaria_norm text generated always as (public.normalizar_nome(imobiliaria)) stored,
  tipologia text not null check (tipologia in ('T0','T1','T2','T3','T4','T5+')),
  preco numeric(12,2) not null check (preco > 0),
  area_m2 numeric(8,2) check (area_m2 is null or area_m2 > 0),
  concelho text not null,
  zona text not null,
  ano_construcao integer check (ano_construcao is null or ano_construcao between 1800 and 2100),
  construcao_nova boolean,
  garagem boolean,
  consultor_nome text,
  telefone text,
  email text,
  foto_url text check (foto_url is null or foto_url ~* '^https?://'),
  origem text not null default 'manual' check (origem in ('manual','coletor')),
  primeira_vez timestamptz not null default now(),
  ultima_vez timestamptz not null default now()
);
create unique index imoveis_referencia_unica on public.imoveis (referencia_norm, imobiliaria_norm) where referencia_norm <> '';
create index imoveis_busca_idx on public.imoveis (tipologia, preco);

create table public.anuncios (
  id uuid primary key default gen_random_uuid(),
  imovel_id uuid not null references public.imoveis(id) on delete cascade,
  portal text not null check (portal in ('Imovirtual','Casa Sapo','CasaYes','Outro')),
  chave_portal text not null check (char_length(chave_portal) between 1 and 500),
  url text not null check (url ~* '^https?://'),
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
grant select, insert, update, delete on public.pesquisas to authenticated;
grant select, insert, update on public.imoveis to authenticated;   -- banco partilhado: sem delete
grant select, insert, update on public.anuncios to authenticated;  -- banco partilhado: sem delete
grant select, insert, delete on public.contactos to authenticated; -- "Desfazer" apaga; contacto não se edita
