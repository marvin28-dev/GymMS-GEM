// D-33: five pages showed support contacts that may not have been GEM's. The
// owner gave GEM's own on 30 October 2026 (WhatsApp only, and an email); they
// are written once in utils/support.js, and a build may name others.
import { describe, it, expect, vi, afterEach } from 'vitest';

const load = async () => { vi.resetModules(); return import('../../gem-frontend/src/utils/support.js'); };
afterEach(() => vi.unstubAllEnvs());

describe("GEM's support contacts", () => {
  it("are the owner's when the build names none, the number as a WhatsApp link with its country code", async () => {
    vi.stubEnv('VITE_SUPPORT_EMAIL', '');
    vi.stubEnv('VITE_SUPPORT_WHATSAPP', '');
    const { hasSupport, SUPPORT } = await load();
    expect(hasSupport).toBe(true);
    expect(SUPPORT).toEqual({
      email: 'marvin.ekokobe01@gmail.com',
      whatsapp: '13439889766',
      whatsappUrl: 'https://wa.me/13439889766',
      whatsappLabel: '+1 343 988 9766',
    });
  });

  it('read the email, and the WhatsApp number with its country code however it is written', async () => {
    vi.stubEnv('VITE_SUPPORT_EMAIL', ' help@gem.example ');
    vi.stubEnv('VITE_SUPPORT_WHATSAPP', '+237 670 00-00-00');
    const { hasSupport, SUPPORT } = await load();
    expect(hasSupport).toBe(true);
    expect(SUPPORT).toEqual({ email: 'help@gem.example', whatsapp: '237670000000', whatsappUrl: 'https://wa.me/237670000000', whatsappLabel: '+237670000000' });
  });
});
