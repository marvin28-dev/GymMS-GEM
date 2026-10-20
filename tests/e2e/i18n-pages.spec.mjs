// F-133: text written straight into the pages in English. In French, a
// package's length and session limit, the code prompt's action, and who a task
// is for read as French.
import { test, expect } from '@playwright/test';
import { registerGym, signIn, call } from './support/session.mjs';

const day = (offset = 0) => new Date(Date.now() + offset * 864e5).toISOString().slice(0, 10);
const inFrench = (page) => page.addInitScript(() => { if (/^https?:$/.test(location.protocol)) localStorage.setItem('gem-lang', 'fr'); });

test('in French, Packages shows the length, the session limit and the code prompt in French', async ({ page }) => {
  const owner = await registerGym();
  await call('POST', '/packages', { token: owner.token, body: { name: 'Plan Or', price: 60000, dayPassPrice: 2000, duration: '6 Months', durationDays: 180, sessions: 'Unlimited', status: 'active' } });
  await inFrench(page);
  await signIn(page, owner);
  await page.goto('/packages');
  const row = page.getByRole('row').filter({ hasText: 'Plan Or' });
  await expect(row).toContainText('6 mois');
  await expect(row).toContainText('Illimité');
  await expect(row).not.toContainText('Months');

  await row.getByRole('button', { name: 'Actions' }).click();
  await page.getByRole('menuitem', { name: 'Modifier' }).click();
  const form = page.getByRole('dialog', { name: 'Modifier le forfait' });
  await expect(form.getByPlaceholder('ex. Premium 12M')).toBeVisible();
  await form.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await expect(page.getByText('modifier le forfait « Plan Or »')).toBeVisible();
});

test('in French, a task for the managers says Direction on Tasks and Operations', async ({ page }) => {
  const owner = await registerGym();
  await call('POST', '/tasks', { token: owner.token, body: { title: 'Vérifier la caisse', assignedGroup: 'management', dueDate: day(2), category: 'Front Desk', priority: 'Medium' } });
  await call('POST', '/equipment', { token: owner.token, body: { equipment: 'Tapis 3', description: 'Courroie usée', severity: 'medium' } });
  await inFrench(page);
  await signIn(page, owner);
  await page.goto('/tasks');
  const taskRow = page.getByRole('row').filter({ hasText: 'Vérifier la caisse' });
  await expect(taskRow).toContainText('Direction');
  await expect(taskRow).not.toContainText('Management');

  await page.goto('/operations');
  await expect(page.getByText(/Direction · /).first()).toBeVisible();
  await expect(page.getByText('1 non résolu(s)')).toBeVisible();
});

test('in French, the gym sign-in page welcomes back in French', async ({ page }) => {
  const owner = await registerGym();
  await inFrench(page);
  await page.goto(`/${owner.gymCode}/login`);
  await expect(page.getByText(`E2E Gym ${owner.gymCode}`).first()).toBeVisible();
  await expect(page.getByText('"Bon retour"')).toBeVisible();
  await expect(page.getByText('Welcome back')).toHaveCount(0);
});

test('in French, the new-password form explains a refusal in French', async ({ page }) => {
  // Only the link check is answered for the test; the form's own checks run as they are
  await page.route('**/api/auth/verify-reset-token/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ valid: true }) }));
  await inFrench(page);
  await page.goto('/reset-password?token=test-token');
  await page.getByPlaceholder('Au moins 6 caractères').fill('abc');
  await page.getByPlaceholder('Répétez votre mot de passe').fill('abd');
  await page.getByRole('button', { name: 'Définir le nouveau mot de passe' }).click();
  await expect(page.getByText('Utilisez au moins 6 caractères.')).toBeVisible();
  await expect(page.getByText('Les deux mots de passe ne correspondent pas.')).toBeVisible();
});

test('in French on a phone, Operations counts the pending tasks in French', async ({ page }) => {
  const owner = await registerGym();
  await call('POST', '/tasks', { token: owner.token, body: { title: 'Ranger les haltères', assignedGroup: 'management', dueDate: day(2), category: 'Front Desk', priority: 'Low' } });
  await inFrench(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page, owner);
  await page.goto('/operations');
  await expect(page.getByText(/Tâches en attente \(\d+\)/)).toBeVisible();
  await expect(page.getByText(/Pending Tasks/)).toHaveCount(0);
});
