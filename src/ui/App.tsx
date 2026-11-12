import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { linkInicial, supabase } from '../dados/cliente';
import { marcarSenhaPendente, senhaPendente, type TipoLink } from '../dados/linkAuth';
import { DefinirSenha } from './DefinirSenha';
import { Login } from './Login';
import { Mesa } from './Mesa';
import { saidaPendente, terminarSessao } from './sessao';
import { ErroPedido, mensagemErro } from './auxiliares';

export function App() {
  const [sessao, setSessao] = useState<Session | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [tentativa, setTentativa] = useState(0);
  const [aviso, setAviso] = useState(linkInicial.erro);
  const [pendente, setPendente] = useState<TipoLink | null>(() => { if (linkInicial.tipo) marcarSenhaPendente(linkInicial.tipo); return senhaPendente(); });
  useEffect(() => {
    let ativo = true;
    let eventoRecebido = false;
    setCarregando(true); setErro('');
    const { data: { subscription } } = supabase.auth.onAuthStateChange((evento, atual) => {
      if (saidaPendente() && evento !== 'SIGNED_OUT') return;
      eventoRecebido = true;
      if (evento === 'PASSWORD_RECOVERY' && !senhaPendente()) marcarSenhaPendente('recovery');
      if (!atual) marcarSenhaPendente(null);
      if (ativo && atual) setAviso(null);
      if (ativo) { setSessao(atual); setPendente(senhaPendente()); setCarregando(false); setErro(''); }
    });
    if (saidaPendente()) {
      void terminarSessao().then(() => { if (ativo) { setSessao(null); setCarregando(false); } }).catch(e => { if (ativo) { setErro(mensagemErro(e)); setCarregando(false); } });
      return () => { ativo = false; subscription.unsubscribe(); };
    }
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!ativo || eventoRecebido || saidaPendente()) return;
      if (error) setErro(mensagemErro(error));
      else { if (!data.session) marcarSenhaPendente(null); setSessao(data.session); setPendente(senhaPendente()); }
      setCarregando(false);
    }).catch(e => { if (ativo) { setErro(mensagemErro(e)); setCarregando(false); } });
    return () => { ativo = false; subscription.unsubscribe(); };
  }, [tentativa]);
  if (erro) return <ErroPedido erro={erro} repetir={() => setTentativa(t => t + 1)} />;
  if (carregando) return <p className="loading" role="status">A verificar a sessão…</p>;
  if (!sessao) return <Login aviso={aviso} />;
  if (pendente) return <DefinirSenha convite={pendente === 'invite'} email={sessao.user.email} aoConcluir={() => { marcarSenhaPendente(null); setPendente(null); }} />;
  return <Mesa key={sessao.user.id} />;
}
