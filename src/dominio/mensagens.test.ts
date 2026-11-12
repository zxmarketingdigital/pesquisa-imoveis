import { describe, expect, it } from 'vitest';
import { assuntoEmail, canalPadrao, formatarPreco, ligacaoEmail, ligacaoWhatsApp, mensagemParaConsultor, normalizarTelefone } from './mensagens';
import type { Imovel } from './tipos';

const imovel: Imovel = {
  id: 'i', referencia: 'CSP-20771', imobiliaria: 'Casas Demo Lisboa', tipologia: 'T2', preco: 389000, areaM2: 78,
  concelho: 'Lisboa', zona: 'Telheiras', anoConstrucao: null, construcaoNova: null, garagem: true,
  consultorNome: 'Rui Fictício', telefone: '+351 900 000 002', email: 'rui@exemplo.pt', fotoUrl: null,
  primeiraVez: '2026-11-04T09:00:00Z', anuncios: [{ portal: 'Casa Sapo', url: 'https://casa.sapo.pt/x' }],
};

describe('mensagemParaConsultor', () => {
  it('monta o texto do escopo e pergunta o que falta', () => {
    expect(mensagemParaConsultor(imovel, ['ano'])).toBe(
      'Olá, Rui. Tenho um comprador interessado no T2 em Telheiras, referência CSP-20771, anunciado na Casa Sapo por 389.000 €. O imóvel continua disponível? Pode indicar-me o ano de construção? Obrigado.');
  });
  it('pergunta a garagem quando falta', () => {
    expect(mensagemParaConsultor(imovel, ['garagem'])).toContain('Pode confirmar se inclui garagem?');
  });
  it('dirige-se à imobiliária sem consultor', () => {
    expect(mensagemParaConsultor({ ...imovel, consultorNome: null }, [])).toMatch(/^Olá, equipa da Casas Demo Lisboa\./);
  });
  it('omite referência ausente', () => {
    expect(mensagemParaConsultor({ ...imovel, referencia: null }, [])).toContain('no T2 em Telheiras, anunciado');
  });
  it('sem portal conhecido diz online', () => {
    expect(mensagemParaConsultor({ ...imovel, anuncios: [] }, [])).toContain('anunciado online por');
  });
});

it('formata preço', () => {
  expect(formatarPreco(1395000)).toBe('1.395.000 €');
  expect(formatarPreco(372500.5)).toBe('372.500,50 €');
});

describe('normalizarTelefone', () => {
  it.each([
    ['+351 900 000 002', '351900000002'],
    ['00351900000002', '351900000002'],
    ['912 345 678', '351912345678'],
    ['+55 11 91234-5678', '5511912345678'],
  ])('%s', (entrada, saida) => expect(normalizarTelefone(entrada)).toBe(saida));
  it.each(['', '123', 'abc', '+1234567890123456'])('recusa %s', (entrada) => expect(normalizarTelefone(entrada)).toBeNull());
  it('recusa nulo', () => expect(normalizarTelefone(null)).toBeNull());
});

it('gera ligação de WhatsApp só com telefone válido', () => {
  expect(ligacaoWhatsApp('+351 900 000 002', 'Olá & até já')).toBe('https://wa.me/351900000002?text=Ol%C3%A1%20%26%20at%C3%A9%20j%C3%A1');
  expect(ligacaoWhatsApp('123', 'x')).toBeNull();
});

it('gera mailto só com e-mail válido e codifica assunto e corpo', () => {
  expect(ligacaoEmail('rui@exemplo.pt', 'T2 & cia', 'a\nb')).toBe('mailto:rui@exemplo.pt?subject=T2%20%26%20cia&body=a%0Ab');
  expect(ligacaoEmail('rui@exemplo.pt?bcc=x@y.pt', 'a', 'b')).toBeNull();
  expect(ligacaoEmail(null, 'a', 'b')).toBeNull();
});

it('monta o assunto', () => {
  expect(assuntoEmail(imovel)).toBe('T2 em Telheiras, ref. CSP-20771');
  expect(assuntoEmail({ ...imovel, referencia: null })).toBe('T2 em Telheiras');
});

it('escolhe o canal padrão', () => {
  expect(canalPadrao(imovel)).toBe('whatsapp');
  expect(canalPadrao({ ...imovel, telefone: null })).toBe('email');
  expect(canalPadrao({ ...imovel, telefone: null, email: null })).toBeNull();
});
