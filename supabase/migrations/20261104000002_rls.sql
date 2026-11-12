alter table public.compradores enable row level security;
alter table public.pesquisas enable row level security;
alter table public.imoveis enable row level security;
alter table public.anuncios enable row level security;
alter table public.contactos enable row level security;

revoke all on public.compradores, public.pesquisas, public.imoveis, public.anuncios, public.contactos from anon;

create policy compradores_do_consultor on public.compradores for all to authenticated
  using (consultor_id = auth.uid()) with check (consultor_id = auth.uid());

create policy pesquisas_do_consultor on public.pesquisas for all to authenticated
  using (exists (select 1 from public.compradores c where c.id = comprador_id and c.consultor_id = auth.uid()))
  with check (exists (select 1 from public.compradores c where c.id = comprador_id and c.consultor_id = auth.uid()));

-- PENDENTE RGPD: consultor_nome/telefone/email do anunciante são legíveis por todos os consultores.
-- Modelo mantido de propósito até decisão do Rafael; não alterar sem ela.
create policy imoveis_ler on public.imoveis for select to authenticated using (true);

create policy anuncios_ler on public.anuncios for select to authenticated using (true);

create policy contactos_do_consultor on public.contactos for all to authenticated
  using (consultor_id = auth.uid() and exists (select 1 from public.compradores c where c.id = comprador_id and c.consultor_id = auth.uid()))
  with check (consultor_id = auth.uid() and exists (select 1 from public.compradores c where c.id = comprador_id and c.consultor_id = auth.uid()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos', 'fotos', true, 5242880, array['image/jpeg'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy fotos_enviar on storage.objects for insert to authenticated
  with check (bucket_id = 'fotos'
    and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$');

-- O consultor só vê os seus objetos (o bucket é público para leitura por URL).
create policy fotos_ver_proprias on storage.objects for select to authenticated
  using (bucket_id = 'fotos' and owner_id = (select auth.uid())::text);

-- Sem policy de DELETE: nenhum consultor apaga fotos, nem as suas. Assim uma foto em uso por um imóvel
-- partilhado nunca some. Uploads órfãos limpam-se com a service role (fora da V1).

-- Nem a service role nem o dono do banco apagam uma foto em uso. O trigger corre depois de obter o lock da
-- linha e a consulta dentro da função usa snapshot nova: se a RPC registar_anuncio (que segura a foto com
-- FOR SHARE) confirmar primeiro, o delete vê o imóvel e falha. Limpeza de órfãos fica protegida por aqui.
create or replace function public.proteger_foto_em_uso() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.bucket_id = 'fotos' and exists (select 1 from public.imoveis i where i.foto_caminho = old.name) then
    raise exception 'foto em uso por um imóvel' using errcode = '23503';
  end if;
  return old;
end $$;
revoke all on function public.proteger_foto_em_uso() from public, anon, authenticated;

create trigger fotos_proteger_em_uso before delete on storage.objects
  for each row execute function public.proteger_foto_em_uso();
