import { useState } from 'react';
import type { CampoEmFalta, Contacto, Imovel } from '../dominio/tipos';

export interface LinhaImovel { imovel: Imovel; aConfirmar: CampoEmFalta[]; novo: boolean; contacto?: Contacto }
export const mensagemErro = (e: unknown): string => e instanceof Error ? e.message : 'Não foi possível concluir o pedido. Verifique a ligação e tente novamente.';
export function urlSegura(valor: string | null): string | undefined {
  if (!valor) return undefined;
  try { const u = new URL(valor); return ['http:', 'https:'].includes(u.protocol) ? u.href : undefined; } catch { return undefined; }
}
export const anoTexto = (i: Imovel) => i.anoConstrucao !== null ? String(i.anoConstrucao) : i.construcaoNova ? 'Construção nova' : 'Não informado';
export const garagemTexto = (i: Imovel) => i.garagem === null ? 'Não informado' : i.garagem ? 'Sim' : 'Não';
export function Foto({ url, grande = false }: { url: string | null; grande?: boolean }) {
  const [falhou, setFalhou] = useState(false);
  const src = urlSegura(url);
  const classe = grande ? 'detail-photo' : 'thumbnail';
  return src && !falhou ? <img className={classe} src={src} alt="Fotografia do imóvel" onError={() => setFalhou(true)} /> : <div className={`${classe} photo-placeholder`} role="img" aria-label="Sem fotografia">Sem foto</div>;
}
export function ErroPedido({ erro, repetir, ocupado = false }: { erro: string; repetir: () => void; ocupado?: boolean }) {
  return <div className="error-banner" role="alert">{erro} <button type="button" disabled={ocupado} onClick={repetir}>Tentar novamente</button></div>;
}
