import { describe, expect, it } from 'vitest';
import { erroAuth, lerLinkAuth } from './linkAuth';

describe('lerLinkAuth', () => {
  it('reconhece convite com token', () => expect(lerLinkAuth('#access_token=x&refresh_token=y&type=invite')).toEqual({ tipo: 'invite', erro: null }));
  it('reconhece recuperação com token', () => expect(lerLinkAuth('#access_token=x&type=recovery').tipo).toBe('recovery'));
  it('ignora type sem token', () => expect(lerLinkAuth('#type=invite').tipo).toBeNull());
  it('ignora login normal e magic link', () => { expect(lerLinkAuth('').tipo).toBeNull(); expect(lerLinkAuth('#access_token=x&type=magiclink').tipo).toBeNull(); });
  it('link expirado vira aviso', () => { const r = lerLinkAuth('#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid'); expect(r.tipo).toBeNull(); expect(r.erro).toMatch(/expirou/); });
  it('outro erro vira aviso genérico', () => expect(lerLinkAuth('#error=server_error').erro).toMatch(/validar o link/));
});

describe('erroAuth', () => {
  it('traduz códigos conhecidos', () => { expect(erroAuth({ code: 'same_password' })).toMatch(/diferente/); expect(erroAuth({ code: 'over_email_send_rate_limit' })).toMatch(/uma hora/); });
  it('devolve null para desconhecido', () => { expect(erroAuth(new Error('x'))).toBeNull(); expect(erroAuth(null)).toBeNull(); });
});
