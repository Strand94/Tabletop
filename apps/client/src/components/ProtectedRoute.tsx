import type { JSX } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../lib/auth.js';

/** Gate for authenticated routes: waits for session restore, else redirects. */
export function ProtectedRoute(): JSX.Element | null {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}
