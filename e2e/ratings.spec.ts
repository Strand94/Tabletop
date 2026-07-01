import { test, expect, request } from '@playwright/test';

/** Rating flow: rate a game on its detail page and see the value reflected. */
const ADMIN = { username: 'maya', password: 'supersecret' };

test('rate a game on the detail page', async ({ page, baseURL }) => {
  const api = await request.newContext({ baseURL });
  await api.post('/api/auth/register', { data: ADMIN });
  const token = (await (await api.post('/api/auth/login', { data: ADMIN })).json())
    .accessToken as string;
  const gameTitle = `Obsidian Court ${Date.now()}`;
  const gameRes = await api.post('/api/games', {
    headers: { Authorization: `Bearer ${token}` },
    data: { title: gameTitle },
  });
  const gameId = (await gameRes.json()).id as number;
  await api.dispose();

  await page.goto('/login');
  await page.getByLabel('Brukernavn').fill(ADMIN.username);
  await page.getByLabel('Passord').fill(ADMIN.password);
  await page.getByRole('button', { name: 'Logg inn' }).click();
  await expect(page.getByText('Spill eid')).toBeVisible();

  await page.goto(`/collection/${gameId}`);
  const yourRating = page.getByTestId('your-game-rating');
  await expect(yourRating).toContainText('Ikke vurdert ennå');

  await yourRating.getByRole('button', { name: 'Vurder' }).click();
  await yourRating.getByRole('slider').fill('9');
  await yourRating.getByRole('button', { name: 'Lagre' }).click();

  await expect(yourRating).toContainText('9.0');
});
