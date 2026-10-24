// Journeys J-01 to J-08 and J-28: the public pages and everything about
// getting into an account and out of it, driven the way a person does.
import { test, expect } from '@playwright/test';
import { registerGym, addStaff, signIn, call, mailTo, uniqueCode, seedDemoGym } from './support/session.mjs';

// The sign-up form picks the gym's country from the time zone
test.use({ timezoneId: 'Africa/Douala' });
// A journey opens several pages from scratch, each a full load from the dev
// server, which can take 10 seconds or more in Firefox when every test runs at once
test.describe.configure({ timeout: 120_000 });

// The landing and sign-up pages embed a YouTube video (F-141), and the page
// only finishes loading once YouTube has; the tests do not wait on YouTube
test.beforeEach(async ({ page }) => {
  await page.route(/^https:\/\/([a-z0-9-]+\.)*(youtube\.com|ytimg\.com|googlevideo\.com)\//, route => route.abort());
});

test('J-01: the landing page leads to sign-up and to sign-in', async ({ page }) => {
  await page.goto('/');
  // The offer is made at the top of the page and again at the bottom
  await expect(page.getByRole('button', { name: 'Request Free Access' })).toHaveCount(2);
  await page.getByRole('button', { name: 'Request Free Access' }).first().click();
  await expect(page).toHaveURL(/\/signup$/);
  await page.goBack();
  await page.getByRole('button', { name: 'Sign In to Your Gym' }).first().click();
  await expect(page).toHaveURL(/\/login$/);
});

test('J-01: someone signed in who opens the landing page goes to their home', async ({ page }) => {
  const owner = await registerGym();
  await signIn(page, owner);
  await page.goto('/');
  await expect(page).toHaveURL(/\/dashboard$/);
});

async function fillGymStep(page, { name, phone = '670 111 222' }) {
  await page.getByPlaceholder('e.g. Elite Fitness Club').fill(name);
  await page.locator('select').nth(1).selectOption('Douala');
  await page.locator('input[inputmode="tel"]').fill(phone);
}

test('J-02: a new gym signs up, sees its gym code and 4-digit code, and opens its dashboard', async ({ page }) => {
  const code = uniqueCode('j');
  const name = `J ${code}`;
  const email = `ada.${code}@example.test`;
  await page.goto('/signup');
  await page.getByRole('button', { name: 'Start free trial' }).click();
  await fillGymStep(page, { name });
  // The gym code is made from the name and checked as it is typed
  await expect(page.getByPlaceholder('your-gym-code')).toHaveValue(`j-${code}`);
  await expect(page.getByText('✓ Available')).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();

  await page.getByPlaceholder('First name').fill('Ada');
  await page.getByPlaceholder('Last name').fill('Founder');
  await page.getByPlaceholder('you@yourgym.com').fill(email);
  await page.locator('input[inputmode="tel"]').fill('670 333 444');
  await page.getByPlaceholder('At least 6 characters').fill('Founder-pass-1');
  await page.getByPlaceholder('Repeat your password').fill('Founder-pass-2');
  await page.getByRole('button', { name: 'Launch GEM' }).click();
  await expect(page.getByText('Passwords do not match')).toBeVisible();
  await page.getByPlaceholder('Repeat your password').fill('Founder-pass-1');
  await page.getByRole('button', { name: 'Launch GEM' }).click();

  await expect(page.getByRole('heading', { name: 'Welcome to GEM, Ada!' })).toBeVisible();
  await expect(page.getByText(`j-${code}`, { exact: true })).toBeVisible();
  await expect(page.getByText(/^\d{4}$/)).toBeVisible();
  // The owner is emailed the gym code
  await expect.poll(async () => (await mailTo(email)).length).toBeGreaterThan(0);

  await page.getByRole('button', { name: 'Go to Dashboard' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText(name).first()).toBeVisible();
});

test('J-02: a gym code that is taken is refused before the next step', async ({ page }) => {
  const other = await registerGym();
  await page.goto('/signup');
  await page.getByRole('button', { name: 'Start free trial' }).click();
  await fillGymStep(page, { name: 'Someone Else' });
  await page.getByPlaceholder('your-gym-code').fill(other.gymCode);
  await expect(page.getByText('✗ Already taken')).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('This code is already taken. Try a different one.')).toBeVisible();
  await expect(page.getByPlaceholder('First name')).toHaveCount(0);
});

test('J-04: finding your gym by its code', async ({ page }) => {
  const owner = await registerGym();
  await page.goto('/login');
  const box = page.getByPlaceholder('e.g. elite-fitness');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('Please enter your gym code to continue.')).toBeVisible();
  await box.fill(`nobody-${uniqueCode('x')}`);
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('Gym not found. Check your code and try again.')).toBeVisible();
  await box.fill(owner.gymCode.toUpperCase());
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(new RegExp(`/${owner.gymCode}/login$`));
  await expect(page.getByText(`E2E Gym ${owner.gymCode}`).first()).toBeVisible();
});

