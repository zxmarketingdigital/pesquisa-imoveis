import { supabase } from './cliente';
import { urlDaFoto } from './fotos';
import type { Anuncio, Canal, Comprador, Contacto, Imovel, Pesquisa } from '../dominio/tipos';

const PAGINA = 1000; // teto de linhas do PostgREST por pedido

/** Lê todas as páginas de uma consulta (o PostgREST devolve no máximo 1000 linhas por pedido). */
async function todasAsPaginas<T>(
  contexto: string,
  pedido: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  // Só pára numa página vazia: se o projeto limitar `max_rows` abaixo de PAGINA, uma página curta não é o fim.
  const todos: T[] = [];
  for (let de = 0; ; ) {
    const { data, error } = await pedido(de, de + PAGINA - 1);
    erro(contexto, error);
    const pagina = data ?? [];
    if (pagina.length === 0) return todos;
    todos.push(...pagina);
    de += pagina.length;
  }
}

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
  consultorNome: i.consultor_nome, telefone: i.telefone, email: i.email, fotoUrl: urlDaFoto(i.foto_caminho),
  primeiraVez: i.primeira_vez,
  anuncios: (i.anuncios ?? []).map((a: any): Anuncio => ({ portal: a.portal, url: a.url, preco: a.preco === undefined ? undefined : Number(a.preco) })),
});
/* eslint-enable @typescript-eslint/no-explicit-any */

export async function listarCompradores(): Promise<Comprador[]> {
  const linhas = await todasAsPaginas('Ler compradores', (de, ate) => supabase
    .from('compradores').select('id, nome, contacto, pesquisas(*)').order('criado_em').order('id').range(de, ate));
  const compradores: Comprador[] = [];
  for (const c of linhas) {
    const pesquisa = Array.isArray(c.pesquisas) ? c.pesquisas[0] : c.pesquisas;
    if (!pesquisa) continue; // comprador sem pesquisa (não devia existir) não rebenta a lista
    compradores.push({ id: c.id, nome: c.nome, contacto: c.contacto, pesquisa: paraPesquisa(pesquisa) });
  }
  return compradores;
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
  const linhas = await todasAsPaginas('Ler imóveis', (de, ate) => supabase
    .from('imoveis').select('*, anuncios(portal, url, preco, primeira_vez)')
    .eq('tipologia', p.tipologia).lte('preco', p.precoMax)
    .order('primeira_vez', { ascending: false }).order('id')
    .order('primeira_vez', { referencedTable: 'anuncios' }).range(de, ate));
  return linhas.map(paraImovel);
}

export interface NovoAnuncio {
  url: string; referencia: string; imobiliaria: string; tipologia: string;
  preco: number; areaM2: number | null; concelho: string; zona: string; ano: number | null; nova: boolean | null;
  garagem: boolean | null; consultor: string | null; telefone: string | null; email: string | null;
  fotoCaminho: string | null; // caminho devolvido por enviarFoto

}

export type EstadoRegisto = 'novo' | 'ligado' | 'atualizado';

export async function registarAnuncio(a: NovoAnuncio): Promise<{ imovelId: string; estado: EstadoRegisto }> {
  const { data, error } = await supabase.rpc('registar_anuncio', {
    p_url: a.url, p_referencia: a.referencia, p_imobiliaria: a.imobiliaria,
    p_tipologia: a.tipologia, p_preco: a.preco, p_area: a.areaM2, p_concelho: a.concelho, p_zona: a.zona,
    p_ano: a.ano, p_nova: a.nova, p_garagem: a.garagem, p_consultor: a.consultor, p_telefone: a.telefone,
    p_email: a.email, p_foto_caminho: a.fotoCaminho,
  });
  erro('Registar anúncio', error);
  const linha = (data as Array<{ imovel_id: string; estado: EstadoRegisto }>)[0];
  if (!linha) throw new Error('Registar anúncio: resposta vazia');
  return { imovelId: linha.imovel_id, estado: linha.estado };
}

export async function atualizarPesquisa(pesquisaId: string): Promise<void> {
  const { data, error } = await supabase.from('pesquisas')
    .update({ novos_desde: new Date().toISOString(), ultima_atualizacao: new Date().toISOString() })
    .eq('id', pesquisaId).select('id');
  erro('Atualizar pesquisa', error);
  if (!data?.length) throw new Error('Atualizar pesquisa: nenhuma pesquisa foi atualizada');
}

export async function listarContactos(compradorId: string): Promise<Contacto[]> {
  const linhas = await todasAsPaginas('Ler contactos', (de, ate) => supabase
    .from('contactos').select('id, imovel_id, canal, criado_em')
    .eq('comprador_id', compradorId).order('criado_em', { ascending: false }).order('id').range(de, ate));
  return linhas.map((c) => ({ id: c.id, imovelId: c.imovel_id, canal: c.canal, criadoEm: c.criado_em }));
}

export async function registarContacto(compradorId: string, imovelId: string, canal: Canal, texto: string): Promise<string> {
  const { data, error } = await supabase.from('contactos')
    .insert({ comprador_id: compradorId, imovel_id: imovelId, canal, texto }).select('id').single();
  erro('Registar contacto', error);
  return data!.id;
}

export async function desfazerContacto(id: string): Promise<void> {
  const { data, error } = await supabase.from('contactos').delete().eq('id', id).select('id');
  erro('Desfazer contacto', error);
  if (!data?.length) throw new Error('Desfazer contacto: nenhum contacto foi apagado');
}
