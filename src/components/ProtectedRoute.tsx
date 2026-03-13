import { Navigate, Outlet } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import { Loader2 } from 'lucide-react';

export function ProtectedRoute({ allowedRoles }: { allowedRoles?: string[] }) {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && profile && !allowedRoles.includes(profile.role)) {
    // Redirect based on role if they try to access unauthorized area
    if (profile.role === 'admin') return <Navigate to="/admin" replace />;
    if (profile.role === 'barber') return <Navigate to="/barber" replace />;
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
