export interface LinhaExportacao {
  comprador: string; referencia: string; portais: string; tipologia: string; preco: number; areaM2: number | null;
  concelho: string; zona: string; ano: string; garagem: string; consultor: string; imobiliaria: string;
  telefone: string; email: string; estado: string; fotoUrl: string; links: string;
}

export const CABECALHOS = ['Comprador', 'Referência', 'Portal', 'Tipologia', 'Preço (€)', 'Área (m²)', 'Concelho', 'Zona', 'Ano', 'Garagem', 'Consultor', 'Imobiliária', 'Telefone', 'E-mail', 'Estado do contacto', 'Foto', 'Link do anúncio'] as const;

const valores = (l: LinhaExportacao): Array<string | number> => [
  l.comprador, l.referencia, l.portais, l.tipologia, l.preco, l.areaM2 ?? '', l.concelho, l.zona, l.ano, l.garagem,
  l.consultor, l.imobiliaria, l.telefone, l.email, l.estado, l.fotoUrl, l.links,
];

function celulaCSV(valor: string | number): string {
  let s = String(valor);
  // Qualquer texto que comece por = + - @ tab ou CR leva o prefixo ' (o Excel lê "+351 ..." como fórmula).
  if (typeof valor === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export function gerarCSV(linhas: LinhaExportacao[]): string {
  const cabecalho = CABECALHOS.map((c) => celulaCSV(c)).join(';');
  const corpo = linhas.map((l) => valores(l).map((v) => celulaCSV(v)).join(';'));
  return `﻿${[cabecalho, ...corpo].join('\r\n')}\r\n`;
}

export interface ResultadoXLSX { dados: ArrayBuffer; semFoto: number }

export async function gerarXLSX(
  linhas: LinhaExportacao[],
  obterFoto: (url: string) => Promise<ArrayBuffer>,
): Promise<ResultadoXLSX> {
  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  const folha = wb.addWorksheet('Imóveis');
  folha.addRow(['Foto', ...CABECALHOS.filter((c) => c !== 'Foto')]);
  folha.getRow(1).font = { bold: true };
  folha.getColumn(1).width = 16;
  folha.views = [{ state: 'frozen', ySplit: 1 }];

  let semFoto = 0;
  for (const [i, l] of linhas.entries()) {
    const semColunaFoto = valores(l).filter((_, indice) => CABECALHOS[indice] !== 'Foto');
    const linha = folha.addRow(['', ...semColunaFoto]);
    linha.height = 62;
    if (!l.fotoUrl) { semFoto += 1; continue; }
    try {
      const buffer = await obterFoto(l.fotoUrl);
      // Em Node o ExcelJS exige Buffer; no browser aceita o ArrayBuffer.
      const imagem = typeof Buffer === 'undefined' ? buffer : Buffer.from(buffer);
      const id = wb.addImage({ buffer: imagem as never, extension: 'jpeg' });
      folha.addImage(id, { tl: { col: 0, row: i + 1 }, ext: { width: 110, height: 78 } });
    } catch {
      semFoto += 1;
    }
  }
  const dados = await wb.xlsx.writeBuffer();
  return { dados: dados as ArrayBuffer, semFoto };
}
