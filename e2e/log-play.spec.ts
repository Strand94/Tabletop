import { test, expect, request } from '@playwright/test';

/**
 * Core flow: log a play through the 3-step modal and land on the session detail.
 * A game and a person are seeded via the API so the wizard has data to work with.
 */
const ADMIN = { username: 'maya', password: 'supersecret' };

test('log a play via the 3-step modal', async ({ page, baseURL }) => {
  const api = await request.newContext({ baseURL });
  await api.post('/api/auth/register', { data: ADMIN });
  const token = (await (await api.post('/api/auth/login', { data: ADMIN })).json())
    .accessToken as string;
  const headers = { Authorization: `Bearer ${token}` };
  const gameTitle = `Starfall Tactics ${Date.now()}`;
  await api.post('/api/games', { headers, data: { title: gameTitle } });
  await api.post('/api/people', { headers, data: { name: 'MayaPlayer' } });
  await api.dispose();

  // Log in.
  await page.goto('/login');
  await page.getByLabel('Brukernavn').fill(ADMIN.username);
  await page.getByLabel('Passord').fill(ADMIN.password);
  await page.getByRole('button', { name: 'Logg inn' }).click();
  await expect(page.getByText('Spill eid')).toBeVisible();

  // Open the log-a-play modal from the top bar.
  await page.getByRole('button', { name: 'Logg et spill' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  // Step 1: pick the game.
  await dialog.getByText(gameTitle).click();
  await dialog.getByRole('button', { name: 'Neste' }).click();

  // Step 2: include the player.
  await dialog.getByRole('button', { name: 'MayaPlayer' }).click();
  await dialog.getByRole('button', { name: 'Neste' }).click();

  // Step 3: save.
  await dialog.getByRole('button', { name: 'Lagre parti' }).click();

  // Landed on the session detail page.
  await expect(page.getByRole('heading', { name: gameTitle })).toBeVisible();
  await expect(page.getByText('MayaPlayer')).toBeVisible();

  // And it appears in the sessions list.
  await page.getByRole('link', { name: 'Partier' }).click();
  await expect(page.getByText(gameTitle)).toBeVisible();
});
