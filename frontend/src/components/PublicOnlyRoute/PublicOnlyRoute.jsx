import './PublicOnlyRoute.css';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/useAuth';
import LoadingScreen from '../LoadingScreen/LoadingScreen';

export default function PublicOnlyRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <LoadingScreen message="Checking session..." />;
  }

  if (isAuthenticated) {
    return <Navigate to="/projects" replace />;
  }

  return children;
}
