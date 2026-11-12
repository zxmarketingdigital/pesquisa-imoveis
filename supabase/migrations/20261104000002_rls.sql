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

create policy imoveis_ler on public.imoveis for select to authenticated using (true);
create policy imoveis_criar on public.imoveis for insert to authenticated with check (true);
create policy imoveis_editar on public.imoveis for update to authenticated using (true) with check (true);

create policy anuncios_ler on public.anuncios for select to authenticated using (true);
create policy anuncios_criar on public.anuncios for insert to authenticated with check (true);
create policy anuncios_editar on public.anuncios for update to authenticated using (true) with check (true);

create policy contactos_do_consultor on public.contactos for all to authenticated
  using (consultor_id = auth.uid() and exists (select 1 from public.compradores c where c.id = comprador_id and c.consultor_id = auth.uid()))
  with check (consultor_id = auth.uid() and exists (select 1 from public.compradores c where c.id = comprador_id and c.consultor_id = auth.uid()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos', 'fotos', true, 5242880, array['image/jpeg']);

create policy fotos_enviar on storage.objects for insert to authenticated
  with check (bucket_id = 'fotos');
