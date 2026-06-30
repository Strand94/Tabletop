import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './lib/auth.js';
import { ThemeProvider } from './lib/theme.js';
import { AppShell } from './components/AppShell.js';
import { ProtectedRoute } from './components/ProtectedRoute.js';
import { Login } from './pages/Login.js';
import { Placeholder } from './pages/Placeholder.js';
import { t } from './lib/strings.js';

const queryClient = new QueryClient();

/** Root component: providers + route table. */
export function App(): JSX.Element {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route element={<ProtectedRoute />}>
                <Route element={<AppShell />}>
                  <Route index element={<Placeholder title={t.nav.dashboard} />} />
                  <Route path="collection" element={<Placeholder title={t.nav.collection} />} />
                  <Route path="sessions" element={<Placeholder title={t.nav.sessions} />} />
                  <Route path="players" element={<Placeholder title={t.nav.players} />} />
                  <Route path="settings" element={<Placeholder title={t.nav.settings} />} />
                </Route>
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