// The demo sign-in page signs in to the gym "elite" with the accounts written
// into the page. The test database gets that gym and those accounts the first
// time this runs; both browsers may get here at once, so every step tolerates
// the other having done it first.
const DEMO = { gymCode: 'elite', password: 'admin123' };
const DEMO_STAFF = [
  { email: 'sandrine@elite.cm', firstName: 'Sandrine', lastName: 'Kom', role: 'front_desk' },
  { email: 'michel@elite.cm', firstName: 'Michel', lastName: 'Roko', role: 'trainer' },
];
const signInDemo = (email) => call('POST', '/auth/login', { body: { gymCode: DEMO.gymCode, email, password: DEMO.password } });
async function ensureDemoGym() {
  let owner;
  try { owner = await signInDemo('marvin@elite.cm'); } catch (e) { if (!/answered 404/.test(e.message)) throw e; }
  if (!owner) {
    seedDemoGym();
    owner = await signInDemo('marvin@elite.cm');
  }
  for (const s of DEMO_STAFF) {
    for (let i = 0; i < 10; i += 1) {
      try { await signInDemo(s.email); break; } catch { /* not there yet */ }
      try {
        const made = await call('POST', '/staff', { token: owner.token, body: { ...s, phone: '677000000', city: 'Douala', region: 'Littoral' } });
        const { accessCode } = await call('GET', `/staff/${made.id}/code`, { token: owner.token });
        await call('POST', '/auth/set-password', { body: { gymCode: DEMO.gymCode, email: s.email, password: DEMO.password, code: accessCode } });
      } catch { await new Promise(r => setTimeout(r, 500)); }
    }
  }
}

test('J-03: the demo page signs in as the role picked', async ({ page }) => {
  await ensureDemoGym();
  await page.goto('/elite/login');
  await page.getByRole('button', { name: /Sandrine Kom/ }).click();
  await expect(page.getByText('sandrine@elite.cm')).toBeVisible();
  await page.getByRole('button', { name: 'Enter Demo' }).click();
  await expect(page).toHaveURL(/\/front-desk$/);
  expect(await page.evaluate(() => localStorage.getItem('gem_demo_mode'))).toBe('1');
});

async function startSignIn(page, gymCode, email) {
  await page.goto(`/${gymCode}/login`);
  await page.getByPlaceholder('Enter your email').fill(email);
  await page.getByRole('button', { name: 'Continue' }).click();
}

