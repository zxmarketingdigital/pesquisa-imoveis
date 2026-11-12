import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { terminarSessao } from './sessao';
import { obterFoto } from '../dados/fotos';
import { atualizarPesquisa, imoveisCandidatos, listarCompradores, listarContactos, type EstadoRegisto } from '../dados/repositorio';
import { avaliar, ehNovo } from '../dominio/criterios';
import { gerarCSV, gerarXLSX, type LinhaExportacao } from '../dominio/exportacao';
import { formatarPreco } from '../dominio/mensagens';
import type { Comprador, Contacto, Imovel } from '../dominio/tipos';
import { FormAnuncio } from './FormAnuncio';
import { FormComprador } from './FormComprador';
import { PainelContacto } from './PainelContacto';
import { TabelaImoveis } from './TabelaImoveis';
import { anoTexto, ErroPedido, garagemTexto, mensagemErro, urlSegura, type LinhaImovel } from './auxiliares';

type Filtro = 'todos' | 'novos' | 'pendentes' | 'confirmar';
const filtros: [Filtro,string][] = [['todos','Todos'],['novos','Novos'],['pendentes','Por contactar'],['confirmar','A confirmar']];
const estados: Record<EstadoRegisto,string> = { novo:'Imóvel novo', ligado:'Ligado a imóvel já registado', atualizado:'Imóvel atualizado' };

