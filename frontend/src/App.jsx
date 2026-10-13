import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './context/useAuth';
import ProtectedRoute from './components/ProtectedRoute';
import PublicOnlyRoute from './components/PublicOnlyRoute';
import LoadingScreen from './components/LoadingScreen';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import ProjectsDashboardPage from './pages/ProjectsDashboardPage';
import EditorWorkspacePage from './pages/EditorWorkspacePage';
import StandalonePreviewPage from './pages/StandalonePreviewPage';
import './App.css';

// Root index redirect: Authenticated -> /projects, Unauthenticated -> /login
function IndexRedirect() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <LoadingScreen message="Loading CodeCollab..." />;
  }

  return isAuthenticated ? (
    <Navigate to="/projects" replace />
  ) : (
    <Navigate to="/login" replace />
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Root Redirect */}
          <Route path="/" element={<IndexRedirect />} />

          {/* Public Auth Routes */}
          <Route
            path="/login"
            element={
              <PublicOnlyRoute>
                <LoginPage />
              </PublicOnlyRoute>
            }
          />
          <Route
            path="/signup"
            element={
              <PublicOnlyRoute>
                <SignupPage />
              </PublicOnlyRoute>
            }
          />

          {/* Authenticated Dashboard */}
          <Route
            path="/projects"
            element={
              <ProtectedRoute>
                <ProjectsDashboardPage />
              </ProtectedRoute>
            }
          />

          {/* Authenticated Editor Workspace */}
          <Route
            path="/projects/:roomId"
            element={
              <ProtectedRoute>
                <EditorWorkspacePage />
              </ProtectedRoute>
            }
          />

          {/* Standalone Live Preview in Separate Browser Tab */}
          <Route
            path="/preview/:roomId"
            element={
              <ProtectedRoute>
                <StandalonePreviewPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/projects/:roomId/preview"
            element={
              <ProtectedRoute>
                <StandalonePreviewPage />
              </ProtectedRoute>
            }
          />

          {/* Fallback Catch-All */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
