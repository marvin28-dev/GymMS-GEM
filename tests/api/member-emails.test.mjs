// D-23: members were written to in English only. A gym chooses English or
// French for the emails and receipts its members receive.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startServer, outbox, backend } from './helpers/server.mjs';
import { registerGym, addMember, eventually, uniqueCode } from './helpers/fixtures.mjs';

let api, stop;
const mailFor = (to, subject) => eventually(() => outbox().filter(m => m.to === to && subject.test(m.subject)).at(-1));

beforeAll(async () => { ({ api, stop } = await startServer()); });
afterAll(() => stop());

describe("the language of members' emails", () => {
  it('is English or French, chosen on the gym', async () => {
    const gym = await registerGym(api);
    expect((await api.patch('/api/gyms/me', { settings: { emailLanguage: 'fr' } }, { token: gym.token })).status).toBe(200);
    const refused = await api.patch('/api/gyms/me', { settings: { emailLanguage: 'de' } }, { token: gym.token });
    expect(refused.status).toBe(400);
    expect(refused.body.field).toBe('emailLanguage');
    expect((await api.get('/api/gyms/me', { token: gym.token })).body.settings.emailLanguage).toBe('fr');
  });

  it('writes the welcome and the receipt in French for a French gym', async () => {
    const gym = await registerGym(api);
    await api.patch('/api/gyms/me', { settings: { emailLanguage: 'fr' } }, { token: gym.token });
    const email = `fr.${uniqueCode('e')}@example.test`;
    const member = await addMember(api, gym.token, { firstName: 'Awa', email, balance: 10000 });

    const welcome = await mailFor(email, /Bienvenue chez/);
    expect(welcome).toBeTruthy();
    expect(welcome.html).toContain('lang="fr"');
    expect(welcome.html).toContain('Bonjour Awa,');
    expect(welcome.html).toContain('Numéro de membre');
    expect(welcome.html).toContain('Envoyé avec GEM');

    await api.post('/api/payments', { memberId: member.id, amount: 5000, method: 'cash', type: 'membership' }, { token: gym.token });
    const receipt = await mailFor(email, /Reçu de paiement/);
    expect(receipt).toBeTruthy();
    expect(receipt.html).toContain('Espèces');
    expect(receipt.html).toContain('Reste à payer');
    expect(receipt.attachments).toHaveLength(1);
  });

  it('stays in English for a gym that has not chosen', async () => {
    const gym = await registerGym(api);
    const email = `en.${uniqueCode('e')}@example.test`;
    await addMember(api, gym.token, { firstName: 'Ben', email });
    const welcome = await mailFor(email, /Welcome to/);
    expect(welcome.html).toContain('Hi Ben,');
    expect(welcome.html).toContain('lang="en"');
  });

  it('credits Ekoteksolutions at the foot of every email and on the receipt, in its language', async () => {
    const en = await registerGym(api);
    const enEmail = `credit.${uniqueCode('e')}@example.test`;
    await addMember(api, en.token, { firstName: 'Cleo', email: enEmail });
    expect((await mailFor(enEmail, /Welcome to/)).html).toContain('Sent with GEM · Powered by Ekoteksolutions');

    const fr = await registerGym(api);
    await api.patch('/api/gyms/me', { settings: { emailLanguage: 'fr' } }, { token: fr.token });
    const frEmail = `credit.${uniqueCode('e')}@example.test`;
    await addMember(api, fr.token, { firstName: 'Cleo', email: frEmail });
    expect((await mailFor(frEmail, /Bienvenue chez/)).html).toContain('Envoyé avec GEM · Propulsé par Ekoteksolutions');

    const { TEXT } = backend('./utils/memberEmailText.js');
    expect(TEXT.en.pdf.poweredBy).toBe('GEM · Powered by Ekoteksolutions');
    expect(TEXT.fr.pdf.poweredBy).toBe('GEM · Propulsé par Ekoteksolutions');
  });

  it('prints the receipt PDF in either language', async () => {
    const { buildReceiptPdf } = backend('./utils/receiptPdf.js');
    const args = { gym: { name: 'Salle Test', country: 'Cameroon' }, member: { firstName: 'Awa', lastName: 'Diallo', memberCode: 'GEM-0001' }, payment: { amount: 5000, method: 'mobile_money', reference: 'TXN-1', createdAt: new Date() }, currencyCode: 'XAF' };
    for (const lang of ['en', 'fr']) {
      const pdf = await buildReceiptPdf({ ...args, lang });
      expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    }
  });
});
