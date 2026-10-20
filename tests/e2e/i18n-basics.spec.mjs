// F-094: the receipt printed from the Payments page has its labels, not key
// names. F-080: the page tells the browser which language it is in.
import { test, expect } from '@playwright/test';
import { registerGym, signIn, call, stubPrinting } from './support/session.mjs';

const day = (offset = 0) => new Date(Date.now() + offset * 864e5).toISOString().slice(0, 10);

test('the Payments receipt prints its labels in the chosen language', async ({ page }) => {
  const owner = await registerGym();
  await call('POST', '/members', { token: owner.token, body: { firstName: 'Rhea', lastName: 'Receipt', city: 'Douala', region: 'Littoral', regFeeMethod: 'cash', startDate: day(), endDate: day(30) } });
  const members = await call('GET', '/members', { token: owner.token });
  await call('POST', '/payments', { token: owner.token, body: { memberId: members[0].id, amount: 5000, method: 'cash', type: 'other' } });
  await page.addInitScript(() => { if (/^https?:$/.test(location.protocol)) localStorage.setItem('gem-lang', 'fr'); });
  await signIn(page, owner);
  await stubPrinting(page);
  await page.goto('/payments');
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  await page.getByRole('row').filter({ hasText: 'Rhea Receipt' }).first().click();
  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    page.getByRole('dialog').getByRole('button').filter({ has: page.locator('svg.lucide-printer') }).click(),
  ]);
  await popup.waitForLoadState();
  const text = await popup.locator('body').innerText();
  expect(text).toContain('Reçu de paiement');
  expect(text).not.toMatch(/payments\.(receipt|paymentReceipt|thankYou)/);
});

// F-095: the shared dialogs and buttons speak French too
test('in French, the confirm dialog, the close button and the + button are French', async ({ page }) => {
  const owner = await registerGym();
  await call('POST', '/tasks', { token: owner.token, body: { title: 'Tâche à supprimer', assignedGroup: 'management', dueDate: day(2), category: 'Front Desk', priority: 'Medium' } });
  await page.addInitScript(() => { if (/^https?:$/.test(location.protocol)) localStorage.setItem('gem-lang', 'fr'); });
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page, owner);
  await page.goto('/tasks');
  await expect(page.getByTitle('Ajouter une tâche')).toBeVisible();
  await page.getByText('Tâche à supprimer').first().click();
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Fermer' }).first()).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Supprimer' }).click();
  const confirm = page.getByRole('dialog', { name: 'Supprimer la tâche' });
  await expect(confirm.getByRole('button', { name: 'Annuler' })).toBeVisible();
  await expect(confirm.getByRole('button', { name: 'Cancel' })).toHaveCount(0);
});
