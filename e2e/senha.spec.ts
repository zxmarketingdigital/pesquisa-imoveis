import { execSync } from 'node:child_process';
import { expect, test, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { loadEnv } from 'vite';
import config from '../playwright.config';

// Convite e recuperação contra o Supabase LOCAL: e-mails vão para o Mailpit (54324), nunca para fora.
const env = Object.fromEntries(execSync('supabase status -o env', { encoding: 'utf8' }).split('\n')
  .map(l => l.match(/^([A-Z_]+)="?(.*?)"?$/)).filter((m): m is RegExpMatchArray => !!m).map(m => [m[1], m[2]]));
const API = env.API_URL; const MAILPIT = env.MAILPIT_URL ?? env.INBUCKET_URL;
// Guarda: Supabase do teste, Supabase que a app de dev usa e a própria app têm de ser locais.
const local = (u?: string) => { try { return ['127.0.0.1', 'localhost'].includes(new URL(u ?? '').hostname); } catch { return false; } };
const appSupabase = loadEnv('development', process.cwd(), 'VITE_').VITE_SUPABASE_URL;
if (![API, MAILPIT, appSupabase, config.use?.baseURL].every(local)) throw new Error('e2e de senha só corre contra Supabase e app locais');
const admin = createClient(API, env.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

async function linkDoEmail(email: string, tipo: 'invite' | 'recovery', ja: number): Promise<string> {
  for (let i = 0; i < 40; i++) {
    const r = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`).then(x => x.json());
    if (r.messages.length > ja) {
      const m = await fetch(`${MAILPIT}/api/v1/message/${r.messages[0].ID}`).then(x => x.json());
      const href = String(m.HTML).match(/href="([^"]*\/auth\/v1\/verify[^"]*)"/)?.[1]?.replace(/&amp;/g, '&');
      if (href && href.includes(`type=${tipo}`)) return href;
    }
    await new Promise(r => setTimeout(r, 250));
  }
  throw new Error(`e-mail ${tipo} não chegou a ${email}`);
}
const contar = async (email: string) => (await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`).then(x => x.json())).messages.length as number;

async function entrar(page: Page, email: string, senha: string) {
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Palavra-passe', { exact: true }).fill(senha);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('heading', { name: 'Compradores' })).toBeVisible();
}
async function sair(page: Page) {
  await page.getByRole('button', { name: 'Sair' }).click();
  await expect(page.getByRole('heading', { name: 'Mesa do Consultor' })).toBeVisible();
}

test('convite → definir senha → recuperação', async ({ page }) => {
  const email = `convite-${Date.now()}@teste.local`;
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo: 'http://localhost:5173/' });
  expect(error).toBeNull();
  try {
    // convite: o link entra e pede a palavra-passe antes da Mesa
    await page.goto(await linkDoEmail(email, 'invite', 0));
    await expect(page.getByRole('heading', { name: 'Bem-vindo à Mesa do Consultor' })).toBeVisible();
    await page.reload(); // recarregar não salta o ecrã
    await expect(page.getByRole('heading', { name: 'Bem-vindo à Mesa do Consultor' })).toBeVisible();
    await page.getByLabel('Nova palavra-passe', { exact: true }).fill('curta');
    await page.getByLabel('Confirmar palavra-passe').fill('curta');
    await page.getByRole('button', { name: 'Guardar palavra-passe' }).click();
    await expect(page.getByRole('alert')).toContainText('pelo menos 8');
    await page.getByLabel('Nova palavra-passe', { exact: true }).fill('senha-convite-1');
    await page.getByLabel('Confirmar palavra-passe').fill('senha-convite-2');
    await page.getByRole('button', { name: 'Guardar palavra-passe' }).click();
    await expect(page.getByRole('alert')).toContainText('não coincidem');
    await page.getByLabel('Confirmar palavra-passe').fill('senha-convite-1');
    await page.getByRole('button', { name: 'Guardar palavra-passe' }).click();
    await expect(page.getByRole('heading', { name: 'Compradores' })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Compradores' })).toBeVisible();
    await sair(page);
    await entrar(page, email, 'senha-convite-1');
    await sair(page);

    // recuperação: mensagem neutra, link pede nova palavra-passe
    const antes = await contar(email);
    await page.getByRole('button', { name: 'Esqueci a palavra-passe' }).click();
    await page.getByLabel('E-mail').fill(email);
    await page.getByRole('button', { name: 'Enviar link' }).click();
    await expect(page.getByRole('status')).toContainText('Se o e-mail estiver registado');
    await page.goto(await linkDoEmail(email, 'recovery', antes));
    await expect(page.getByRole('heading', { name: 'Definir nova palavra-passe' })).toBeVisible();
    await page.getByLabel('Nova palavra-passe', { exact: true }).fill('senha-recuperada-2');
    await page.getByLabel('Confirmar palavra-passe').fill('senha-recuperada-2');
    await page.getByRole('button', { name: 'Guardar palavra-passe' }).click();
    await expect(page.getByRole('heading', { name: 'Compradores' })).toBeVisible();
    await sair(page);
    await entrar(page, email, 'senha-recuperada-2');
  } finally {
    if (data.user) await admin.auth.admin.deleteUser(data.user.id);
  }
});

test('e-mail inexistente recebe a mesma mensagem neutra', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Esqueci a palavra-passe' }).click();
  await page.getByLabel('E-mail').fill(`ninguem-${Date.now()}@teste.local`);
  await page.getByRole('button', { name: 'Enviar link' }).click();
  await expect(page.getByRole('status')).toContainText('Se o e-mail estiver registado');
});

test('link expirado mostra aviso e abre a recuperação', async ({ page }) => {
  await page.goto('/#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired');
  await expect(page.getByRole('alert')).toContainText('expirou');
  await expect(page.getByRole('button', { name: 'Enviar link' })).toBeVisible();
});
