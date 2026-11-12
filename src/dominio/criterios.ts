import { chaveZona } from './localizacoes';
import type { Avaliacao, CampoEmFalta, Imovel, Pesquisa } from './tipos';

export function avaliar(i: Imovel, p: Pesquisa, anoAtual: number): Avaliacao {
  if (i.tipologia !== p.tipologia) return { entra: false };
  if (i.preco > p.precoMax) return { entra: false };
  if (!p.zonas.includes(chaveZona(i.concelho, i.zona))) return { entra: false };

  const aConfirmar: CampoEmFalta[] = [];

  if (p.menosDeAnos !== null && i.construcaoNova !== true) {
    if (i.anoConstrucao === null) aConfirmar.push('ano');
    else if (anoAtual - i.anoConstrucao >= p.menosDeAnos) return { entra: false };
  }

  if (p.garagemObrigatoria) {
    if (i.garagem === false) return { entra: false };
    if (i.garagem === null) aConfirmar.push('garagem');
  }

  return { entra: true, aConfirmar };
}

export function ehNovo(primeiraVez: string, novosDesde: string | null): boolean {
  return novosDesde === null || new Date(primeiraVez) > new Date(novosDesde);
}
