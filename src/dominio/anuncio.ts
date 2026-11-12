import type { Portal } from './tipos';

const PORTAIS: ReadonlyArray<[string, Portal]> = [
  ['imovirtual.com', 'Imovirtual'],
  ['casa.sapo.pt', 'Casa Sapo'],
  ['casayes.pt', 'CasaYes'],
];

export interface AnuncioInterpretado { portal: Portal; chave: string; url: string }

export function interpretarUrlAnuncio(texto: string): AnuncioInterpretado | null {
  let u: URL;
  try { u = new URL(texto.trim()); } catch { return null; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  u.hash = '';
  const host = u.hostname.toLowerCase().replace(/^www\./, '');
  const portal = PORTAIS.find(([d]) => host === d || host.endsWith(`.${d}`))?.[1] ?? 'Outro';
  const caminho = u.pathname.replace(/\/+$/, '');
  const chave = portal === 'Outro' ? `${host}${caminho}${u.search}` : `${host}${caminho}`;
  return { portal, chave, url: u.toString().replace(/\/+(\?|$)/, '$1') };
}
