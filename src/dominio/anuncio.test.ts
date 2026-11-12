import { describe, expect, it } from 'vitest';
import { interpretarUrlAnuncio } from './anuncio';

describe('interpretarUrlAnuncio', () => {
  it('reconhece o portal e limpa query, hash e barra final', () => {
    expect(interpretarUrlAnuncio('https://www.imovirtual.com/pt/anuncio/t2-lumiar-ID1?utm_source=x#foto/')).toEqual({
      portal: 'Imovirtual',
      chave: 'imovirtual.com/pt/anuncio/t2-lumiar-ID1',
      url: 'https://www.imovirtual.com/pt/anuncio/t2-lumiar-ID1?utm_source=x',
    });
  });
  it('chave igual para as variantes do mesmo anúncio', () => {
    const variantes = ['https://www.imovirtual.com/x/', 'http://m.imovirtual.com/x?utm_source=a', 'imovirtual.com/x#foto', 'HTTPS://WWW.IMOVIRTUAL.COM/x/?fbclid=1&gclid=2'];
    for (const v of variantes) expect(interpretarUrlAnuncio(v)).toMatchObject({ portal: 'Imovirtual', chave: 'imovirtual.com/x' });
  });
  it('remove tracking e ordena os restantes parâmetros, também em portal desconhecido', () => {
    expect(interpretarUrlAnuncio('https://exemplo.pt/p/?utm_medium=a&b=2&a=1&gclid=z')?.chave).toBe('exemplo.pt/p?a=1&b=2');
  });
  it('reconhece Casa Sapo e CasaYes', () => {
    expect(interpretarUrlAnuncio('https://casa.sapo.pt/x/')?.portal).toBe('Casa Sapo');
    expect(interpretarUrlAnuncio('https://casayes.pt/x')?.portal).toBe('CasaYes');
  });
  it('em portal desconhecido mantém a query na chave', () => {
    expect(interpretarUrlAnuncio('https://exemplo.pt/ver?id=7')).toMatchObject({ portal: 'Outro', chave: 'exemplo.pt/ver?id=7' });
  });
  it('não confunde domínio parecido com o portal', () => {
    expect(interpretarUrlAnuncio('https://imovirtual.com.falso.pt/a')?.portal).toBe('Outro');
  });
  it('recusa protocolo que não seja http ou https e texto inválido', () => {
    expect(interpretarUrlAnuncio('javascript:alert(1)')).toBeNull();
    expect(interpretarUrlAnuncio('não é url')).toBeNull();
  });
});
