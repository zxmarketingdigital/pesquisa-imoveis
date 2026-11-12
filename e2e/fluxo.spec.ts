import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import ExcelJS from 'exceljs';

const FOTO = { name: 'foto.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==', 'base64') };

async function entrar(page: Page, email: string, senha: string) {
  await page.goto('/');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Palavra-passe').fill(senha);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('heading', { name: 'Compradores' })).toBeVisible();
}

async function registar(page: Page, d: { url: string; ref?: string; imobiliaria: string; preco: string; zona: string; ano?: string; garagem?: string; consultor?: string; telefone?: string; foto?: boolean }) {
  await page.getByRole('button', { name: 'Registar anúncio' }).click();
  const dialogo = page.getByRole('dialog', { name: 'Registar anúncio' });
  await dialogo.getByLabel('Link do anúncio').fill(d.url);
  if (d.ref) await dialogo.getByLabel('Referência').fill(d.ref);
  await dialogo.getByLabel('Imobiliária').fill(d.imobiliaria);
  await dialogo.getByLabel('Tipologia').selectOption('T2');
  await dialogo.getByLabel('Preço').fill(d.preco);
  await dialogo.getByLabel('Zona').selectOption(`Lisboa/${d.zona}`);
  if (d.ano) await dialogo.getByLabel('Ano de construção').fill(d.ano);
  if (d.garagem) await dialogo.getByLabel('Garagem').selectOption(d.garagem);
  if (d.consultor) await dialogo.getByLabel('Consultor do anúncio').fill(d.consultor);
  if (d.telefone) await dialogo.getByLabel('Telefone').fill(d.telefone);
  if (d.foto) await dialogo.getByLabel('Foto').setInputFiles(FOTO);
  await dialogo.getByRole('button', { name: 'Guardar' }).click();
  await expect(dialogo).toBeHidden();
}

test('percurso do consultor', async ({ page }) => {
  const sufixo = Date.now();
  const comprador = `Ana ${sufixo}`;
  await entrar(page, 'a@teste.local', 'teste-local-a');

  await page.getByRole('button', { name: 'Novo comprador' }).click();
  const form = page.getByRole('dialog', { name: 'Novo comprador' });
  await form.getByLabel('Nome do comprador').fill(comprador);
  await form.getByLabel('Tipologia').selectOption('T2');
  await form.getByLabel('Preço máximo').fill('400000');
  await form.getByLabel('Lumiar').check();
  await form.getByLabel('Telheiras').check();
  await form.getByLabel('Garagem obrigatória').check();
  await form.getByLabel('Menos de (anos)').fill('4');
  await form.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByRole('button', { name: new RegExp(comprador) })).toBeVisible();

  const ref = `REF-${sufixo}`;
  await registar(page, { url: `https://www.imovirtual.com/pt/anuncio/a-${sufixo}`, ref, imobiliaria: `Norte ${sufixo}`, preco: '395000', zona: 'Lumiar', ano: '2024', garagem: 'Sim', consultor: 'Marta Exemplo', telefone: '+351 900 000 001', foto: true });
  await registar(page, { url: `https://casa.sapo.pt/b-${sufixo}`, ref: ` ${ref.toLowerCase()} `, imobiliaria: `Norte ${sufixo}`, preco: '395000', zona: 'Lumiar' });
  await registar(page, { url: `https://casayes.pt/c-${sufixo}`, ref: `CONF-${sufixo}`, imobiliaria: `Sul ${sufixo}`, preco: '389000', zona: 'Telheiras', consultor: 'Rui Fictício', telefone: '+351 900 000 002' });
  await registar(page, { url: `https://casayes.pt/d-${sufixo}`, ref: `CARO-${sufixo}`, imobiliaria: `Sul ${sufixo}`, preco: '500000', zona: 'Lumiar', ano: '2025', garagem: 'Sim' });
  await registar(page, { url: `https://casayes.pt/e-${sufixo}`, ref: `SEM-${sufixo}`, imobiliaria: `Sul ${sufixo}`, preco: '380000', zona: 'Lumiar', ano: '2025', garagem: 'Não' });

  const principal = page.getByRole('row', { name: new RegExp(ref) });
  await expect(principal).toHaveCount(1);
  await expect(principal).toContainText('Imovirtual');
  await expect(principal).toContainText('Casa Sapo');
  await expect(principal).toContainText('Novo');
  await expect(page.getByRole('row', { name: new RegExp(`CARO-${sufixo}`) })).toHaveCount(0);
  await expect(page.getByRole('row', { name: new RegExp(`SEM-${sufixo}`) })).toHaveCount(0);

  const confirmar = page.getByRole('row', { name: new RegExp(`CONF-${sufixo}`) });
  await expect(confirmar).toContainText('A confirmar');
  await confirmar.click();
  const painel = page.getByRole('complementary', { name: 'Contacto' });
  await expect(painel).toContainText('Olá, Rui.');
  await expect(painel).toContainText('Pode indicar-me o ano de construção?');
  await expect(painel).toContainText('Pode confirmar se inclui garagem?');
  await expect(painel.getByRole('link', { name: 'Abrir WhatsApp' })).toHaveAttribute('href', /^https:\/\/wa\.me\/351900000002\?text=/);
  await painel.getByRole('button', { name: 'Marcar como contactado' }).click();
  await expect(confirmar).toContainText('Contactado');
  await painel.getByRole('button', { name: 'Desfazer' }).click();
  await expect(confirmar).toContainText('Por contactar');
  await painel.getByRole('button', { name: 'Marcar como contactado' }).click();
  await painel.getByRole('button', { name: 'Fechar' }).click();

  const [csv] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Exportar CSV' }).click()]);
  const textoCsv = await readFile(await csv.path());
  expect(textoCsv.toString()).toContain(ref);
  expect(textoCsv.toString()).toContain('https://www.imovirtual.com');
  expect(textoCsv.toString()).toContain('/storage/v1/object/public/fotos/');

  const [xlsx] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Exportar Excel' }).click()]);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(await xlsx.path());
  expect(wb.worksheets[0]!.getImages()).toHaveLength(1);

  await page.getByRole('button', { name: 'Atualizar agora' }).click();
  await expect(principal).not.toContainText('Novo');
  await expect(page.getByText('Nenhum portal autorizado')).toBeVisible();

  await page.getByRole('button', { name: 'Sair' }).click();
  await entrar(page, 'b@teste.local', 'teste-local-b');
  await expect(page.getByRole('button', { name: new RegExp(comprador) })).toHaveCount(0);
});

test('link de protocolo perigoso é recusado', async ({ page }) => {
  await entrar(page, 'a@teste.local', 'teste-local-a');
  await page.getByRole('button', { name: 'Registar anúncio' }).click();
  const dialogo = page.getByRole('dialog', { name: 'Registar anúncio' });
  await dialogo.getByLabel('Link do anúncio').fill('javascript:alert(1)');
  await dialogo.getByRole('button', { name: 'Guardar' }).click();
  await expect(dialogo.getByText('Link inválido')).toBeVisible();
});
