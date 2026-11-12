import { createClient } from '@supabase/supabase-js';
import { lerLinkAuth } from './linkAuth';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const chave = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
if (!url || !chave) throw new Error('Configuração do Supabase em falta');

// Captura o tipo de link (convite/recuperação) ANTES de o createClient consumir e limpar o hash.
export const linkInicial = lerLinkAuth(typeof window === 'undefined' ? '' : window.location.hash);

export const supabase = createClient(url, chave);
