import { supabase } from '../dados/cliente';

const SAIDA_PENDENTE = 'mesa-consultor-saida-pendente';
const LIMITE_SAIDA_MS = 8000;
const LIMITE_LOCAL_MS = 3000;
const CHAVE_SESSAO = /^sb-.+-auth-token(-code-verifier)?$/;

export const saidaPendente = (): boolean => sessionStorage.getItem(SAIDA_PENDENTE) === '1';

function comLimite<T>(pedido: Promise<T>, ms: number): Promise<T | 'tempo'> {
  return Promise.race([pedido, new Promise<'tempo'>((r) => { setTimeout(() => r('tempo'), ms); })]);
}

// Último recurso: o supabase-js serializa a auth com um lock, e um signOut pendurado
// pode prender também o signOut local. Apaga a sessão guardada e recarrega a página.
function apagarSessaoGuardada(): void {
  for (const chave of Object.keys(localStorage)) if (CHAVE_SESSAO.test(chave)) localStorage.removeItem(chave);
  window.location.reload();
}

export async function terminarSessao(): Promise<void> {
  sessionStorage.setItem(SAIDA_PENDENTE, '1');
  let falhou = false;
  try {
    const r = await comLimite(supabase.auth.signOut(), LIMITE_SAIDA_MS);
    falhou = r === 'tempo' || !!r.error;
  } catch { falhou = true; }
  if (falhou) {
    let local: Awaited<ReturnType<typeof supabase.auth.signOut>> | 'tempo';
    try { local = await comLimite(supabase.auth.signOut({ scope: 'local' }), LIMITE_LOCAL_MS); }
    catch { local = 'tempo'; }
    if (local === 'tempo' || local.error) { apagarSessaoGuardada(); return; }
  }
  sessionStorage.removeItem(SAIDA_PENDENTE);
}
