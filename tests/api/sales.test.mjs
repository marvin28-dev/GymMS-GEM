// Products and sales (J-17): every product has a code of its own and a cost
// price, stock only moves through sales and restocks, a sale charges the
// offer price and keeps what the item cost, and two desks can never sell the
// same last item.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startServer } from './helpers/server.mjs';
import { registerGym, addStaff, uniqueCode } from './helpers/fixtures.mjs';

let api, stop, gym, desk, trainer;
const product = (body = {}, token = gym.token) => api.post('/api/products', {
  name: 'Whey Protein', code: uniqueCode('P').toUpperCase(), category: 'Supplements', price: 10000, costPrice: 6000, stock: 10, ...body,
}, { token });
const sell = (items, body = {}, token = desk.token) => api.post('/api/sales', { items, method: 'Cash', ...body }, { token });
const stockOf = async (id) => (await api.get('/api/products', { token: gym.token })).body.find(p => p.id === id)?.stock;

beforeAll(async () => {
  ({ api, stop } = await startServer());
  gym = await registerGym(api);
  desk = await addStaff(api, gym, { role: 'front_desk' });
  trainer = await addStaff(api, gym, { role: 'trainer' });
});
afterAll(() => stop());

describe('a product', () => {
  it('needs a name, a code, a price above zero and a cost price', async () => {
    for (const missing of [{ name: '' }, { code: '' }, { price: 0 }, { price: 'abc' }, { costPrice: undefined }]) {
      const res = await product(missing);
      expect(res.status, JSON.stringify(missing)).toBe(400);
    }
  });

  it('keeps its code in capitals, and no two products in a gym share one', async () => {
    const code = uniqueCode('whep');
    const first = await product({ code });
    expect(first.status).toBe(201);
    expect(first.body.code).toBe(code.toUpperCase());
    const again = await product({ code: ` ${code.toUpperCase()} ` });
    expect(again.status).toBe(409);
  });

  it('answers 409, not 500, to every product made with one code at the same moment but the first', async () => {
    // Several rounds of six: the clash only reaches the database when the
    // requests overlap, which two alone often do not
    for (let round = 0; round < 3; round += 1) {
      const code = uniqueCode('twin').toUpperCase();
      const results = await Promise.all([1, 2, 3, 4, 5, 6].map(() => product({ code })));
      expect(results.map(r => r.status).sort()).toEqual([201, 409, 409, 409, 409, 409]);
    }
  });

  it('may use a code another gym uses', async () => {
    const other = await registerGym(api);
    const code = uniqueCode('both').toUpperCase();
    expect((await product({ code })).status).toBe(201);
    expect((await product({ code }, other.token)).status).toBe(201);
  });

  it('refuses an offer outside 1 to 99 percent', async () => {
    expect((await product({ discountPercent: 100 })).status).toBe(400);
    expect((await product({ discountPercent: 150 })).status).toBe(400);
    expect((await product({ discountPercent: 20 })).status).toBe(201);
  });

  it('refuses an edit whose cost price is not a number, and keeps the old one', async () => {
    const { body: p } = await product();
    const res = await api.patch(`/api/products/${p.id}`, { costPrice: 'abc' }, { token: gym.token });
    expect(res.status).toBe(400);
    expect((await api.get('/api/products', { token: gym.token })).body.find(x => x.id === p.id).costPrice).toBe(6000);
  });

  it('keeps its stock when an edit sends one; only a restock adds to it', async () => {
    const { body: p } = await product({ stock: 3 });
    const edit = await api.patch(`/api/products/${p.id}`, { stock: 50, price: 12000 }, { token: gym.token });
    expect(edit.status).toBe(200);
    expect(edit.body).toMatchObject({ stock: 3, price: 12000 });
    const restocks = await Promise.all([4, 5].map(quantity => api.post(`/api/products/${p.id}/restock`, { quantity }, { token: desk.token })));
    expect(restocks.map(r => r.status)).toEqual([200, 200]);
    expect(await stockOf(p.id)).toBe(12);
    expect((await api.post(`/api/products/${p.id}/restock`, { quantity: 0 }, { token: desk.token })).status).toBe(400);
  });

  it('is not a trainer\'s to add or restock', async () => {
    expect((await product({}, trainer.token)).status).toBe(403);
    const { body: p } = await product();
    expect((await api.post(`/api/products/${p.id}/restock`, { quantity: 2 }, { token: trainer.token })).status).toBe(403);
  });

  it('is deleted when it was never sold, and retired once it was', async () => {
    const { body: unsold } = await product();
    expect((await api.del(`/api/products/${unsold.id}`, { token: gym.token })).status).toBe(200);
    expect(await stockOf(unsold.id)).toBeUndefined();

    const { body: sold } = await product();
    expect((await sell([{ productId: sold.id, quantity: 1 }])).status).toBe(201);
    const res = await api.del(`/api/products/${sold.id}`, { token: gym.token });
    expect(res.body.deactivated).toBe(true);
    const kept = (await api.get('/api/products', { token: gym.token })).body.find(x => x.id === sold.id);
    expect(kept.status).toBe('inactive');
    expect((await sell([{ productId: sold.id, quantity: 1 }])).status).toBe(400);
  });

  it('is deleted by management only', async () => {
    const { body: p } = await product();
    expect((await api.del(`/api/products/${p.id}`, { token: desk.token })).status).toBe(403);
  });

  // D-35: the desk could put an item at 99% off, or move its cost and with it
  // the profit that revenue is built on
  it("has its prices, offer and sale status set by management; the desk adds, edits details and restocks", async () => {
    const added = await product({ name: 'Desk Water' }, desk.token);
    expect(added.status).toBe(201);
    const p = added.body;
    expect((await product({ discountPercent: 10 }, desk.token)).body.field).toBe('discountPercent');

    const asDesk = (body) => api.patch(`/api/products/${p.id}`, body, { token: desk.token });
    // The edit form sends every field back unchanged; only the name moves
    const renamed = await asDesk({ name: 'Still Water', price: p.price, costPrice: p.costPrice, discountPercent: null, status: 'active' });
    expect(renamed.status).toBe(200);
    expect(renamed.body.name).toBe('Still Water');
    for (const [body, field] of [[{ price: 1 }, 'price'], [{ costPrice: 1 }, 'costPrice'], [{ discountPercent: 50 }, 'discountPercent'], [{ status: 'inactive' }, 'isActive']]) {
      const refused = await asDesk(body);
      expect(refused.status, field).toBe(403);
      expect(refused.body.field).toBe(field);
    }
    expect((await api.post(`/api/products/${p.id}/restock`, { quantity: 2 }, { token: desk.token })).status).toBe(200);
    const kept = (await api.get('/api/products', { token: gym.token })).body.find(x => x.id === p.id);
    expect(kept).toMatchObject({ name: 'Still Water', price: 10000, costPrice: 6000, discountPercent: null, isActive: true, stock: 12 });

    const manager = await addStaff(api, gym, { role: 'manager' });
    expect((await api.patch(`/api/products/${p.id}`, { price: 12000, discountPercent: 10 }, { token: manager.token })).body).toMatchObject({ price: 12000, discountPercent: 10 });
  });
});

