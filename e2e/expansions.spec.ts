import { test, expect, request } from '@playwright/test';

/**
 * Expansions flow: create a base game via API, then through the UI open it and
 * add an expansion, verifying it appears in the game's expansions section.
 */
const ADMIN = { username: 'maya', password: 'supersecret' };

test('add an expansion to a game from the detail page', async ({ page, baseURL }) => {
  // Ensure the admin exists and create a base game via the API.
  const api = await request.newContext({ baseURL });
  await api.post('/api/auth/register', { data: ADMIN });
  const login = await api.post('/api/auth/login', { data: ADMIN });
  const token = (await login.json()).accessToken as string;
  const gameTitle = `Obsidian Court ${Date.now()}`;
  const gameRes = await api.post('/api/games', {
    headers: { Authorization: `Bearer ${token}` },
    data: { title: gameTitle },
  });
  const gameId = (await gameRes.json()).id as number;
  await api.dispose();

  // Log in via the UI.
  await page.goto('/login');
  await page.getByLabel('Brukernavn').fill(ADMIN.username);
  await page.getByLabel('Passord').fill(ADMIN.password);
  await page.getByRole('button', { name: 'Logg inn' }).click();
  await expect(page.getByText('Spill eid')).toBeVisible();

  // Open the game detail page directly.
  await page.goto(`/collection/${gameId}`);
  await expect(page.getByRole('heading', { name: gameTitle })).toBeVisible();

  // Add an expansion.
  const expTitle = `Frostmark ${Date.now()}`;
  await page.getByRole('button', { name: 'Legg til' }).click();
  await page.getByLabel('Tittel').fill(expTitle);
  await page.getByRole('button', { name: 'Lagre' }).click();

  // The expansion appears in the list.
  await expect(page.getByText(expTitle)).toBeVisible();
  await expect(page.getByText(/brukt i 0/)).toBeVisible();
});
