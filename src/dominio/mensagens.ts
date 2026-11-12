import type { CampoEmFalta, Canal, Imovel, Portal } from './tipos';

const ARTIGO: Record<Portal, string> = {
  Imovirtual: 'no Imovirtual', 'Casa Sapo': 'na Casa Sapo', CasaYes: 'na CasaYes', Outro: 'online',
};

export function formatarPreco(n: number): string {
  const [inteiro = '0', decimal] = n.toFixed(Number.isInteger(n) ? 0 : 2).split('.');
  return `${inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}${decimal ? `,${decimal}` : ''} €`;
}

export function mensagemParaConsultor(i: Imovel, emFalta: CampoEmFalta[]): string {
  const nome = i.consultorNome?.trim().split(/\s+/)[0];
  const saudacao = nome ? `Olá, ${nome}.` : `Olá, equipa da ${i.imobiliaria}.`;
  const referencia = i.referencia ? `, referência ${i.referencia}` : '';
  // cita o portal do anúncio com o preço que vai na mensagem (imoveis.preco = mínimo dos anúncios)
  const comPreco = i.anuncios.filter((a) => typeof a.preco === 'number');
  const doPreco = comPreco.length ? comPreco.reduce((m, a) => (a.preco! < m.preco! ? a : m)) : i.anuncios[0];
  const onde = ARTIGO[doPreco?.portal ?? 'Outro'];
  const perguntaAno = emFalta.includes('ano') ? ' Pode indicar-me o ano de construção?' : '';
  const perguntaGaragem = emFalta.includes('garagem') ? ' Pode confirmar se inclui garagem?' : '';
  return `${saudacao} Tenho um comprador interessado no ${i.tipologia} em ${i.zona}${referencia}, anunciado ${onde} por ${formatarPreco(i.preco)}. O imóvel continua disponível?${perguntaAno}${perguntaGaragem} Obrigado.`;
}

export function assuntoEmail(i: Imovel): string {
  return `${i.tipologia} em ${i.zona}${i.referencia ? `, ref. ${i.referencia}` : ''}`;
}

export function normalizarTelefone(t: string | null): string | null {
  if (!t) return null;
  const limpo = t.trim();
  const internacional = limpo.startsWith('+') || limpo.startsWith('00');
  let digitos = limpo.replace(/\D/g, '');
  if (limpo.startsWith('00')) digitos = digitos.slice(2);
  const nacional = /^[29]\d{8}$/.test(digitos);
  if (internacional) {
    if (nacional) return null; // "+912345678": nove dígitos nacionais com + e sem indicativo
  } else {
    if (!nacional) return null; // sem + nem 00: só número português de 9 dígitos
    digitos = `351${digitos}`;
  }
  return /^[1-9]\d{7,14}$/.test(digitos) ? digitos : null;
}

export function ligacaoWhatsApp(telefone: string | null, texto: string): string | null {
  const numero = normalizarTelefone(telefone);
  return numero ? `https://wa.me/${numero}?text=${encodeURIComponent(texto)}` : null;
}

const EMAIL_VALIDO = /^[^\s@<>,;:"?&%#]+@[^\s@<>,;:"?&%#]+\.[^\s@<>,;:"?&%#]+$/;

export function ligacaoEmail(email: string | null, assunto: string, corpo: string): string | null {
  if (!email || !EMAIL_VALIDO.test(email.trim())) return null;
  return `mailto:${email.trim()}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(corpo)}`;
}

export function canalPadrao(i: Imovel): Canal | null {
  if (normalizarTelefone(i.telefone)) return 'whatsapp';
  if (i.email && EMAIL_VALIDO.test(i.email.trim())) return 'email';
  return null;
}
