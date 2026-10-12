import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import LoadingScreen from './LoadingScreen';

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingScreen message="Checking authenticated session..." />;
  }

  if (!isAuthenticated) {
    // Preserve full target path and search string for redirect after login
    const redirectPath = `${location.pathname}${location.search}`;
    return <Navigate to={`/login?redirect=${encodeURIComponent(redirectPath)}`} replace />;
  }

  return children;
}
