// API Client for CodeCollab Authentication & Project Ownership
// Note: Tokens are stored exclusively in HttpOnly cookies managed by the browser.
// All requests use credentials: 'include'.

// Authentication and REST APIs must use the backend origin. Socket.IO already
// uses VITE_SOCKET_SERVER_URL, so use it as a safe fallback when a separate
// VITE_API_URL was not configured during the Vite build.
const API_BASE = (
  import.meta.env.VITE_API_URL
  || import.meta.env.VITE_BACKEND_URL
  || (import.meta.env.DEV ? '' : import.meta.env.VITE_SOCKET_SERVER_URL)
  || ''
).replace(/\/$/, '');

export const apiUrl = (endpoint) => `${API_BASE}${endpoint}`;

async function request(endpoint, options = {}) {
  const url = apiUrl(endpoint);
  const config = {
    ...options,
    credentials: 'include', // Include HttpOnly cookies on all requests
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  };

  const response = await fetch(url, config);
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const error = new Error(data?.error || `Request failed with status ${response.status}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  if (!data || typeof data !== 'object') {
    throw new Error('The API returned an invalid response. Check the frontend backend URL configuration.');
  }

  return data;
}

export const api = {
  // Authentication
  async register({ email, password, name }) {
    return request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name })
    });
  },

  async login({ email, password }) {
    return request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
  },

  async logout() {
    return request('/api/auth/logout', {
      method: 'POST'
    });
  },

  async getSession() {
    return request('/api/auth/me', {
      method: 'GET'
    });
  },

  // Projects
  async getProjects() {
    return request('/api/projects', {
      method: 'GET'
    });
  },

  async createProject({ name, roomId }) {
    return request('/api/projects', {
      method: 'POST',
      body: JSON.stringify({ name, roomId })
    });
  },

  async renameProject(id, name) {
    return request(`/api/projects/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify({ name })
    });
  },

  async deleteProject(id) {
    return request(`/api/projects/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
  },

  async getProject(id) {
    return request(`/api/projects/${encodeURIComponent(id)}`, {
      method: 'GET'
    });
  },

  // The project endpoint contains metadata only.  Use this endpoint whenever
  // the actual saved editor files are required (for example, a standalone
  // preview opened in a new browser tab).
  async getProjectWorkspace(roomId) {
    return request(`/api/projects/${encodeURIComponent(roomId)}/files`, {
      method: 'GET'
    });
  },

  // Project Members & Collaborators
  async getProjectMembers(projectId) {
    return request(`/api/projects/${encodeURIComponent(projectId)}/members`, {
      method: 'GET'
    });
  },

  async inviteCollaborator(projectId, { email, role = 'editor' }) {
    return request(`/api/projects/${encodeURIComponent(projectId)}/invitations`, {
      method: 'POST',
      body: JSON.stringify({ email, role })
    });
  },

  async revokeInvitation(projectId, invitationId) {
    return request(`/api/projects/${encodeURIComponent(projectId)}/invitations/${encodeURIComponent(invitationId)}`, {
      method: 'DELETE'
    });
  },

  async updateMemberRole(projectId, userId, role) {
    return request(`/api/projects/${encodeURIComponent(projectId)}/members/${encodeURIComponent(userId)}`, {
      method: 'PUT',
      body: JSON.stringify({ role })
    });
  },

  async removeMember(projectId, userId) {
    return request(`/api/projects/${encodeURIComponent(projectId)}/members/${encodeURIComponent(userId)}`, {
      method: 'DELETE'
    });
  },

  // In-App User Invitations
  async getMyInvitations() {
    return request('/api/invitations', {
      method: 'GET'
    });
  },

  async respondToInvitation(invitationId, action) {
    return request(`/api/invitations/${encodeURIComponent(invitationId)}/respond`, {
      method: 'POST',
      body: JSON.stringify({ action })
    });
  },

  // Project Activity Logs
  async getProjectActivity(projectId, params = {}) {
    const query = new URLSearchParams();
    if (params.limit) query.set('limit', params.limit);
    if (params.offset) query.set('offset', params.offset);
    if (params.filter) query.set('filter', params.filter);
    const queryString = query.toString() ? `?${query.toString()}` : '';
    return request(`/api/projects/${encodeURIComponent(projectId)}/activity${queryString}`, {
      method: 'GET'
    });
  }
};

