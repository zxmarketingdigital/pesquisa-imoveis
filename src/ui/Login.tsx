import { useState, type FormEvent } from 'react';
import { supabase } from '../dados/cliente';
import { mensagemErro } from './auxiliares';

export function Login() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');
  async function entrar(e?: FormEvent) {
    e?.preventDefault(); if (ocupado) return;
    if (!email.trim() || !senha) { setErro('Indique o e-mail e a palavra-passe.'); return; }
    setOcupado(true); setErro('');
    try { const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha }); if (error) throw error; }
    catch (e) { setErro(mensagemErro(e)); } finally { setOcupado(false); }
  }
  return <main className="login-shell"><section className="login-card" aria-labelledby="login-titulo"><header><p className="eyebrow">ZX LAB</p><h1 id="login-titulo">Mesa do Consultor</h1><p className="muted">Entre para acompanhar os seus compradores.</p></header><form onSubmit={entrar} noValidate><div className="field"><label htmlFor="login-email">E-mail</label><input id="login-email" type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} required /></div><div className="field"><label htmlFor="login-senha">Palavra-passe</label><input id="login-senha" type="password" autoComplete="current-password" value={senha} onChange={e => setSenha(e.target.value)} required /></div>{erro && <p className="error" role="alert">{erro}</p>}<button className="primary" disabled={ocupado} type="submit">{ocupado ? 'A entrar…' : 'Entrar'}</button>{erro && <button type="button" disabled={ocupado} onClick={() => void entrar()}>Tentar novamente</button>}</form></section></main>;
}
