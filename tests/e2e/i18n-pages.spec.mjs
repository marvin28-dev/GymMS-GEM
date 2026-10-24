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
  await call('POST', '/calendar', { token: owner.token, body: { title: 'Yoga du soir', date: localDay(), time: '23:58', duration: '23:59', location: 'Salle 2', spots: 12, tz: new Date().getTimezoneOffset() } });
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

test('in French, a staff profile\'s pay screens and dialogs are French', async ({ page }) => staffPayInFrench(page, false));
test('in French on a phone, a staff profile\'s pay screens and dialogs are French', async ({ page }) => staffPayInFrench(page, true));

async function staffPayInFrench(page, phone) {
  if (phone) await page.setViewportSize({ width: 390, height: 844 });
  const owner = await registerGym();
  const staff = await addStaff(owner, { firstName: 'Paul', lastName: 'Paie', salary: 150000 });
  await call('POST', '/pay-adjustments', { token: owner.token, body: { staffId: staff.id, kind: 'bonus', label: 'Indemnité', amount: 10000, recurring: true } });
  await inFrench(page);
  await signIn(page, owner);
  await page.goto(`/staff/${staff.id}`);
  await page.getByRole('button', { name: 'Salaire & Revenus' }).first().click();
  await expect(page.getByText('Indemnité').locator('xpath=..')).toContainText('Chaque mois');
  await expect(page.getByText('Aucune déduction', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Ajouter', exact: true }).first().click();
  const adj = page.getByRole('dialog', { name: 'Ajouter une prime' });
  await expect(adj.getByText('Fréquence')).toBeVisible();
  await expect(adj.getByText('Cette paie', { exact: true })).toBeVisible();
  await expect(adj.getByPlaceholder('ex. Indemnité de transport')).toBeVisible();
  await adj.getByRole('button', { name: 'Annuler' }).click();

  await page.getByRole('button', { name: 'Émettre la paie' }).first().click();
  const pay = page.getByRole('dialog', { name: 'Émettre la paie' });
  const month = new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  await expect(pay.locator('option', { hasText: month })).toBeAttached();
  await expect(pay.getByRole('button', { name: 'Confirmer et enregistrer' })).toBeVisible();
  await expect(page.getByText(/Issue Pay|Every month|How often/)).toHaveCount(0);
}

test('in French, the member profile\'s days left, renewal text and notes are French', async ({ page }) => {
  const owner = await registerGym();
  const pkg = await call('POST', '/packages', { token: owner.token, body: { name: 'Plan Libre', price: 20000, dayPassPrice: 1000, duration: '1 Months', durationDays: 30, sessions: 'Unlimited', status: 'active' } });
  const member = await call('POST', '/members', { token: owner.token, body: { firstName: 'Lea', lastName: 'Libre', city: 'Douala', region: 'Littoral', regFeeMethod: 'cash', packageId: pkg.id, startDate: localDay(new Date(Date.now() - 27 * 864e5)), endDate: localDay(new Date(Date.now() + 3 * 864e5)) } });
  await call('POST', '/payments', { token: owner.token, body: { memberId: member.id, amount: 20000, method: 'cash', type: 'membership' } });
  // A yearly registration fee paid about eleven months ago is due within 30 days
  await call('PATCH', '/gyms/me', { token: owner.token, body: { registrationFeeRequired: true, registrationFeeFrequency: 'yearly' } });
  await call('PATCH', `/members/${member.id}`, { token: owner.token, body: { regFeeDate: localDay(new Date(Date.now() - 350 * 864e5)) } });
  await inFrench(page);
  await signIn(page, owner);
  await page.goto(`/members/${member.id}`);
  await expect(page.getByText(/^\d+ j restants$/).first()).toBeVisible();
  await expect(page.getByText(/\d+d left/)).toHaveCount(0);

  await expect(page.getByRole('button', { name: 'Afficher le code' })).toBeVisible();
  await page.getByRole('button', { name: 'Adhésion' }).click();
  await page.getByRole('button', { name: 'Renouveler', exact: true }).last().click();
  const renew = page.getByRole('dialog', { name: 'Renouveler l’adhésion' }).or(page.getByRole('dialog', { name: "Renouveler l'adhésion" }));
  await expect(renew).toContainText('Ce forfait offre des séances illimitées');
  await renew.getByRole('button', { name: 'Annuler' }).first().click();

  await page.getByRole('button', { name: 'Ajouter une note' }).first().click();
  const note = page.getByRole('dialog', { name: 'Ajouter une note' });
  await note.locator('textarea').fill('Préfère le matin');
  await note.getByRole('button', { name: 'Enregistrer la note' }).click();
  await page.getByRole('button', { name: 'Notes', exact: true }).click();
  const saved = page.getByText('Préfère le matin').locator('xpath=ancestor::div[2]');
  await expect(saved).toContainText('Général');
  await expect(saved).toContainText('par Olive Owner');
});

test('in French, the Payments form gives its examples in French', async ({ page }) => {
  const owner = await registerGym();
  const pkg = await call('POST', '/packages', { token: owner.token, body: { name: 'Plan Exemple', price: 15000, dayPassPrice: 1500, duration: '1 Months', durationDays: 30, status: 'active' } });
  await call('POST', '/members', { token: owner.token, body: { firstName: 'Ines', lastName: 'Exemple', city: 'Douala', region: 'Littoral', regFeeMethod: 'cash', startDate: localDay(), endDate: localDay(new Date(Date.now() + 30 * 864e5)), packageId: pkg.id, balance: 15000 } });
  await inFrench(page);
  await signIn(page, owner);
  await page.goto('/payments');
  await page.getByRole('button', { name: 'Ajouter un paiement' }).first().click();
  const form = page.getByRole('dialog');
  await expect(async () => {
    await form.getByPlaceholder('Nom ou code membre...').fill('');
    await form.getByPlaceholder('Nom ou code membre...').fill('Exemple');
    await expect(form.getByText('Ines Exemple').first()).toBeVisible({ timeout: 1000 });
  }).toPass();
  await form.getByText('Ines Exemple').first().click();
  await expect(form.getByPlaceholder('ex. Renouvellement Premium 12M')).toBeVisible();
  await expect(form.getByPlaceholder(/^e\.g\./)).toHaveCount(0);
});
