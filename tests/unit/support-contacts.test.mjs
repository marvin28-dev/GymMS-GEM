// D-33: five pages showed support contacts that may not have been GEM's. They
// now come from the build's settings, and nothing is offered until they are set.
import { describe, it, expect, vi, afterEach } from 'vitest';

const load = async () => { vi.resetModules(); return import('../../gem-frontend/src/utils/support.js'); };
afterEach(() => vi.unstubAllEnvs());

describe("GEM's support contacts", () => {
  it('offer nothing until they are set', async () => {
    vi.stubEnv('VITE_SUPPORT_EMAIL', '');
    vi.stubEnv('VITE_SUPPORT_WHATSAPP', '');
    const { hasSupport, SUPPORT } = await load();
    expect(hasSupport).toBe(false);
    expect(SUPPORT).toMatchObject({ email: '', whatsapp: '', whatsappUrl: '' });
  });

  it('read the email, and the WhatsApp number with its country code however it is written', async () => {
    vi.stubEnv('VITE_SUPPORT_EMAIL', ' help@gem.example ');
    vi.stubEnv('VITE_SUPPORT_WHATSAPP', '+237 670 00-00-00');
    const { hasSupport, SUPPORT } = await load();
    expect(hasSupport).toBe(true);
    expect(SUPPORT).toEqual({ email: 'help@gem.example', whatsapp: '237670000000', whatsappUrl: 'https://wa.me/237670000000', whatsappLabel: '+237670000000' });
  });
});
