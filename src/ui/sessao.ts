import { supabase } from '../dados/cliente';

// Sobrevive a uma navegação antes de a resposta de logout chegar, sem guardar dados pessoais.
const SAIDA_PENDENTE = 'mesa-consultor-saida-pendente';
export const saidaPendente = (): boolean => sessionStorage.getItem(SAIDA_PENDENTE) === '1';
export async function terminarSessao(): Promise<void> {
  sessionStorage.setItem(SAIDA_PENDENTE, '1');
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
  sessionStorage.removeItem(SAIDA_PENDENTE);
}
