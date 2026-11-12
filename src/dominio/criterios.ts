import { chaveZona } from './localizacoes';
import type { Avaliacao, CampoEmFalta, Imovel, Pesquisa } from './tipos';

export function avaliar(i: Imovel, p: Pesquisa, anoAtual: number): Avaliacao {
  if (i.tipologia !== p.tipologia) return { entra: false };
  if (i.preco > p.precoMax) return { entra: false };
  if (!p.zonas.includes(chaveZona(i.concelho, i.zona))) return { entra: false };

  const aConfirmar: CampoEmFalta[] = [];

  if (p.menosDeAnos !== null) {
    // Com ano conhecido a regra de idade aplica-se sempre (mesmo com "construção nova" marcada);
    // sem ano, construção nova dispensa a confirmação.
    if (i.anoConstrucao !== null) {
      if (anoAtual - i.anoConstrucao >= p.menosDeAnos) return { entra: false };
    } else if (i.construcaoNova !== true) aConfirmar.push('ano');
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
