import { describe, expect, it } from 'vitest';
import { avaliar, ehNovo } from './criterios';
import type { Imovel, Pesquisa } from './tipos';

const pesquisa: Pesquisa = {
  id: 'p', compradorId: 'c', tipologia: 'T2', precoMax: 400000, zonas: ['Lisboa/Lumiar'],
  garagemObrigatoria: true, menosDeAnos: 4, ultimaAtualizacao: '2026-11-04T08:00:00Z', novosDesde: null,
};
const imovel: Imovel = {
  id: 'i', referencia: 'R1', imobiliaria: 'Norte', tipologia: 'T2', preco: 395000, areaM2: 84,
  concelho: 'Lisboa', zona: 'Lumiar', anoConstrucao: 2024, construcaoNova: false, garagem: true,
  consultorNome: 'Marta Exemplo', telefone: '+351900000001', email: null, fotoUrl: null,
  primeiraVez: '2026-11-04T09:00:00Z', anuncios: [],
};
const ANO = 2026;

describe('avaliar', () => {
  it('entra sem pendências quando cumpre tudo', () => {
    expect(avaliar(imovel, pesquisa, ANO)).toEqual({ entra: true, aConfirmar: [] });
  });
  it.each([
    ['tipologia diferente', { tipologia: 'T3' }],
    ['preço acima do máximo', { preco: 400001 }],
    ['zona fora', { zona: 'Carnide' }],
    ['mesmo nome de zona noutro concelho', { concelho: 'Odivelas' }],
    ['sem garagem quando é obrigatória', { garagem: false }],
    ['construção com 4 anos', { anoConstrucao: 2022 }],
  ])('sai com %s', (_nome, mudanca) => {
    expect(avaliar({ ...imovel, ...mudanca }, pesquisa, ANO)).toEqual({ entra: false });
  });
  it('aceita preço igual ao máximo e construção com 3 anos', () => {
    expect(avaliar({ ...imovel, preco: 400000, anoConstrucao: 2023 }, pesquisa, ANO).entra).toBe(true);
  });
  it('fica a confirmar quando faltam ano e garagem', () => {
    expect(avaliar({ ...imovel, anoConstrucao: null, garagem: null }, pesquisa, ANO))
      .toEqual({ entra: true, aConfirmar: ['ano', 'garagem'] });
  });
  it('construção nova dispensa o ano', () => {
    expect(avaliar({ ...imovel, anoConstrucao: null, construcaoNova: true }, pesquisa, ANO))
      .toEqual({ entra: true, aConfirmar: [] });
  });
  it('sem critério de garagem ou idade não pede confirmação', () => {
    const livre = { ...pesquisa, garagemObrigatoria: false, menosDeAnos: null };
    expect(avaliar({ ...imovel, anoConstrucao: null, garagem: null }, livre, ANO)).toEqual({ entra: true, aConfirmar: [] });
  });
});

describe('ehNovo', () => {
  it('é novo em pesquisa ainda sem corte', () => {
    expect(ehNovo('2026-11-04T09:00:00Z', null)).toBe(true);
  });
  it('compara com o corte', () => {
    expect(ehNovo('2026-11-04T09:00:00Z', '2026-11-04T08:00:00Z')).toBe(true);
    expect(ehNovo('2026-11-04T07:00:00Z', '2026-11-04T08:00:00Z')).toBe(false);
  });
});
