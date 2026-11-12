export type TipoLink = 'invite' | 'recovery';
export interface LinkAuth { tipo: TipoLink | null; erro: string | null }

const LINK_INVALIDO = 'Não foi possível validar o link. Peça um novo em «Esqueci a palavra-passe».';
const LINK_EXPIRADO = 'O link expirou ou já foi usado. Peça um novo em «Esqueci a palavra-passe».';

// Lê o hash que o Supabase devolve no link de convite/recuperação (fluxo implicit).
// Tem de correr antes de o supabase-js consumir e limpar a URL.
export function lerLinkAuth(hash: string): LinkAuth {
  const p = new URLSearchParams(hash.replace(/^#/, ''));
  if (p.get('error') || p.get('error_code')) return { tipo: null, erro: p.get('error_code') === 'otp_expired' ? LINK_EXPIRADO : LINK_INVALIDO };
  const t = p.get('type');
  const tipo = (t === 'invite' || t === 'recovery') && p.get('access_token') ? t : null;
  return { tipo, erro: null };
}

const CHAVE = 'mesa-consultor-definir-senha';
// Marca que a sessão veio de um link e ainda falta definir a palavra-passe. Fica em localStorage,
// tal como a sessão do supabase-js, para nova aba ou reinício do browser não saltarem o ecrã;
// é limpa quando a sessão termina e antes de um login com palavra-passe.
export function senhaPendente(): TipoLink | null {
  try { const v = localStorage.getItem(CHAVE); return v === 'invite' || v === 'recovery' ? v : null; } catch { return null; }
}
export function marcarSenhaPendente(tipo: TipoLink | null): void {
  try { if (tipo) localStorage.setItem(CHAVE, tipo); else localStorage.removeItem(CHAVE); } catch { /* sem storage: vale só o estado em memória */ }
}

interface ErroComCodigo { code?: string; message?: string }
export function erroAuth(e: unknown): string | null {
  const codigo = (e as ErroComCodigo | null)?.code;
  switch (codigo) {
    case 'same_password': return 'A nova palavra-passe tem de ser diferente da atual.';
    case 'weak_password': return 'Palavra-passe demasiado fraca. Use pelo menos 8 caracteres, com letras e números.';
    case 'over_email_send_rate_limit': return 'Foram pedidos demasiados e-mails. Tente novamente dentro de uma hora.';
    case 'over_request_rate_limit': return 'Demasiadas tentativas. Aguarde alguns minutos e tente novamente.';
    case 'session_not_found': case 'session_expired': return 'A sessão do link expirou. Peça um novo link em «Esqueci a palavra-passe».';
    default: return null;
  }
}
