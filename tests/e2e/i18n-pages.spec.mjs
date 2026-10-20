// F-133: text written straight into the pages in English. In French, a
// package's length and session limit, the code prompt's action, and who a task
// is for read as French.
import { test, expect } from '@playwright/test';
import { registerGym, signIn, call, addStaff, stubPrinting } from './support/session.mjs';

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

const localDay = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

test('in French, Settings names the themes and the opening days in French', async ({ page }) => {
  const owner = await registerGym();
  await inFrench(page);
  await signIn(page, owner);
  await page.goto('/settings?section=appearance');
  await expect(page.getByText('Obsidienne').first()).toBeVisible();
  await expect(page.getByText('Ivoire').first()).toBeVisible();
  await page.goto('/settings?section=gym-profile');
  await expect(page.getByText('Lun.', { exact: true })).toBeVisible();
  await expect(page.getByText('Mon', { exact: true })).toHaveCount(0);
});

// F-155: a logo the server did not keep is not shown as the gym's logo
test('a logo that could not be saved is not left on screen, and says so in French', async ({ page }) => {
  const owner = await registerGym();
  await inFrench(page);
  await signIn(page, owner);
  await page.goto('/settings?section=gym-profile');
  await page.route('**/api/gyms/me', route => (route.request().method() === 'PATCH' && (route.request().postData() || '').includes('"logo"')
    ? route.fulfill({ status: 500, contentType: 'application/json', body: '{}' })
    : route.fallback()));
  await page.locator('input[type="file"][accept^="image/png"]').setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: PNG });
  await expect(page.getByText('Impossible d\'enregistrer ce logo. L\'ancien est conservé.')).toBeVisible();
  await expect(page.getByAltText('Logo de la salle')).toHaveCount(0);
  expect((await call('GET', '/gyms/me', { token: owner.token })).logo).toBeFalsy();
});

test('in French, the Dashboard counts a class\'s places in French', async ({ page }) => {
  const owner = await registerGym();
  await call('POST', '/calendar', { token: owner.token, body: { title: 'Yoga du soir', date: localDay(), time: '23:00', duration: '23:45', location: 'Salle 2', spots: 12 } });
  await inFrench(page);
  await signIn(page, owner);
  await page.goto('/dashboard');
  await expect(page.getByText(/Salle 2 · 12 places/)).toBeVisible();
});

test('in French, Accounting names periods, categories, pay months and the pay form in French', async ({ page }) => {
  const owner = await registerGym();
  await call('POST', '/expenses', { token: owner.token, body: { title: 'Facture eau', category: 'Utilities', amount: 12000, date: localDay(), paidTo: 'CDE', method: 'cash' } });
  await inFrench(page);
  await signIn(page, owner);
  await page.goto('/accounting');
  await expect(page.getByRole('row').filter({ hasText: 'Facture eau' })).toContainText('Charges courantes');
  await expect(page.locator('select').filter({ has: page.locator('option', { hasText: '3 derniers mois' }) })).toHaveValue('This Month');
  await expect(page.getByText('Aperçu financier : Ce mois')).toBeVisible();

  await page.getByRole('button', { name: 'Ajouter une dépense' }).first().click();
  const form = page.getByRole('dialog');
  await form.locator('select').first().selectOption('Salaries');
  await expect(page.getByRole('dialog', { name: 'Émettre une paie' })).toBeVisible();
  await expect(form.getByText('Employé *')).toBeVisible();
  const month = new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  await expect(form.locator('option', { hasText: month }).first()).toBeAttached();
  await form.getByRole('button', { name: 'Annuler' }).click();

  await page.getByRole('button', { name: 'Bulletins de paie' }).first().click();
  await expect(page.getByText(`Bulletins de paie : ${month}`)).toBeVisible();
});

test('in French, the members export names its title, status and gender in French', async ({ page }) => {
  const owner = await registerGym();
  await call('POST', '/members', { token: owner.token, body: { firstName: 'Awa', lastName: 'Export', gender: 'Female', city: 'Douala', region: 'Littoral', regFeeMethod: 'cash', startDate: localDay(), endDate: localDay(new Date(Date.now() + 30 * 864e5)) } });
  await inFrench(page);
  await signIn(page, owner);
  await stubPrinting(page);
  await page.goto('/members');
  await expect(page.getByText('Awa Export').first()).toBeVisible();
  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    page.getByRole('button', { name: 'Exporter' }).first().click(),
  ]);
  await popup.waitForLoadState();
  const text = await popup.locator('body').innerText();
  expect(text).toContain('Rapport des membres GEM');
  expect(text).toContain('Femme');
  expect(text).not.toMatch(/\bactive\b|\bFemale\b/);
});

test('in French, the desk lists a reported issue in French', async ({ page }) => {
  const owner = await registerGym();
  const desk = await addStaff(owner, { role: 'front_desk' });
  await call('POST', '/equipment', { token: owner.token, body: { equipment: 'Tapis 3', description: 'Courroie usée', severity: 'medium' } });
  await inFrench(page);
  await signIn(page, desk);
  await page.goto('/front-desk');
  await page.getByRole('button', { name: 'Opérations', exact: true }).click();
  await expect(page.getByText('Problème signalé : Tapis 3')).toBeVisible();
});

test('in French, the desk sign-in card carries its badge in French', async ({ page }) => {
  const owner = await registerGym();
  // A desk session whose employee was deactivated falls back to the sign-in card
  const desk = await addStaff(owner, { role: 'front_desk', firstName: 'Dana', lastName: 'Desk' });
  await call('PATCH', `/staff/${desk.id}`, { token: owner.token, body: { isActive: false } });
  await page.addInitScript((staffId) => {
    if (/^https?:$/.test(location.protocol) && !sessionStorage.getItem('fd_session')) sessionStorage.setItem('fd_session', JSON.stringify({ staffId, staffName: 'Dana Desk' }));
  }, desk.id);
  await inFrench(page);
  await signIn(page, owner);
  await page.goto('/front-desk');
  const card = page.getByText('Connexion Accueil').locator('xpath=ancestor::div[2]');
  await expect(card.getByText('Accueil', { exact: true })).toBeVisible();
  await expect(page.getByText('FRONT DESK', { exact: true })).toHaveCount(0);
});

test('the desk program panel names its views in full', async ({ page }) => {
  const owner = await registerGym();
  await inFrench(page);
  await signIn(page, owner);
  await page.goto('/front-desk');
  for (const name of ['Jour', 'Sem.', 'Mois']) await expect(page.getByRole('button', { name, exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Moi', exact: true })).toHaveCount(0);
});
