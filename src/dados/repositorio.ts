import { supabase } from './cliente';
import type { Anuncio, Canal, Comprador, Contacto, Imovel, Pesquisa } from '../dominio/tipos';

const PAGINA = 1000; // teto de linhas do PostgREST por pedido

function erro(contexto: string, e: { message: string } | null): void {
  if (e) throw new Error(`${contexto}: ${e.message}`);
}

/* eslint-disable @typescript-eslint/no-explicit-any */
const paraPesquisa = (p: any): Pesquisa => ({
  id: p.id, compradorId: p.comprador_id, tipologia: p.tipologia, precoMax: Number(p.preco_max), zonas: p.zonas,
  garagemObrigatoria: p.garagem_obrigatoria, menosDeAnos: p.menos_de_anos,
  ultimaAtualizacao: p.ultima_atualizacao, novosDesde: p.novos_desde,
});

const paraImovel = (i: any): Imovel => ({
  id: i.id, referencia: i.referencia, imobiliaria: i.imobiliaria, tipologia: i.tipologia, preco: Number(i.preco),
  areaM2: i.area_m2 === null ? null : Number(i.area_m2), concelho: i.concelho, zona: i.zona,
  anoConstrucao: i.ano_construcao, construcaoNova: i.construcao_nova, garagem: i.garagem,
  consultorNome: i.consultor_nome, telefone: i.telefone, email: i.email, fotoUrl: i.foto_url,
  primeiraVez: i.primeira_vez,
  anuncios: (i.anuncios ?? []).map((a: any): Anuncio => ({ portal: a.portal, url: a.url })),
});
/* eslint-enable @typescript-eslint/no-explicit-any */

export async function listarCompradores(): Promise<Comprador[]> {
  const { data, error } = await supabase
    .from('compradores').select('id, nome, contacto, pesquisas(*)').order('criado_em');
  erro('Ler compradores', error);
  return (data ?? []).map((c) => {
    const pesquisa = Array.isArray(c.pesquisas) ? c.pesquisas[0] : c.pesquisas;
    return { id: c.id, nome: c.nome, contacto: c.contacto, pesquisa: paraPesquisa(pesquisa) };
  });
}

export interface NovoComprador {
  nome: string; contacto: string; tipologia: string; precoMax: number; zonas: string[];
  garagemObrigatoria: boolean; menosDeAnos: number | null;
}

export async function criarComprador(n: NovoComprador): Promise<string> {
  const { data, error } = await supabase.rpc('criar_comprador', {
    p_nome: n.nome, p_contacto: n.contacto, p_tipologia: n.tipologia, p_preco_max: n.precoMax,
    p_zonas: n.zonas, p_garagem_obrigatoria: n.garagemObrigatoria, p_menos_de_anos: n.menosDeAnos,
  });
  erro('Criar comprador', error);
  return data as string;
}

export async function imoveisCandidatos(p: Pesquisa): Promise<Imovel[]> {
  const todos: Imovel[] = [];
  for (let de = 0; ; de += PAGINA) {
    const { data, error } = await supabase
      .from('imoveis').select('*, anuncios(portal, url)')
      .eq('tipologia', p.tipologia).lte('preco', p.precoMax)
      .order('primeira_vez', { ascending: false }).order('id').range(de, de + PAGINA - 1);
    erro('Ler imóveis', error);
    const pagina = data ?? [];
    todos.push(...pagina.map(paraImovel));
    if (pagina.length < PAGINA) return todos;
  }
}

export interface NovoAnuncio {
  portal: string; chave: string; url: string; referencia: string; imobiliaria: string; tipologia: string;
  preco: number; areaM2: number | null; concelho: string; zona: string; ano: number | null; nova: boolean | null;
  garagem: boolean | null; consultor: string | null; telefone: string | null; email: string | null; fotoUrl: string | null;
}

export type EstadoRegisto = 'novo' | 'ligado' | 'atualizado';

export async function registarAnuncio(a: NovoAnuncio): Promise<{ imovelId: string; estado: EstadoRegisto }> {
  const { data, error } = await supabase.rpc('registar_anuncio', {
    p_portal: a.portal, p_chave: a.chave, p_url: a.url, p_referencia: a.referencia, p_imobiliaria: a.imobiliaria,
    p_tipologia: a.tipologia, p_preco: a.preco, p_area: a.areaM2, p_concelho: a.concelho, p_zona: a.zona,
    p_ano: a.ano, p_nova: a.nova, p_garagem: a.garagem, p_consultor: a.consultor, p_telefone: a.telefone,
    p_email: a.email, p_foto_url: a.fotoUrl, p_origem: 'manual',
  });
  erro('Registar anúncio', error);
  const linha = (data as Array<{ imovel_id: string; estado: EstadoRegisto }>)[0];
  if (!linha) throw new Error('Registar anúncio: resposta vazia');
  return { imovelId: linha.imovel_id, estado: linha.estado };
}

export async function atualizarPesquisa(pesquisaId: string): Promise<void> {
  const { error } = await supabase.rpc('atualizar_pesquisa', { p_pesquisa: pesquisaId });
  erro('Atualizar pesquisa', error);
}

export async function listarContactos(compradorId: string): Promise<Contacto[]> {
  const { data, error } = await supabase
    .from('contactos').select('id, imovel_id, canal, criado_em')
    .eq('comprador_id', compradorId).order('criado_em', { ascending: false }).range(0, PAGINA - 1);
  erro('Ler contactos', error);
  return (data ?? []).map((c) => ({ id: c.id, imovelId: c.imovel_id, canal: c.canal, criadoEm: c.criado_em }));
}

export async function registarContacto(compradorId: string, imovelId: string, canal: Canal, texto: string): Promise<string> {
  const { data, error } = await supabase.from('contactos')
    .insert({ comprador_id: compradorId, imovel_id: imovelId, canal, texto }).select('id').single();
  erro('Registar contacto', error);
  return data!.id;
}

export async function desfazerContacto(id: string): Promise<void> {
  const { error } = await supabase.from('contactos').delete().eq('id', id);
  erro('Desfazer contacto', error);
}
