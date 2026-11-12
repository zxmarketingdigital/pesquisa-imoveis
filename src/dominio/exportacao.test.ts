import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { CABECALHOS, gerarCSV, gerarXLSX, type LinhaExportacao } from './exportacao';

const linha: LinhaExportacao = {
  comprador: 'Ana R.', referencia: 'R1', portais: 'Imovirtual, Casa Sapo', tipologia: 'T2', preco: 395000, areaM2: 84,
  concelho: 'Lisboa', zona: 'Lumiar', ano: '2024', garagem: 'Sim', consultor: 'Marta "M" Exemplo', imobiliaria: 'Norte',
  telefone: '+351 900 000 001', email: 'm@exemplo.pt', estado: 'Por contactar',
  fotoUrl: 'https://f.exemplo/1.jpg', links: 'https://a.pt/1 | https://b.pt/2',
};

describe('gerarCSV', () => {
  const linhas = gerarCSV([linha]).replace('﻿', '').split('\r\n');
  it('começa com BOM e usa ponto e vírgula', () => {
    expect(gerarCSV([linha]).startsWith('﻿')).toBe(true);
    expect(linhas[0]).toBe(CABECALHOS.map((c) => `"${c}"`).join(';'));
  });
  it('escapa aspas e prefixa o telefone com +, que o Excel leria como fórmula', () => {
    expect(linhas[1]).toContain('"Marta ""M"" Exemplo"');
    expect(linhas[1]).toContain(`"'+351 900 000 001"`);
  });
  it('neutraliza fórmula em qualquer campo de texto', () => {
    const csv = gerarCSV([{ ...linha, consultor: '=HYPERLINK("x")', telefone: '+SOMA(1)' }]);
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
    expect(csv).toContain(`"'+SOMA(1)"`);
  });
});

describe('gerarCSV: neutralização', () => {
  const corpo = (campos: Partial<LinhaExportacao>) => gerarCSV([{ ...linha, ...campos }]).split('\r\n')[1]!;
  it.each(['-1+2', '@SOMA(1)', '\tcmd', '\rcmd', '=1+1', '+1+1'])('prefixa %j em campo de texto', (valor) => {
    expect(corpo({ consultor: valor })).toContain(`"'${valor.replace(/"/g, '""')}"`);
  });
  it('quebra de linha dentro do campo fica entre aspas', () => {
    expect(corpo({ consultor: 'a\nb' })).toContain('"a\nb"');
  });
  it('telefone com + (com espaços, - ou ()) leva sempre o prefixo', () => {
    expect(corpo({ telefone: '+351 (21) 123-4567' })).toContain(`"'+351 (21) 123-4567"`);
    expect(corpo({ telefone: '+351 912 345 678' })).toContain(`"'+351 912 345 678"`);
    expect(corpo({ telefone: '-1+2' })).toContain(`"'-1+2"`);
  });
  it.each(['00351 912 345 678', '912345678', '+351 912345678'])('telefone %s sai como texto', (telefone) => {
    expect(corpo({ telefone })).toContain(`"'${telefone}"`);
  });
});

describe('gerarXLSX', () => {
  const JPEG = Uint8Array.from(atob('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAAA//EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AN//Z'), (c) => c.charCodeAt(0)).buffer;

  it('embute a foto e escreve texto como texto', async () => {
    const { dados, semFoto } = await gerarXLSX([{ ...linha, consultor: '=1+1' }], async () => JPEG);
    expect(semFoto).toBe(0);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(dados);
    const folha = wb.worksheets[0]!;
    expect(folha.getImages()).toHaveLength(1);
    expect(folha.getRow(1).getCell(1).value).toBe('Foto');
    expect(folha.getRow(2).getCell(12).value).toBe('=1+1');
  });

  it('telefone vai como texto no XLSX, sem perder zeros nem o +', async () => {
    for (const telefone of ['00351 912 345 678', '912345678', '+351 912345678']) {
      const { dados } = await gerarXLSX([{ ...linha, telefone }], async () => JPEG);
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(dados);
      const folha = wb.worksheets[0]!;
      const coluna = (folha.getRow(1).values as unknown[]).indexOf('Telefone');
      expect(folha.getRow(2).getCell(coluna).value).toBe(telefone);
    }
  });

  it('conta foto que falhou e continua', async () => {
    const { dados, semFoto } = await gerarXLSX([linha], async () => { throw new Error('falhou'); });
    expect(semFoto).toBe(1);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(dados);
    expect(wb.worksheets[0]!.getImages()).toHaveLength(0);
  });
});
