import { supabase } from '../dados/cliente';

// Sobrevive a uma navegação antes de a resposta de logout chegar, sem guardar dados pessoais.
const SAIDA_PENDENTE = 'mesa-consultor-saida-pendente';
// Rede pendurada não pode prender a saída: depois disto limpa-se só a sessão local.
const LIMITE_SAIDA_MS = 8000;
export const saidaPendente = (): boolean => sessionStorage.getItem(SAIDA_PENDENTE) === '1';
export async function terminarSessao(): Promise<void> {
  sessionStorage.setItem(SAIDA_PENDENTE, '1');
  let falhou = false;
  const limite = new Promise<'tempo'>((r) => { setTimeout(() => r('tempo'), LIMITE_SAIDA_MS); });
  try {
    const r = await Promise.race([supabase.auth.signOut(), limite]);
    falhou = r === 'tempo' || !!r.error;
  } catch { falhou = true; }
  // Sem rede a revogação no servidor falha e o supabase-js mantém a sessão no navegador:
  // remover sempre a sessão local para a Mesa não reabrir com os dados do consultor anterior.
  if (falhou) {
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) throw error;
  }
  sessionStorage.removeItem(SAIDA_PENDENTE);
}
