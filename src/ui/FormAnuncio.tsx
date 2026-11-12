import { useRef, useState, type FormEvent } from 'react';
import { enviarFoto } from '../dados/fotos';
import { registarAnuncio, type EstadoRegisto } from '../dados/repositorio';
import { interpretarUrlAnuncio } from '../dominio/anuncio';
import { chaveZona, LOCALIZACOES } from '../dominio/localizacoes';
import { Dialogo } from './Dialogo';
import { mensagemErro } from './auxiliares';

export function FormAnuncio({ aoFechar, aoGuardar }: { aoFechar: () => void; aoGuardar: (estado: EstadoRegisto) => void }) {
  const ref = useRef<HTMLFormElement>(null);
  const fotoEnviada = useRef<{ficheiro: File; caminho: string} | null>(null);
  const [link, setLink] = useState('');
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const interpretado = interpretarUrlAnuncio(link);
  async function guardar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (ocupado) return;
    const anuncio = interpretarUrlAnuncio(link);
    if (!anuncio) { setErro('Link inválido'); return; }
    const f = new FormData(e.currentTarget);
    const texto = (chave: string) => String(f.get(chave) ?? '').trim();
    const imobiliaria = texto('imobiliaria');
    const preco = Number(f.get('preco'));
    const local = texto('zona');
    const [concelho,zona] = local.split('/');
    const area = texto('area');
    const ano = texto('ano');
    if (!imobiliaria) { setErro('Indique a imobiliária.'); return; }
    if (!Number.isFinite(preco) || preco <= 0) { setErro('Indique um preço superior a zero.'); return; }
    if (!concelho || !zona || !LOCALIZACOES[concelho]?.includes(zona)) { setErro('Selecione uma zona.'); return; }
    if (area && (!Number.isFinite(Number(area)) || Number(area) <= 0)) { setErro('Indique uma área superior a zero ou deixe o campo vazio.'); return; }
    if (ano && (!Number.isInteger(Number(ano)) || Number(ano) <= 0)) { setErro('Indique um ano de construção válido ou deixe o campo vazio.'); return; }
    setOcupado(true); setErro('');
    try {
      const ficheiro = f.get('foto');
      let fotoCaminho: string | null = null;
      if (ficheiro instanceof File && ficheiro.size > 0) {
        if (fotoEnviada.current?.ficheiro !== ficheiro) fotoEnviada.current = {ficheiro,caminho:await enviarFoto(ficheiro)};
        fotoCaminho = fotoEnviada.current.caminho;
      }
      const resultado = await registarAnuncio({url:anuncio.url,referencia:texto('referencia'),imobiliaria,tipologia:texto('tipologia'),preco,areaM2:area ? Number(area) : null,concelho,zona,ano:ano ? Number(ano) : null,nova:f.has('nova'),garagem:texto('garagem') === 'Sim' ? true : texto('garagem') === 'Não' ? false : null,consultor:texto('consultor') || null,telefone:texto('telefone') || null,email:texto('email') || null,fotoCaminho});
      aoGuardar(resultado.estado);
    } catch(e) { setErro(mensagemErro(e)); } finally { setOcupado(false); }
  }
  return <Dialogo titulo="Registar anúncio" aoFechar={aoFechar} ocupado={ocupado}><form ref={ref} onSubmit={guardar} noValidate><fieldset className="form-grid" disabled={ocupado}><div className="field wide"><label htmlFor="anuncio-link">Link do anúncio</label><input id="anuncio-link" name="link" type="text" inputMode="url" value={link} onChange={e => setLink(e.target.value)} autoFocus required autoComplete="off" />{interpretado && <span className="hint">Portal: {interpretado.portal}</span>}</div><div className="field"><label htmlFor="anuncio-referencia">Referência</label><input id="anuncio-referencia" name="referencia" /></div><div className="field"><label htmlFor="anuncio-imobiliaria">Imobiliária</label><input id="anuncio-imobiliaria" name="imobiliaria" required /></div><div className="field"><label htmlFor="anuncio-tipologia">Tipologia</label><select id="anuncio-tipologia" name="tipologia" defaultValue="T2">{[0,1,2,3,4,5].map(n => <option key={n} value={n === 5 ? 'T5+' : `T${n}`}>T{n}</option>)}</select></div><div className="field"><label htmlFor="anuncio-preco">Preço</label><input id="anuncio-preco" name="preco" type="number" step="0.01" min="0.01" inputMode="decimal" required /></div><div className="field"><label htmlFor="anuncio-area">Área</label><input id="anuncio-area" name="area" type="number" step="0.01" min="0.01" inputMode="decimal" /></div><div className="field"><label htmlFor="anuncio-zona">Zona</label><select id="anuncio-zona" name="zona" defaultValue="" required><option value="">Selecione uma zona</option>{Object.entries(LOCALIZACOES).map(([concelho,zonas]) => <optgroup key={concelho} label={concelho}>{zonas.map(zona => <option key={zona} value={chaveZona(concelho,zona)}>{zona}</option>)}</optgroup>)}</select></div><div className="field"><label htmlFor="anuncio-ano">Ano de construção</label><input id="anuncio-ano" name="ano" type="number" min="1" step="1" /></div><label className="field-checkbox"><input type="checkbox" name="nova" />Construção nova</label><div className="field"><label htmlFor="anuncio-garagem">Garagem</label><select id="anuncio-garagem" name="garagem"><option>Não informado</option><option>Sim</option><option>Não</option></select></div><div className="field"><label htmlFor="anuncio-consultor">Consultor do anúncio</label><input id="anuncio-consultor" name="consultor" /></div><div className="field"><label htmlFor="anuncio-telefone">Telefone</label><input id="anuncio-telefone" name="telefone" type="tel" /></div><div className="field"><label htmlFor="anuncio-email">E-mail</label><input id="anuncio-email" name="email" type="email" /></div><div className="field wide"><label htmlFor="anuncio-foto">Foto</label><input id="anuncio-foto" name="foto" type="file" accept="image/*" onChange={() => { fotoEnviada.current = null; }} /><span className="hint">Até 5 MB. A imagem é convertida para JPEG.</span></div></fieldset>{erro && <div className="error" role="alert"><p>{erro}</p><button type="button" disabled={ocupado} onClick={() => ref.current?.requestSubmit()}>Tentar novamente</button></div>}<div className="form-actions"><button type="button" disabled={ocupado} onClick={aoFechar}>Cancelar</button><button type="submit" className="primary" disabled={ocupado}>{ocupado ? 'A guardar…' : 'Guardar'}</button></div></form></Dialogo>;
}