test('J-05: an account with a password signs in, whatever the capitals, and a wrong password is refused', async ({ page }) => {
  const owner = await registerGym();
  await startSignIn(page, owner.gymCode, `  ${owner.email.toUpperCase()} `);
  const password = page.getByPlaceholder('Enter your password');
  await password.fill('not-the-password');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page.locator('form').getByText(/⚠/)).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/${owner.gymCode}/login$`));
  await password.fill(owner.password);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
});

test('J-05: a new employee chooses a password with the 4-digit code from their manager', async ({ page }) => {
  const owner = await registerGym();
  const email = `first.${uniqueCode('n')}@example.test`;
  const made = await call('POST', '/staff', { token: owner.token, body: { firstName: 'Fiona', lastName: 'First', email, phone: '677000000', role: 'front_desk', city: 'Douala', region: 'Littoral' } });
  const { accessCode } = await call('GET', `/staff/${made.id}/code`, { token: owner.token });

  await startSignIn(page, owner.gymCode, email);
  await expect(page.getByText('First time signing in - choose a password')).toBeVisible();
  const wrong = accessCode === '0000' ? '1111' : '0000';
  await page.getByPlaceholder('••••').fill(wrong);
  await page.getByPlaceholder('Enter your password').fill('Fiona-pass-1');
  await page.getByPlaceholder('Re-enter password').fill('Fiona-pass-1');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page.locator('form').getByText(/⚠/)).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/${owner.gymCode}/login$`));

  await page.getByPlaceholder('••••').fill(accessCode);
  await page.getByRole('button', { name: 'Sign In' }).click();
  // A front desk account's home is the desk
  await expect(page).toHaveURL(/\/front-desk$/);
});

test('J-05: an address no account uses, and a deactivated account, are told the same thing', async ({ page }) => {
  const owner = await registerGym();
  const gone = await addStaff(owner, { role: 'trainer' });
  await call('PATCH', `/staff/${gone.id}`, { token: owner.token, body: { isActive: false } });

  await startSignIn(page, owner.gymCode, `nobody.${uniqueCode('u')}@example.test`);
  await expect(page.getByText('No account at this gym uses that email address.')).toBeVisible();
  await expect(page.getByPlaceholder('Enter your password')).toHaveCount(0);

  await startSignIn(page, owner.gymCode, gone.email);
  await expect(page.getByText('No account at this gym uses that email address.')).toBeVisible();
  await expect(page.getByPlaceholder('Enter your password')).toHaveCount(0);
});

