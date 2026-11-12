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

-- O consultor pode apagar as suas próprias fotos (ex.: upload órfão). Quota por utilizador: fora da V1.
create policy fotos_apagar_proprias on storage.objects for delete to authenticated
  using (bucket_id = 'fotos' and owner_id = (select auth.uid())::text);