describe('a sale', () => {
  it('charges the offer price, records it with what the item cost, and takes the stock', async () => {
    const { body: p } = await product({ price: 10000, costPrice: 6000, discountPercent: 15, stock: 5 });
    const res = await sell([{ productId: p.id, quantity: 2 }], { method: 'Mobile Money' });
    expect(res.status).toBe(201);
    expect(res.body.total).toBe(17000);
    expect(res.body.method).toBe('mobile_money');
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0]).toMatchObject({ quantity: 2, unitPrice: 8500, unitCost: 6000 });
    expect(res.body.stock).toEqual([{ id: p.id, stock: 3 }]);
    expect(await stockOf(p.id)).toBe(3);
  });

  it('keeps the cost it was sold at when the cost price changes later', async () => {
    const { body: p } = await product({ costPrice: 4000 });
    const { body: sale } = await sell([{ productId: p.id, quantity: 1 }]);
    await api.patch(`/api/products/${p.id}`, { costPrice: 9000 }, { token: gym.token });
    const listed = (await api.get('/api/sales', { token: gym.token })).body.find(s => s.id === sale.id);
    expect(listed.items[0].unitCost).toBe(4000);
  });

  it('puts two lines of one product together', async () => {
    const { body: p } = await product({ stock: 10 });
    const res = await sell([{ productId: p.id, quantity: 1 }, { productId: p.id, quantity: 2 }]);
    expect(res.status).toBe(201);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].quantity).toBe(3);
    expect(await stockOf(p.id)).toBe(7);
  });

  it('sells nothing when one line asks for more than is left', async () => {
    const { body: plenty } = await product({ stock: 10 });
    const { body: scarce } = await product({ stock: 1 });
    const res = await sell([{ productId: plenty.id, quantity: 2 }, { productId: scarce.id, quantity: 2 }]);
    expect(res.status).toBe(409);
    expect(await stockOf(plenty.id)).toBe(10);
    expect(await stockOf(scarce.id)).toBe(1);
  });

  it('of the last item from two desks at the same moment goes through once', async () => {
    const { body: p } = await product({ stock: 1 });
    const results = await Promise.all([sell([{ productId: p.id, quantity: 1 }]), sell([{ productId: p.id, quantity: 1 }], {}, gym.token)]);
    expect(results.map(r => r.status).sort()).toEqual([201, 409]);
    expect(await stockOf(p.id)).toBe(0);
    const sold = (await api.get('/api/sales', { token: gym.token })).body.filter(s => s.items.some(i => i.productId === p.id));
    expect(sold).toHaveLength(1);
  });

  it('refuses an empty cart, a quantity under one, and another gym\'s product', async () => {
    const { body: p } = await product();
    expect((await sell([])).status).toBe(400);
    expect((await sell([{ productId: p.id, quantity: 0 }])).status).toBe(400);
    const other = await registerGym(api);
    expect((await sell([{ productId: p.id, quantity: 1 }], {}, other.token)).status).toBe(404);
    expect(await stockOf(p.id)).toBe(10);
  });

  it('is not a trainer\'s to record', async () => {
    const { body: p } = await product();
    expect((await sell([{ productId: p.id, quantity: 1 }], {}, trainer.token)).status).toBe(403);
  });

  it('is listed by the local day it was made on', async () => {
    const { body: p } = await product();
    const { body: sale } = await sell([{ productId: p.id, quantity: 1 }]);
    const made = new Date(sale.createdAt);
    // Douala is UTC+1: getTimezoneOffset() says -60
    const local = new Date(made.getTime() + 60 * 60000).toISOString().slice(0, 10);
    const dayAfter = new Date(made.getTime() + 60 * 60000 + 864e5).toISOString().slice(0, 10);
    const on = await api.get(`/api/sales?date=${local}&tz=-60`, { token: gym.token });
    expect(on.body.some(s => s.id === sale.id)).toBe(true);
    const next = await api.get(`/api/sales?date=${dayAfter}&tz=-60`, { token: gym.token });
    expect(next.body.some(s => s.id === sale.id)).toBe(false);
  });
});