function descarregar(dados: BlobPart, tipo: string, extensao: string) {
  const url = URL.createObjectURL(new Blob([dados],{type:tipo}));
  const a = document.createElement('a'); a.href = url; a.download = `imoveis-${new Date().toISOString().slice(0,10)}.${extensao}`;
  try { document.body.appendChild(a); a.click(); } finally { a.remove(); window.setTimeout(() => URL.revokeObjectURL(url),1000); }
}
export function Mesa() {
  const [compradores, setCompradores] = useState<Comprador[]>([]);
  const [compradorId, setCompradorId] = useState<string | null>(null);
  const pretendido = useRef<string | null>(null);
  const compradorAtual = useRef(compradorId);
  compradorAtual.current = compradorId;
  const [imoveis, setImoveis] = useState<Imovel[]>([]);
  const [contactos, setContactos] = useState<Contacto[]>([]);
  const [listaVersao, setListaVersao] = useState(0);
  const [dadosVersao, setDadosVersao] = useState(0);
  const [lerLista, setLerLista] = useState(true);
  const [lerDados, setLerDados] = useState(false);
  const [erroLista, setErroLista] = useState('');
  const [erroDados, setErroDados] = useState('');
  const [erroAcao, setErroAcao] = useState('');
  const repetirAcao = useRef<() => void>(() => {});
  const [ocupado, setOcupado] = useState(false);
  const [exportando, setExportando] = useState(false);
  const montado = useRef(false);
  const exportacao = useRef(0);
  useEffect(() => { montado.current = true; return () => { montado.current = false; exportacao.current += 1; }; },[]);
  const [status, setStatus] = useState('');
  const [dialogo, setDialogo] = useState<'comprador' | 'anuncio' | null>(null);
  const [aberto, setAberto] = useState<string | null>(null);
  const origem = useRef<HTMLElement | null>(null);
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [query, setQuery] = useState('');
  const [selecionados, setSelecionados] = useState(new Set<string>());
  const comprador = compradores.find(c => c.id === compradorId);
  const pesquisa = comprador?.pesquisa;
  const fecharPainel = useCallback(() => { setAberto(null); requestAnimationFrame(() => { if (origem.current?.isConnected) origem.current.focus({preventScroll:true}); }); },[]);

  useEffect(() => {
    let ativo = true; setLerLista(true); setErroLista('');
    void listarCompradores().then(lista => { if (!ativo) return; setCompradores(lista); setCompradorId(id => { const candidato = pretendido.current ?? id; pretendido.current = null; return lista.some(c => c.id === candidato) ? candidato : lista[0]?.id ?? null; }); }).catch(e => { if (ativo) setErroLista(mensagemErro(e)); }).finally(() => { if (ativo) setLerLista(false); });
    return () => { ativo = false; };
  },[listaVersao]);
  useEffect(() => {
    let ativo = true; setImoveis([]); setContactos([]); setErroDados('');
    if (!pesquisa || !compradorId) { setLerDados(false); return; }
    setLerDados(true);
    void Promise.all([imoveisCandidatos(pesquisa),listarContactos(compradorId)]).then(([lista,historico]) => { if (ativo) { setImoveis(lista); setContactos(historico); } }).catch(e => { if (ativo) setErroDados(mensagemErro(e)); }).finally(() => { if (ativo) setLerDados(false); });
    return () => { ativo = false; };
  },[pesquisa,compradorId,dadosVersao]);
  const linhas = useMemo<LinhaImovel[]>(() => {
    if (!pesquisa) return [];
    const recentes = new Map<string,Contacto>();
    for (const c of contactos) if (!recentes.has(c.imovelId) || new Date(c.criadoEm) > new Date(recentes.get(c.imovelId)!.criadoEm)) recentes.set(c.imovelId,c);
    return imoveis.flatMap(imovel => { const a = avaliar(imovel,pesquisa,new Date().getFullYear()); return a.entra ? [{imovel,aConfirmar:a.aConfirmar,novo:ehNovo(imovel.primeiraVez,pesquisa.novosDesde),contacto:recentes.get(imovel.id)}] : []; });
  },[imoveis,pesquisa,contactos]);
  useEffect(() => { const ids = new Set(linhas.map(l => l.imovel.id)); setSelecionados(s => new Set([...s].filter(id => ids.has(id)))); },[linhas]);
  const filtrar = (l: LinhaImovel, f: Filtro) => f === 'todos' || (f === 'novos' && l.novo) || (f === 'pendentes' && !l.contacto) || (f === 'confirmar' && l.aConfirmar.length > 0);
  const normalizar = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-PT');
  const visiveis = linhas.filter(l => filtrar(l,filtro) && normalizar([l.imovel.referencia,l.imovel.zona,l.imovel.consultorNome,l.imovel.imobiliaria].join(' ')).includes(normalizar(query)));
  const linhaAberta = linhas.find(l => l.imovel.id === aberto);
  const exportadas = selecionados.size ? linhas.filter(l => selecionados.has(l.imovel.id)) : visiveis;
  function escolher(id: string) { if (exportando) return; setCompradorId(id); setAberto(null); setFiltro('todos'); setQuery(''); setSelecionados(new Set()); setStatus(''); setErroAcao(''); }
  async function atualizar() {
    if (!pesquisa || ocupado) return; setOcupado(true); setErroAcao('');
    try { await atualizarPesquisa(pesquisa.id); setListaVersao(n => n + 1); setStatus('Pesquisa atualizada.'); }
    catch(e) { setErroAcao(mensagemErro(e)); repetirAcao.current = () => void atualizar(); }
    finally { setOcupado(false); }
  }
  async function sair() {
    if (ocupado) return; setOcupado(true); setErroAcao('');
    try { await terminarSessao(); }
    catch(e) { setErroAcao(mensagemErro(e)); repetirAcao.current = () => void sair(); }
    finally { setOcupado(false); }
  }
  async function exportar(formato: 'csv' | 'xlsx') {
    if (!comprador || exportando) return;
    if (!exportadas.length) { setStatus('Não há imóveis para exportar.'); return; }
    setExportando(true); setErroAcao(''); setStatus('A preparar ficheiro…');
    const geracao = ++exportacao.current;
    const atual = () => montado.current && compradorAtual.current === comprador.id && exportacao.current === geracao;
    const dados: LinhaExportacao[] = exportadas.map(l => { const i = l.imovel; return { comprador:comprador.nome, referencia:i.referencia ?? '',portais:i.anuncios.map(a => a.portal).join(', '),tipologia:i.tipologia,preco:i.preco,areaM2:i.areaM2,concelho:i.concelho,zona:i.zona,ano:anoTexto(i),garagem:garagemTexto(i),consultor:i.consultorNome ?? 'Consultor não indicado',imobiliaria:i.imobiliaria,telefone:i.telefone ?? '',email:i.email ?? '',estado:l.contacto ? 'Contactado' : 'Por contactar',fotoUrl:urlSegura(i.fotoUrl) ?? '',links:i.anuncios.flatMap(a => urlSegura(a.url) ? [urlSegura(a.url)!] : []).join(' ') }; });
    try {
      if (formato === 'csv') { descarregar(gerarCSV(dados),'text/csv;charset=utf-8','csv'); setStatus(`CSV preparado com ${dados.length} imóveis.`); }
      else { const r = await gerarXLSX(dados,obterFoto); if (!atual()) return; descarregar(r.dados,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','xlsx'); setStatus(`Excel preparado com ${dados.length} imóveis.${r.semFoto > 0 ? ` ${r.semFoto} fotografias ficaram de fora.` : ''}`); }
    } catch(e) { if (atual()) { setErroAcao(mensagemErro(e)); repetirAcao.current = () => void exportar(formato); } }
    finally { if (atual()) setExportando(false); }
  }
  function aoContacto(origemId: string, c: Contacto | null, apagado?: string) { if (origemId !== compradorAtual.current) return; setContactos(lista => c ? [c,...lista] : lista.filter(item => item.id !== apagado)); }
  const carregando = lerLista || lerDados;
  return <div className="app"><header className="topbar"><div className="brand"><div className="brand-mark" aria-hidden="true">ZX</div><div><h1>Mesa do Consultor</h1><p>Pesquisa e contactos num só lugar</p></div></div><button onClick={() => void sair()} disabled={ocupado || exportando}>Sair</button></header><div className="workspace"><aside className="sidebar" aria-label="Lista de compradores"><div className="sidebar-heading"><h2 className="eyebrow">Compradores</h2><span className="mono muted">{compradores.length}</span></div><div className="buyers-list">{compradores.map(c => <button key={c.id} className={`buyer-card ${c.id === compradorId ? 'active' : ''}`} aria-pressed={c.id === compradorId} disabled={exportando} onClick={() => escolher(c.id)}><span className="buyer-top"><span className="buyer-name">{c.nome}</span></span><span className="buyer-summary">{c.pesquisa.tipologia} · até {formatarPreco(c.pesquisa.precoMax)}<br />{c.pesquisa.zonas.map(z => z.split('/')[1]).join(', ')}<br />{c.pesquisa.garagemObrigatoria ? 'Com garagem' : 'Garagem indiferente'}<br />{c.pesquisa.menosDeAnos === null ? 'Sem limite de idade' : `Menos de ${c.pesquisa.menosDeAnos} anos`}</span></button>)}</div><button id="new-buyer" disabled={exportando} onClick={() => setDialogo('comprador')}>Novo comprador</button><div className="sidebar-note"><strong>Uma pesquisa por comprador.</strong>Os contactos ficam associados a cada comprador. Prepare a próxima conversa com os critérios à mão.</div></aside><main className="main"><section className="search-heading"><div className="heading-top"><div><div className="eyebrow">Pesquisa ativa</div><h2>{comprador ? `${comprador.nome} · ${pesquisa!.tipologia} até ${formatarPreco(pesquisa!.precoMax)}` : 'Comece por um comprador'}</h2>{pesquisa && <p>{pesquisa.zonas.join(', ')} · {pesquisa.garagemObrigatoria ? 'Com garagem' : 'Garagem indiferente'} · {pesquisa.menosDeAnos === null ? 'Sem limite de idade' : `Menos de ${pesquisa.menosDeAnos} anos`}</p>}</div><div className="heading-actions"><button className="primary" disabled={!pesquisa || ocupado || carregando} onClick={() => void atualizar()}>Atualizar agora</button><button onClick={() => setDialogo('anuncio')}>Registar anúncio</button><button disabled={!comprador || carregando || exportando} onClick={() => void exportar('csv')}>Exportar CSV</button><button disabled={!comprador || carregando || exportando} onClick={() => void exportar('xlsx')}>Exportar Excel</button></div></div>{pesquisa && <div className="schedule">Última atualização: <time dateTime={pesquisa.ultimaAtualizacao}>{new Date(pesquisa.ultimaAtualizacao).toLocaleString('pt-PT')}</time></div>}</section><p className="notice">Nenhum portal autorizado: registo manual. A atualização automática entra com o primeiro portal autorizado.</p><div className="notice" role="status" aria-live="polite">{status}</div>{erroLista && <ErroPedido erro={erroLista} repetir={() => setListaVersao(n => n+1)} />}{erroDados && <ErroPedido erro={erroDados} repetir={() => setDadosVersao(n => n+1)} />}{erroAcao && <ErroPedido erro={erroAcao} repetir={() => repetirAcao.current()} ocupado={ocupado || exportando} />}<div className="data-area"><section className="results" aria-label="Imóveis da pesquisa"><div className="filters"><div className="filter-tabs" aria-label="Filtrar imóveis">{filtros.map(([f,nome]) => <button key={f} aria-pressed={filtro === f} onClick={() => setFiltro(f)}>{nome}<span className="tab-count">{linhas.filter(l => filtrar(l,f)).length}</span></button>)}</div><label className="search-box"><input type="search" aria-label="Pesquisar imóveis" placeholder="Pesquisar referência, zona, consultor…" value={query} onChange={e => setQuery(e.target.value)} /></label></div>{selecionados.size > 0 && <div className="selection-bar"><strong>{selecionados.size} selecionados</strong><button onClick={() => setSelecionados(new Set())}>Limpar seleção</button></div>}<div className="export-scope"><span>{selecionados.size ? `Exportar ${exportadas.length} selecionados · seleção mantida entre filtros` : `Exportar os ${visiveis.length} imóveis visíveis`}</span></div>{carregando ? <p className="loading" role="status">A carregar…</p> : comprador ? <TabelaImoveis linhas={visiveis} selecionados={selecionados} selecionar={setSelecionados} aberto={aberto ?? undefined} abrir={(id,el) => { origem.current = el; setAberto(id); }} /> : <div className="empty"><h3>Crie a primeira pesquisa</h3><p>Crie um comprador para começar a pesquisa.</p></div>}<div className="results-footer"><span>{visiveis.length} de {linhas.length} imóveis</span><span>Excel inclui fotografia</span></div></section>{linhaAberta && compradorId && <PainelContacto key={`${compradorId}-${linhaAberta.imovel.id}`} linha={linhaAberta} compradorId={compradorId} fechar={fecharPainel} aoContacto={(c, apagado) => aoContacto(compradorId,c,apagado)} />}</div></main></div><footer className="app-footer"><span>ZX LAB</span><span>Pesquisa e contactos num só lugar</span></footer>{dialogo === 'comprador' && <FormComprador aoFechar={() => setDialogo(null)} aoGuardar={id => { setDialogo(null); pretendido.current = id; setAberto(null); setSelecionados(new Set()); setFiltro('todos'); setQuery(''); setListaVersao(n => n+1); setStatus('Comprador guardado.'); }} />}{dialogo === 'anuncio' && <FormAnuncio aoFechar={() => setDialogo(null)} aoGuardar={estado => { setDialogo(null); setDadosVersao(n => n+1); setStatus(estados[estado]); }} />}</div>;
}
