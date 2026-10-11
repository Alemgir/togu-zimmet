import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { BrandLoader } from '@/components/brand/Logo';
import { useAuth } from '@/lib/auth';

export function FullScreenLoader() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-bg">
      <BrandLoader />
    </div>
  );
}

export function RequireAuth() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <FullScreenLoader />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return <Outlet />;
}

export function RequireAdmin() {
  const { isAdmin } = useAuth();
  return isAdmin ? <Outlet /> : <Navigate to="/" replace />;
}

export function RequireManager() {
  const { isManager } = useAuth();
  return isManager ? <Outlet /> : <Navigate to="/" replace />;
}
