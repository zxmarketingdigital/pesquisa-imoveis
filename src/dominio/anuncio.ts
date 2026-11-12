import type { Portal } from './tipos';

const PORTAIS: ReadonlyArray<[string, Portal]> = [
  ['imovirtual.com', 'Imovirtual'],
  ['casa.sapo.pt', 'Casa Sapo'],
  ['casayes.pt', 'CasaYes'],
];

export interface AnuncioInterpretado { portal: Portal; chave: string; url: string }

const TRACKING = /^(utm_.*|fbclid|gclid)$/i;

/**
 * Mesma normalização da função SQL `normalizar_url` (a chave oficial é a do servidor;
 * esta serve para mostrar o portal e antecipar duplicados): host em minúsculas, sem protocolo,
 * credenciais, porta, `www.`/`m.`, fragmento, `utm_*`/`fbclid`/`gclid`, parâmetros ordenados, sem barra final.
 */
function normalizarChave(url: string): string {
  const semFragmento = url.trim().split('#')[0]!;
  const semProtocolo = semFragmento.replace(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//, '');
  const iq = semProtocolo.indexOf('?');
  const resto = iq === -1 ? semProtocolo : semProtocolo.slice(0, iq);
  const query = iq === -1 ? '' : semProtocolo.slice(iq + 1);
  const ib = resto.indexOf('/');
  const hostBruto = ib === -1 ? resto : resto.slice(0, ib);
  const caminho = (ib === -1 ? '' : resto.slice(ib)).replace(/\/+$/, '');
  const host = hostBruto.replace(/^[^@]*@/, '').replace(/:\d*$/, '').toLowerCase().replace(/^(www|m)\./, '');
  const params = query.split('&').filter((p) => p !== '' && !TRACKING.test(p.split('=')[0]!)).sort();
  return `${host}${caminho}${params.length ? `?${params.join('&')}` : ''}`;
}

export function interpretarUrlAnuncio(texto: string): AnuncioInterpretado | null {
  let bruto = texto.trim();
  if (/\s/.test(bruto)) return null;
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(bruto)) {
    if (/^(javascript|data|vbscript|file|mailto):/i.test(bruto)) return null;
    bruto = `https://${bruto}`; // aceita URL colado sem protocolo (o servidor faz o mesmo)
  }
  let u: URL;
  try { u = new URL(bruto); } catch { return null; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  const chave = normalizarChave(bruto);
  const host = chave.split(/[/?]/)[0]!;
  const portal = PORTAIS.find(([d]) => host === d || host.endsWith(`.${d}`))?.[1] ?? 'Outro';
  u.hash = '';
  return { portal, chave, url: u.toString().replace(/\/+(\?|$)/, '$1') };
}
