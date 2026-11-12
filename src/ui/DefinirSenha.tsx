import { useState, type FormEvent } from 'react';
import { supabase } from '../dados/cliente';
import { erroAuth } from '../dados/linkAuth';
import { mensagemErro } from './auxiliares';
import { terminarSessao } from './sessao';

export const SENHA_MINIMA = 8;

export function DefinirSenha({ convite, email, aoConcluir }: { convite: boolean; email?: string; aoConcluir: () => void }) {
  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');
  async function guardar(e: FormEvent) {
    e.preventDefault(); if (ocupado) return;
    if (senha.length < SENHA_MINIMA) { setErro(`A palavra-passe precisa de pelo menos ${SENHA_MINIMA} caracteres.`); return; }
    if (senha !== confirmacao) { setErro('As palavras-passe não coincidem.'); return; }
    setOcupado(true); setErro('');
    try {
      const { error } = await supabase.auth.updateUser({ password: senha });
      if (error) throw error;
      aoConcluir();
    } catch (e) { setErro(erroAuth(e) ?? mensagemErro(e)); setOcupado(false); }
  }
  async function sair() {
    setOcupado(true);
    try { await terminarSessao(); } catch (e) { setErro(mensagemErro(e)); setOcupado(false); }
  }
  return <main className="login-shell"><section className="login-card" aria-labelledby="senha-titulo"><header><p className="eyebrow">ZX LAB</p><h1 id="senha-titulo">{convite ? 'Bem-vindo à Mesa do Consultor' : 'Definir nova palavra-passe'}</h1><p className="muted">{convite ? 'Defina a palavra-passe com que vai entrar daqui em diante.' : 'Escolha a nova palavra-passe para a sua conta.'}{email && <><br /><span className="mono">{email}</span></>}</p></header><form onSubmit={guardar} noValidate>{email && <input type="email" autoComplete="username" value={email} readOnly hidden />}<div className="field"><label htmlFor="senha-nova">Nova palavra-passe</label><input id="senha-nova" type="password" autoComplete="new-password" minLength={SENHA_MINIMA} value={senha} onChange={e => setSenha(e.target.value)} required aria-describedby="senha-regra" /><p id="senha-regra" className="muted">Pelo menos {SENHA_MINIMA} caracteres.</p></div><div className="field"><label htmlFor="senha-confirmar">Confirmar palavra-passe</label><input id="senha-confirmar" type="password" autoComplete="new-password" value={confirmacao} onChange={e => setConfirmacao(e.target.value)} required /></div>{erro && <p className="error" role="alert">{erro}</p>}<button className="primary" disabled={ocupado} type="submit">{ocupado ? 'A guardar…' : 'Guardar palavra-passe'}</button><button type="button" className="quiet" disabled={ocupado} onClick={() => void sair()}>Sair</button></form></section></main>;
}
