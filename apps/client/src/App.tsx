import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './lib/auth.js';
import { ThemeProvider } from './lib/theme.js';
import { LogPlayProvider } from './lib/log-play.js';
import { AppShell } from './components/AppShell.js';
import { ProtectedRoute } from './components/ProtectedRoute.js';
import { Login } from './pages/Login.js';
import { Dashboard } from './pages/Dashboard.js';
import { Collection } from './pages/Collection.js';
import { GameDetail } from './pages/GameDetail.js';
import { Players } from './pages/Players.js';
import { Sessions } from './pages/Sessions.js';
import { SessionDetail } from './pages/SessionDetail.js';
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
            <LogPlayProvider>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route element={<ProtectedRoute />}>
                  <Route element={<AppShell />}>
                    <Route index element={<Dashboard />} />
                    <Route path="collection" element={<Collection />} />
                    <Route path="collection/:id" element={<GameDetail />} />
                    <Route path="sessions" element={<Sessions />} />
                    <Route path="sessions/:id" element={<SessionDetail />} />
                    <Route path="players" element={<Players />} />
                    <Route path="settings" element={<Placeholder title={t.nav.settings} />} />
                  </Route>
                </Route>
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </LogPlayProvider>
          </AuthProvider>
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
