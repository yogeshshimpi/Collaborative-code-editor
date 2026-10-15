import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { SettingsProvider } from './context/SettingsContext';
import { useAuth } from './context/useAuth';
import ProtectedRoute from './components/ProtectedRoute/ProtectedRoute';
import PublicOnlyRoute from './components/PublicOnlyRoute/PublicOnlyRoute';
import LoadingScreen from './components/LoadingScreen/LoadingScreen';
import LoginPage from './pages/LoginPage/LoginPage';
import SignupPage from './pages/SignupPage/SignupPage';
import ProjectsDashboardPage from './pages/ProjectsDashboardPage/ProjectsDashboardPage';
import EditorWorkspacePage from './pages/EditorWorkspacePage/EditorWorkspacePage';
import StandalonePreviewPage from './pages/StandalonePreviewPage/StandalonePreviewPage';
import SettingsPage from './pages/SettingsPage/SettingsPage';

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
      <SettingsProvider>
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

            {/* Authenticated Settings Page */}
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <SettingsPage />
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
      </SettingsProvider>
    </AuthProvider>
  );
}
