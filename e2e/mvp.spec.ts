import { test, expect, request } from '@playwright/test';

/**
 * MVP end-to-end: first-run admin bootstrap (via API), UI login, add a game
 * through the UI, and see it reflected in the collection and the dashboard.
 */
const ADMIN = { username: 'maya', password: 'supersecret' };

test.beforeAll(async ({ baseURL }) => {
  // First registration creates the initial ADMIN (no auth required).
  const api = await request.newContext({ baseURL });
  await api.post('/api/auth/register', { data: ADMIN });
  await api.dispose();
});

test('login, add a game, and see it in the collection and dashboard', async ({ page }) => {
  // Log in via the UI.
  await page.goto('/login');
  await page.getByLabel('Brukernavn').fill(ADMIN.username);
  await page.getByLabel('Passord').fill(ADMIN.password);
  await page.getByRole('button', { name: 'Logg inn' }).click();

  // Lands on the dashboard.
  await expect(page.getByText('Spill eid')).toBeVisible();

  // Go to the collection and open the new-game form.
  await page.getByRole('link', { name: 'Samling' }).click();
  await page.getByRole('button', { name: 'Nytt spill' }).click();

  const title = `Crimson Frontier ${Date.now()}`;
  await page.getByLabel('Tittel').fill(title);
  await page.getByLabel('Min. spillere').fill('1');
  await page.getByLabel('Maks spillere').fill('4');
  await page.getByRole('button', { name: 'Lagre' }).click();

  // The new game appears in the collection grid.
  await expect(page.getByText(title)).toBeVisible();

  // Dashboard reflects the new game: "Spill eid" counter shows at least 1.
  await page.getByRole('link', { name: 'Dashbord' }).click();
  await expect(page.getByText('Spill eid')).toBeVisible();
  await expect(page.getByText('Nylig lagt til')).toBeVisible();
  await expect(page.getByText(title)).toBeVisible();
});
