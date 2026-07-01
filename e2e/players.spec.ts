import { test, expect, request } from '@playwright/test';

/** Players flow: log in, open the Players page, add a player, see the card. */
const ADMIN = { username: 'maya', password: 'supersecret' };

test('add a player from the players page', async ({ page, baseURL }) => {
  const api = await request.newContext({ baseURL });
  await api.post('/api/auth/register', { data: ADMIN });
  await api.dispose();

  await page.goto('/login');
  await page.getByLabel('Brukernavn').fill(ADMIN.username);
  await page.getByLabel('Passord').fill(ADMIN.password);
  await page.getByRole('button', { name: 'Logg inn' }).click();
  await expect(page.getByText('Spill eid')).toBeVisible();

  await page.getByRole('link', { name: 'Spillere' }).click();

  const name = `Jonas ${Date.now()}`;
  await page.getByRole('button', { name: 'Legg til spiller' }).click();
  await page.getByLabel('Navn').fill(name);
  await page.getByRole('button', { name: 'Lagre' }).click();

  // Scope the guest-label assertion to the new player's card (the shared e2e DB
  // may contain other guest players from other specs).
  const card = page.locator('[data-testid=person-card]', { hasText: name });
  await expect(card).toBeVisible();
  await expect(card.getByText('Gjest')).toBeVisible();
});
