import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';

export default function RequireAuth() {
  const { isLoading, isAuthenticated } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <p>Checking auth…</p>;
  }

  if (!isAuthenticated) {
    // už víme, že authLoading skončil a token není - kopnem ho na /login
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // uživatel je přihlášený - pustíme ho dál
  return <Outlet />;
}
