import { useState, useEffect, useCallback } from 'react';
import { AuthContext } from './authContextDef';
import { api } from '../services/api';
import { formatAuthUser } from '../utils/user';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [invitations, setInvitations] = useState([]);
  const [invitationsLoading, setInvitationsLoading] = useState(false);

  // Fetch projects from server
  const refreshProjects = useCallback(async () => {
    setProjectsLoading(true);
    try {
      const res = await api.getProjects();
      setProjects(Array.isArray(res?.projects) ? res.projects : []);
    } catch (err) {
      console.error('[AuthContext] Failed to fetch projects:', err);
    } finally {
      setProjectsLoading(false);
    }
  }, []);

  // Fetch incoming project invitations
  const refreshInvitations = useCallback(async () => {
    setInvitationsLoading(true);
    try {
      const res = await api.getMyInvitations();
      setInvitations(Array.isArray(res?.invitations) ? res.invitations : []);
    } catch (err) {
      console.error('[AuthContext] Failed to fetch invitations:', err);
    } finally {
      setInvitationsLoading(false);
    }
  }, []);

  // Check existing session on application start
  useEffect(() => {
    let isMounted = true;

    async function checkSession() {
      try {
        const res = await api.getSession();
        if (isMounted) {
          if (res?.user) {
            setUser(formatAuthUser(res.user));
            // Pre-load projects and invitations before finishing loading so direct route refreshes have full project context
            try {
              const [pRes, iRes] = await Promise.allSettled([
                api.getProjects(),
                api.getMyInvitations()
              ]);
              if (isMounted && pRes.status === 'fulfilled' && Array.isArray(pRes.value?.projects)) {
                setProjects(pRes.value.projects);
              }
              if (isMounted && iRes.status === 'fulfilled' && Array.isArray(iRes.value?.invitations)) {
                setInvitations(iRes.value.invitations);
              }
            } catch (pErr) {
              console.warn('[AuthContext] Project pre-fetch warning:', pErr);
            }
          } else {
            setUser(null);
            setProjects([]);
            setInvitations([]);
          }
        }
      } catch {
        if (isMounted) {
          setUser(null);
          setProjects([]);
          setInvitations([]);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    checkSession();

    return () => {
      isMounted = false;
    };
  }, []);

  // Login handler
  const login = async (email, password) => {
    const res = await api.login({ email, password });
    if (res?.user) {
      const formatted = formatAuthUser(res.user);
      setUser(formatted);
      await refreshProjects();
      return formatted;
    }
    throw new Error('Login failed: invalid response from server.');
  };

  // Register handler
  const register = async (email, password, name) => {
    const res = await api.register({ email, password, name });
    if (res?.user) {
      const formatted = formatAuthUser(res.user);
      setUser(formatted);
      await refreshProjects();
      return formatted;
    }
    throw new Error('Registration failed: invalid response from server.');
  };

  // Logout handler
  const logout = async () => {
    try {
      await api.logout();
    } catch (err) {
      console.warn('[AuthContext] Logout request error:', err);
    } finally {
      setUser(null);
      setProjects([]);
    }
  };

  // Create project
  const createProject = async (name, roomId, options = {}) => {
    const payload = typeof options === 'string'
      ? { name, roomId, projectType: options }
      : { name, roomId, ...options };
    const res = await api.createProject(payload);
    if (res?.project) {
      setProjects((prev) => [res.project, ...prev.filter((p) => p.id !== res.project.id)]);
      return res.project;
    }
    throw new Error('Failed to create project.');
  };

  // Rename project (supports new name and/or new room ID)
  const renameProject = async (id, newNameOrData) => {
    const res = await api.renameProject(id, newNameOrData);
    if (res?.project) {
      setProjects((prev) =>
        prev.map((p) =>
          p.id === id ||
          p.room_id === id ||
          p.id === res.project.id ||
          (res.project.old_room_id && p.room_id === res.project.old_room_id)
            ? res.project
            : p
        )
      );
      return res.project;
    }
    throw new Error('Failed to rename project.');
  };

  // Delete project
  const deleteProject = async (id) => {
    await api.deleteProject(id);
    setProjects((prev) => prev.filter((p) => p.id !== id && p.room_id !== id));
  };

  // Respond to invitation (accept/decline)
  const respondInvitation = async (id, action) => {
    const res = await api.respondToInvitation(id, action);
    setInvitations((prev) => prev.filter((inv) => inv.id !== id));
    if (action === 'accept') {
      await refreshProjects();
    }
    return res;
  };

  const value = {
    user,
    loading,
    isAuthenticated: Boolean(user),
    projects,
    projectsLoading,
    refreshProjects,
    invitations,
    invitationsLoading,
    refreshInvitations,
    respondInvitation,
    login,
    register,
    logout,
    createProject,
    renameProject,
    deleteProject
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