const resetLinkIn = (mail) => /href="([^"]*\/reset-password\?token=[^"]+)"/.exec(mail.html || '')?.[1];

test('J-06: a forgotten password is reset through the emailed link, once', async ({ page }) => {
  const owner = await registerGym();
  await startSignIn(page, owner.gymCode, owner.email);
  await page.getByText('Forgot password?').click();
  await expect(page).toHaveURL(/\/forgot-password$/);
  // The gym code comes along from the sign-in page
  await expect(page.getByPlaceholder('your-gym-code')).toHaveValue(owner.gymCode);
  await page.getByPlaceholder('you@yourgym.com').fill(owner.email);
  await page.getByRole('button', { name: 'Send reset link' }).click();
  await expect(page.getByText('Check your inbox')).toBeVisible();

  let link;
  await expect.poll(async () => {
    link = (await mailTo(owner.email)).map(resetLinkIn).find(Boolean);
    return !!link;
  }).toBe(true);

  await page.goto(link);
  await expect(page.getByText('Set a new password')).toBeVisible();
  await page.getByPlaceholder('At least 6 characters').fill('Brand-new-1');
  await page.getByPlaceholder('Re-enter your password').fill('Brand-new-1');
  await page.getByRole('button', { name: 'Set new password' }).click();
  await expect(page.getByText('Password updated')).toBeVisible();

  // The link has done its job
  await page.goto(link);
  await expect(page.getByText(/^(Invalid link|Link expired|Link no longer valid)$/)).toBeVisible();

  // The new password works and the old one does not
  await expect(call('POST', '/auth/login', { body: { gymCode: owner.gymCode, email: owner.email, password: owner.password } })).rejects.toThrow(/401/);
  await startSignIn(page, owner.gymCode, owner.email);
  await page.getByPlaceholder('Enter your password').fill('Brand-new-1');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
});

test('J-06: a manager sends an employee a reset link from their profile', async ({ page }) => {
  const owner = await registerGym();
  const staff = await addStaff(owner, { role: 'trainer', firstName: 'Rita', lastName: 'Reset' });
  await signIn(page, owner);
  await page.goto(`/staff/${staff.id}`);
  await page.getByRole('button', { name: 'Send password reset link' }).click();
  await expect(page.getByText('Login link sent')).toBeVisible();
  await expect.poll(async () => (await mailTo(staff.email)).some(m => resetLinkIn(m))).toBe(true);
});

test('J-08: after 15 quiet minutes the app asks, and staying keeps you signed in', async ({ page }) => {
  const owner = await registerGym();
  await page.clock.install();
  await signIn(page, owner);
  await page.goto('/dashboard');
  await expect(page.getByText(`E2E Gym ${owner.gymCode}`).first()).toBeVisible();
  await page.clock.fastForward('15:30');
  await expect(page.getByText('Are you still there?')).toBeVisible();
  await page.getByRole('button', { name: 'Yes, I’m still here' }).click();
  await expect(page.getByText('Are you still there?')).toHaveCount(0);
  await expect(page).toHaveURL(/\/dashboard$/);
});

test('J-08: with no answer the countdown signs you out', async ({ page }) => {
  const owner = await registerGym();
  await page.clock.install();
  await signIn(page, owner);
  await page.goto('/dashboard');
  await expect(page.getByText(`E2E Gym ${owner.gymCode}`).first()).toBeVisible();
  await page.clock.fastForward('15:30');
  await expect(page.getByText('Are you still there?')).toBeVisible();
  // One second at a time, so the page can draw each step of the countdown. A
  // step can land before the last one was drawn (seen in WebKit), so there is
  // room for more than the 30; it stops at the sign-in page.
  for (let i = 0; i < 90 &&!/\/login$/.test(page.url()); i += 1) await page.clock.runFor(1000);
  // The gym's own sign-in page, as when the server signs someone out, so the
  // next person at a shared desk does not type the gym code again (F-173 a)
  await expect(page).toHaveURL(new RegExp(`/${owner.gymCode}/login$`));
  expect(await page.evaluate(() => localStorage.getItem('gem_auth'))).toBeNull();
});

test('J-08: a session whose token has run out opens the sign-in page, not the dashboard', async ({ page }) => {
  const owner = await registerGym();
  const [head, , sig] = owner.token.split('.');
  const payload = Buffer.from(JSON.stringify({ id: owner.user.id, exp: Math.floor(Date.now() / 1000) - 60 })).toString('base64url');
  await signIn(page, { ...owner, token: `${head}.${payload}.${sig}` });
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login$/);
});

test('J-28: an account deactivated while signed in is signed out on its next request', async ({ page }) => {
  const owner = await registerGym();
  const manager = await addStaff(owner, { role: 'manager' });
  await signIn(page, manager);
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/dashboard$/);
  await call('PATCH', `/staff/${manager.id}`, { token: owner.token, body: { isActive: false } });
  // An open screen asks whether its account is still active when it gets
  // focus (sent again until the page that listens for it is up)
  await expect(async () => {
    // Throws once the sign-out has started navigating, which is the point
    await page.evaluate(() => window.dispatchEvent(new Event('focus'))).catch(() => null);
    await expect(page).toHaveURL(new RegExp(`/${owner.gymCode}/login$`), { timeout: 2000 });
  }).toPass({ timeout: 30_000 });
  expect(await page.evaluate(() => localStorage.getItem('gem_auth'))).toBeNull();
});

test('J-28: after signing out, going back does not reopen the app', async ({ page }) => {
  const owner = await registerGym();
  await signIn(page, owner);
  await page.goto('/members');
  await page.getByText('OO', { exact: true }).last().click();
  await page.getByText('Sign Out', { exact: true }).click();
  // Back is pressed once the sign-in page is on screen, as a person would
  await expect(page.getByPlaceholder('e.g. elite-fitness')).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/login$/);
});