// D-24: a trainer could read every sale, which none of their screens show
describe('reading the sales', () => {
  it('is for management and the desk, not for trainers', async () => {
    expect((await api.get('/api/sales', { token: trainer.token })).status).toBe(403);
    expect((await api.get('/api/sales', { token: desk.token })).status).toBe(200);
    expect((await api.get('/api/sales', { token: gym.token })).status).toBe(200);
  });
});

// D-35: a discount on the whole sale, up to 100%, could be typed at any desk
describe('a discount on a sale', () => {
  it('is given by management only, and a refused sale takes no stock', async () => {
    const { body: p } = await product({ price: 10000, stock: 5 });
    const refused = await sell([{ productId: p.id, quantity: 1 }], { discount: 50 });
    expect(refused.status).toBe(403);
    expect(refused.body.field).toBe('discount');
    expect(await stockOf(p.id)).toBe(5);
    const given = await sell([{ productId: p.id, quantity: 1 }], { discount: 10 }, gym.token);
    expect(given.status).toBe(201);
    expect(given.body.total).toBe(9000);
    expect((await sell([{ productId: p.id, quantity: 1 }], { discount: 0 })).status).toBe(201);
  });
});

describe('how a sale was paid', () => {
  it('refuses a method the app does not know and leaves the stock alone (D-54)', async () => {
    const p = (await product({ stock: 5 })).body;
    const res = await sell([{ productId: p.id, quantity: 1 }], { method: 'Bitcoin' });
    expect(res.status).toBe(400);
    expect(res.body.field).toBe('method');
    expect(await stockOf(p.id)).toBe(5);
  });
});
