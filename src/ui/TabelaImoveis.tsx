import { useRef, useEffect, useState } from 'react';
import { formatarPreco } from '../dominio/mensagens';
import { anoTexto, Foto, garagemTexto, urlSegura, type LinhaImovel } from './auxiliares';

type Coluna = 'preco' | 'tipologia' | 'area' | 'zona' | 'ano' | 'garagem' | 'referencia' | 'portal' | 'consultor' | 'imobiliaria' | 'contacto';
const colunas: [Coluna, string][] = [['preco','Preço'],['tipologia','Tipologia'],['area','Área'],['zona','Zona'],['ano','Ano'],['garagem','Garagem'],['referencia','Referência'],['portal','Portal'],['consultor','Consultor'],['imobiliaria','Imobiliária'],['contacto','Contacto']];
function valor(l: LinhaImovel, c: Coluna): string | number {
  const i = l.imovel;
  switch (c) {
    case 'area': return i.areaM2 ?? -1;
    case 'ano': return i.anoConstrucao ?? -1;
    case 'garagem': return garagemTexto(i);
    case 'portal': return i.anuncios.map(a => a.portal).join(', ');
    case 'consultor': return i.consultorNome ?? '';
    case 'contacto': return l.contacto ? 'Contactado' : 'Por contactar';
    case 'referencia': return i.referencia ?? '';
    default: return i[c];
  }
}
export function TabelaImoveis({ linhas, selecionados, selecionar, abrir, aberto }: { linhas: LinhaImovel[]; selecionados: Set<string>; selecionar: (ids: Set<string>) => void; abrir: (id: string, origem: HTMLElement) => void; aberto?: string }) {
  const [ordem, setOrdem] = useState<Coluna>('preco');
  const [direcao, setDirecao] = useState(1);
  const todos = linhas.length > 0 && linhas.every(l => selecionados.has(l.imovel.id));
  const algum = linhas.some(l => selecionados.has(l.imovel.id));
  const caixa = useRef<HTMLInputElement>(null);
  useEffect(() => { if (caixa.current) caixa.current.indeterminate = algum && !todos; }, [algum, todos]);
  const ordenadas = [...linhas].sort((a,b) => { const av = valor(a,ordem), bv = valor(b,ordem); return (typeof av === 'number' && typeof bv === 'number' ? av-bv : String(av).localeCompare(String(bv),'pt-PT',{numeric:true}))*direcao; });
  function alternar(id: string) { const s = new Set(selecionados); if (s.has(id)) s.delete(id); else s.add(id); selecionar(s); }
  return <div className="table-scroll" tabIndex={0} role="region" aria-label="Tabela de imóveis; deslize horizontalmente para ver todas as colunas"><table id="property-table"><thead><tr><th className="check-cell" scope="col"><label className="check-wrap"><input ref={caixa} type="checkbox" aria-label="Selecionar todos os visíveis" checked={todos} disabled={!linhas.length} onChange={() => { const s = new Set(selecionados); linhas.forEach(l => todos ? s.delete(l.imovel.id) : s.add(l.imovel.id)); selecionar(s); }} /></label></th><th scope="col">Foto</th>{colunas.map(([c,nome]) => <th scope="col" key={c} aria-sort={ordem === c ? direcao === 1 ? 'ascending' : 'descending' : 'none'}><button onClick={() => { setOrdem(c); setDirecao(ordem === c ? -direcao : 1); }}>{nome}<span aria-hidden="true" className="sort-indicator">{ordem === c ? direcao === 1 ? '↑' : '↓' : '↕'}</span></button></th>)}</tr></thead><tbody>{ordenadas.map(l => { const i = l.imovel; return <tr key={i.id} aria-label={`Abrir ${i.referencia ?? 'imóvel sem referência'}, ${i.tipologia} em ${i.zona}`} tabIndex={0} className={aberto === i.id ? 'is-open' : undefined} onClick={e => { if ((e.target as HTMLElement).closest('a,input,label,button')) return; abrir(i.id,e.currentTarget); }} onKeyDown={e => { if (e.target === e.currentTarget && ['Enter',' '].includes(e.key)) { e.preventDefault(); abrir(i.id,e.currentTarget); } }}><td className="check-cell"><label className="check-wrap"><input type="checkbox" aria-label={`Selecionar ${i.referencia ?? i.id}`} checked={selecionados.has(i.id)} onChange={() => alternar(i.id)} /></label></td><td><Foto key={i.fotoUrl} url={i.fotoUrl} /></td><td><button className="row-open" onClick={e => abrir(i.id,e.currentTarget)} aria-label={`Abrir imóvel ${i.referencia ?? i.id}`}>{formatarPreco(i.preco)}</button>{l.novo && <span className="badge new">Novo</span>}</td><td>{i.tipologia}</td><td className="mono">{i.areaM2 === null ? 'Não informada' : `${i.areaM2} m²`}</td><td>{i.zona}</td><td className="mono">{anoTexto(i)}</td><td>{garagemTexto(i)}</td><td className="mono">{i.referencia ?? 'Sem referência'}{l.aConfirmar.length > 0 && <div><span className="badge unknown">A confirmar</span></div>}</td><td>{i.anuncios.map((a,index) => <span key={`${a.url}-${index}`}>{index > 0 && ', '}{urlSegura(a.url) ? <a href={urlSegura(a.url)} rel="noopener noreferrer" target="_blank">{a.portal}</a> : a.portal}</span>)}</td><td>{i.consultorNome ?? 'Consultor não indicado'}</td><td className="agency-cell muted">{i.imobiliaria}</td><td><span className={`status-text mono ${l.contacto ? 'done' : ''}`}>{l.contacto ? 'Contactado' : 'Por contactar'}</span><span className="contact-link">Preparar contacto →</span></td></tr>; })}</tbody></table>{!linhas.length && <div className="empty"><h3>Sem imóveis neste filtro</h3><p>Experimente outro filtro ou registe um anúncio que corresponda à pesquisa.</p></div>}</div>;
}
