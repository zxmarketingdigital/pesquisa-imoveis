import { supabase } from '../dados/cliente';

// Sobrevive a uma navegação antes de a resposta de logout chegar, sem guardar dados pessoais.
const SAIDA_PENDENTE = 'mesa-consultor-saida-pendente';
export const saidaPendente = (): boolean => sessionStorage.getItem(SAIDA_PENDENTE) === '1';
export async function terminarSessao(): Promise<void> {
  sessionStorage.setItem(SAIDA_PENDENTE, '1');
  let falhou = false;
  try { falhou = !!(await supabase.auth.signOut()).error; } catch { falhou = true; }
  // Sem rede a revogação no servidor falha e o supabase-js mantém a sessão no navegador:
  // remover sempre a sessão local para a Mesa não reabrir com os dados do consultor anterior.
  if (falhou) {
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) throw error;
  }
  sessionStorage.removeItem(SAIDA_PENDENTE);
}
