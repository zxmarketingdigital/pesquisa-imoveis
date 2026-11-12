import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const chave = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
if (!url || !chave) throw new Error('Configuração do Supabase em falta');

export const supabase = createClient(url, chave);
