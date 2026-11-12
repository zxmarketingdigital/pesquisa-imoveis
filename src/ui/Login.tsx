import { useState, type FormEvent } from 'react';
import { supabase } from '../dados/cliente';
import { erroAuth, marcarSenhaPendente } from '../dados/linkAuth';
import { mensagemErro } from './auxiliares';

const ENVIADO = 'Se o e-mail estiver registado, enviámos um link para definir a palavra-passe. Verifique a caixa de entrada e o spam; se não chegar em alguns minutos, tente novamente dentro de uma hora.';

export function Login({ aviso }: { aviso?: string | null }) {
  const [modo, setModo] = useState<'entrar' | 'recuperar'>(aviso ? 'recuperar' : 'entrar');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');
  const [enviado, setEnviado] = useState(false);
  async function entrar(e?: FormEvent) {
    e?.preventDefault(); if (ocupado) return;
    if (!email.trim() || !senha) { setErro('Indique o e-mail e a palavra-passe.'); return; }
    setOcupado(true); setErro('');
    marcarSenhaPendente(null); // quem entra com palavra-passe já a tem; uma marca antiga não pode pedir outra
    try { const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha }); if (error) throw error; }
    catch (e) { setErro(erroAuth(e) ?? mensagemErro(e)); } finally { setOcupado(false); }
  }
  async function recuperar(e: FormEvent) {
    e.preventDefault(); if (ocupado) return;
    if (!email.trim()) { setErro('Indique o e-mail da sua conta.'); return; }
    setOcupado(true); setErro('');
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/` });
      // O limite de envio também responde a contas existentes: tratá-lo como sucesso não revela se o e-mail existe.
      if (error && error.code !== 'over_email_send_rate_limit') throw error;
      setEnviado(true);
    } catch (e) { setErro(erroAuth(e) ?? mensagemErro(e)); } finally { setOcupado(false); }
  }
  function mudar(m: 'entrar' | 'recuperar') { setModo(m); setErro(''); setEnviado(false); }
  const campoEmail = <div className="field"><label htmlFor="login-email">E-mail</label><input id="login-email" type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} required /></div>;
  return <main className="login-shell"><section className="login-card" aria-labelledby="login-titulo"><header><p className="eyebrow">ZX LAB</p><h1 id="login-titulo">Mesa do Consultor</h1><p className="muted">{modo === 'entrar' ? 'Entre para acompanhar os seus compradores.' : 'Recebe por e-mail um link para definir a palavra-passe.'}</p></header>
    {modo === 'entrar'
      ? <form onSubmit={entrar} noValidate>{campoEmail}<div className="field"><label htmlFor="login-senha">Palavra-passe</label><input id="login-senha" type="password" autoComplete="current-password" value={senha} onChange={e => setSenha(e.target.value)} required /></div>{erro && <p className="error" role="alert">{erro}</p>}<button className="primary" disabled={ocupado} type="submit">{ocupado ? 'A entrar…' : 'Entrar'}</button>{erro && <button type="button" disabled={ocupado} onClick={() => void entrar()}>Tentar novamente</button>}<button type="button" className="quiet login-alt" disabled={ocupado} onClick={() => mudar('recuperar')}>Esqueci a palavra-passe</button></form>
      : <form onSubmit={recuperar} noValidate>{aviso && !enviado && <p className="error" role="alert">{aviso}</p>}{campoEmail}{erro && <p className="error" role="alert">{erro}</p>}{enviado && <p className="login-ok" role="status">{ENVIADO}</p>}<button className="primary" disabled={ocupado} type="submit">{ocupado ? 'A enviar…' : enviado ? 'Enviar de novo' : 'Enviar link'}</button><button type="button" className="quiet login-alt" disabled={ocupado} onClick={() => mudar('entrar')}>Voltar a entrar</button></form>}
  </section></main>;
}
