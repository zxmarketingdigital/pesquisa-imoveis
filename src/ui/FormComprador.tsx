import { useRef, useState, type FormEvent } from 'react';
import { criarComprador } from '../dados/repositorio';
import { chaveZona, LOCALIZACOES } from '../dominio/localizacoes';
import { Dialogo } from './Dialogo';
import { mensagemErro } from './auxiliares';

export function FormComprador({ aoFechar, aoGuardar }: { aoFechar: () => void; aoGuardar: (id: string) => void }) {
  const ref = useRef<HTMLFormElement>(null);
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  async function guardar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (ocupado) return;
    const f = new FormData(e.currentTarget);
    const nome = String(f.get('nome') ?? '').trim();
    const precoMax = Number(f.get('preco'));
    const zonas = f.getAll('zona').map(String);
    const idade = String(f.get('idade') ?? '').trim();
    if (!nome) { setErro('Indique o nome do comprador.'); return; }
    if (!Number.isFinite(precoMax) || precoMax <= 0) { setErro('Indique um preço máximo superior a zero.'); return; }
    if (!zonas.length) { setErro('Selecione pelo menos uma zona.'); return; }
    if (idade && (!Number.isInteger(Number(idade)) || Number(idade) <= 0)) { setErro('Indique um número inteiro positivo de anos ou deixe o campo vazio.'); return; }
    setOcupado(true); setErro('');
    try {
      const id = await criarComprador({nome,contacto:String(f.get('contacto') ?? '').trim(),tipologia:String(f.get('tipologia')),precoMax,zonas,garagemObrigatoria:f.has('garagem'),menosDeAnos:idade ? Number(idade) : null});
      aoGuardar(id);
    } catch(e) { setErro(mensagemErro(e)); } finally { setOcupado(false); }
  }
  return <Dialogo titulo="Novo comprador" aoFechar={aoFechar} ocupado={ocupado}><form ref={ref} onSubmit={guardar} noValidate><fieldset className="form-grid" disabled={ocupado}><div className="field wide"><label htmlFor="comprador-nome">Nome do comprador</label><input id="comprador-nome" name="nome" autoComplete="off" required autoFocus /></div><div className="field"><label htmlFor="comprador-contacto">Contacto</label><input id="comprador-contacto" name="contacto" autoComplete="off" /></div><div className="field"><label htmlFor="comprador-tipologia">Tipologia</label><select id="comprador-tipologia" name="tipologia" defaultValue="T2">{[0,1,2,3,4,5].map(n => <option key={n} value={n === 5 ? 'T5+' : `T${n}`}>T{n}</option>)}</select></div><div className="field wide"><label htmlFor="comprador-preco">Preço máximo</label><input id="comprador-preco" name="preco" type="number" step="0.01" min="0.01" inputMode="decimal" required /></div><fieldset className="field wide"><legend>Concelhos e zonas</legend><div className="parishes">{Object.entries(LOCALIZACOES).map(([concelho,zonas]) => <div key={concelho}><strong>{concelho}</strong>{zonas.map(zona => <label key={zona}><input type="checkbox" name="zona" value={chaveZona(concelho,zona)} />{zona}</label>)}</div>)}</div></fieldset><label className="field-checkbox"><input type="checkbox" name="garagem" />Garagem obrigatória</label><div className="field"><label htmlFor="comprador-idade">Menos de (anos)</label><input id="comprador-idade" name="idade" type="number" min="1" step="1" aria-describedby="idade-ajuda" /><span className="hint" id="idade-ajuda">Opcional. Deixe vazio para não limitar a idade.</span></div></fieldset>{erro && <div className="error" role="alert"><p>{erro}</p><button type="button" disabled={ocupado} onClick={() => ref.current?.requestSubmit()}>Tentar novamente</button></div>}<div className="form-actions"><button type="button" onClick={aoFechar} disabled={ocupado}>Cancelar</button><button type="submit" className="primary" disabled={ocupado}>{ocupado ? 'A guardar…' : 'Guardar'}</button></div></form></Dialogo>;
}
