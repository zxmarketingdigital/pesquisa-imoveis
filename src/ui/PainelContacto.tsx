import { useEffect, useRef, useState } from 'react';
import { desfazerContacto, registarContacto } from '../dados/repositorio';
import { assuntoEmail, canalPadrao, formatarPreco, ligacaoEmail, ligacaoWhatsApp, mensagemParaConsultor } from '../dominio/mensagens';
import type { Canal, Contacto } from '../dominio/tipos';
import { anoTexto, ErroPedido, Foto, garagemTexto, mensagemErro, type LinhaImovel } from './auxiliares';

export function PainelContacto({ linha, compradorId, fechar, aoContacto }: { linha: LinhaImovel; compradorId: string; fechar: () => void; aoContacto: (contacto: Contacto | null, apagado?: string) => void }) {
  const i = linha.imovel;
  const [canal, setCanal] = useState<Canal>(canalPadrao(i) ?? 'whatsapp');
  const [texto, setTexto] = useState(() => mensagemParaConsultor(i,linha.aConfirmar));
  const [ultimoId, setUltimoId] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');
  const [feedback, setFeedback] = useState('');
  const [acao, setAcao] = useState<'marcar' | 'desfazer'>('marcar');
  const painel = useRef<HTMLElement>(null);
  const botaoFechar = useRef<HTMLButtonElement>(null);
  const mensagem = useRef<HTMLTextAreaElement>(null);
  const tabs = useRef<HTMLDivElement>(null);
  useEffect(() => { if (window.matchMedia('(max-width:700px)').matches) painel.current?.scrollIntoView({block:'start'}); botaoFechar.current?.focus({preventScroll:true}); const esc = (e: KeyboardEvent) => { if (e.key === 'Escape' && !document.querySelector('dialog[open]')) { e.preventDefault(); fechar(); } }; document.addEventListener('keydown',esc); return () => document.removeEventListener('keydown',esc); },[fechar]);
  const wa = ligacaoWhatsApp(i.telefone,texto);
  const mail = ligacaoEmail(i.email,assuntoEmail(i),texto);
  const href = canal === 'whatsapp' ? wa : mail;
  async function copiar() {
    try { if (!navigator.clipboard) throw new Error(); await navigator.clipboard.writeText(texto); setFeedback('Texto copiado.'); }
    catch { mensagem.current?.focus(); mensagem.current?.select(); setFeedback('Texto selecionado. Use Ctrl+C ou ⌘C para copiar.'); }
  }
  async function agir(tipo: 'marcar' | 'desfazer') {
    if (ocupado) return; setOcupado(true); setErro(''); setAcao(tipo);
    try {
      if (tipo === 'desfazer' && ultimoId) { await desfazerContacto(ultimoId); aoContacto(null,ultimoId); setUltimoId(null); setFeedback('Contacto desfeito.'); }
      else if (tipo === 'marcar') { const id = await registarContacto(compradorId,i.id,canal,texto); setUltimoId(id); aoContacto({ id, imovelId:i.id,canal,criadoEm:new Date().toISOString() }); setFeedback('Contacto marcado.'); }
    } catch(e) { setErro(mensagemErro(e)); } finally { setOcupado(false); }
  }
  return <aside ref={painel} className="detail" aria-label="Contacto"><div className="detail-top"><h2>Preparar contacto</h2><button ref={botaoFechar} type="button" className="quiet" onClick={fechar}>Fechar</button></div><Foto key={i.fotoUrl} url={i.fotoUrl} grande /><div className="detail-title"><h3>{i.tipologia} em {i.zona}</h3></div><p className="detail-ref">{i.referencia ?? 'Sem referência'} · {i.anuncios.map(a => a.portal).join(', ')}</p><p className="detail-price">{formatarPreco(i.preco)}</p><div className="detail-badges">{linha.novo && <span className="badge new">Novo</span>}{linha.aConfirmar.length > 0 && <span className="badge unknown">A confirmar</span>}<span className="status-text">{linha.contacto ? 'Contactado' : 'Por contactar'}</span></div><dl className="specs"><div><dt>Área</dt><dd>{i.areaM2 === null ? 'Não informada' : `${i.areaM2} m²`}</dd></div><div><dt>Ano</dt><dd>{anoTexto(i)}</dd></div><div><dt>Garagem</dt><dd>{garagemTexto(i)}</dd></div></dl><div className="contact-card"><strong>{i.consultorNome ?? 'Consultor não indicado'}</strong><p>{i.imobiliaria}</p><div className="contact-lines"><span>{i.telefone ?? 'Telefone não indicado'}</span><span>{i.email ?? 'E-mail não indicado'}</span></div></div><div ref={tabs} className="channel-tabs" role="tablist" aria-label="Canal de contacto" onKeyDown={e => { if (['ArrowLeft','ArrowRight','Home','End'].includes(e.key)) { e.preventDefault(); const proximo = e.key === 'Home' ? 'whatsapp' : e.key === 'End' ? 'email' : canal === 'whatsapp' ? 'email' : 'whatsapp'; setCanal(proximo); tabs.current?.querySelector<HTMLButtonElement>(`[id="canal-${proximo}"]`)?.focus(); } }}>{(['whatsapp','email'] as Canal[]).map(c => <button id={`canal-${c}`} key={c} role="tab" aria-selected={canal === c} aria-controls="mensagem-contacto" tabIndex={canal === c ? 0 : -1} onClick={() => setCanal(c)}>{c === 'email' ? 'E-mail' : 'WhatsApp'}</button>)}</div><div id="mensagem-contacto" role="tabpanel" aria-labelledby={`canal-${canal}`}>{canal === 'email' && <p className="subject">Assunto: <strong>{assuntoEmail(i)}</strong></p>}<textarea ref={mensagem} className="message" aria-label="Texto da mensagem" value={texto} onChange={e => setTexto(e.target.value)} /><div className="copy-row"><span>Reveja o texto antes de enviar.</span><button type="button" onClick={() => void copiar()}>Copiar</button></div><a className="channel-action" href={href ?? undefined} role="link" aria-disabled={!href} target={canal === 'whatsapp' ? '_blank' : undefined} rel="noopener noreferrer">{canal === 'whatsapp' ? 'Abrir WhatsApp' : 'Abrir e-mail'}</a>{!href && <p className="hint">Contacto indisponível neste canal. Utilize o contacto da imobiliária.</p>}<p className="simulation">A mensagem é enviada por si na aplicação escolhida. Abrir a ligação não marca o contacto.</p></div><button className="full" disabled={ocupado || !!linha.contacto} onClick={() => void agir('marcar')}>Marcar como contactado</button>{ultimoId && <button className="undo full" disabled={ocupado} onClick={() => void agir('desfazer')}>Desfazer</button>}{erro && <ErroPedido erro={erro} ocupado={ocupado} repetir={() => void agir(acao)} />}<p className="copy-feedback" role="status">{feedback}</p></aside>;
}
