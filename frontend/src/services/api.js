// API Client for CodeCollab Authentication & Project Ownership
// Note: Tokens are stored exclusively in HttpOnly cookies managed by the browser.
// All requests use credentials: 'include'.

// Authentication and REST APIs must use the backend origin. Socket.IO already
// uses VITE_SOCKET_SERVER_URL, so use it as a safe fallback when a separate
// VITE_API_URL was not configured during the Vite build.
const resolveApiBase = () => {
  const configured = import.meta.env.VITE_API_URL || import.meta.env.VITE_BACKEND_URL;
  if (configured) {
    if (typeof window !== 'undefined' && window.location.hostname && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      try {
        const u = new URL(configured);
        if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') {
          u.hostname = window.location.hostname;
          return u.origin;
        }
      } catch {}
    }
    return configured.replace(/\/$/, '');
  }
  if (typeof window !== 'undefined' && window.location.hostname && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    return `${window.location.protocol}//${window.location.hostname}:5000`;
  }
  return (import.meta.env.DEV ? '' : (import.meta.env.VITE_SOCKET_SERVER_URL || '')).replace(/\/$/, '');
};

const API_BASE = resolveApiBase();

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
  },

  // Owner Approval Mode
  async toggleProjectApprovalMode(projectId, requiresApproval) {
    return request(`/api/projects/${encodeURIComponent(projectId)}/approval-mode`, {
      method: 'PUT',
      body: JSON.stringify({ requiresApproval })
    });
  },

  // Change Requests (Role-based permissions & Owner approval workflow)
  async getChangeRequests(projectId, status = 'all') {
    const query = status && status !== 'all' ? `?status=${encodeURIComponent(status)}` : '';
    return request(`/api/projects/${encodeURIComponent(projectId)}/change-requests${query}`, {
      method: 'GET'
    });
  },

  async getChangeRequest(projectId, requestId) {
    return request(`/api/projects/${encodeURIComponent(projectId)}/change-requests/${encodeURIComponent(requestId)}`, {
      method: 'GET'
    });
  },

  async createChangeRequest(projectId, data) {
    return request(`/api/projects/${encodeURIComponent(projectId)}/change-requests`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async reviewChangeRequest(projectId, requestId, { status, rejectionReason }) {
    return request(`/api/projects/${encodeURIComponent(projectId)}/change-requests/${encodeURIComponent(requestId)}/review`, {
      method: 'POST',
      body: JSON.stringify({ status, rejectionReason })
    });
  },

  async updateProtectedFiles(projectId, protectedFiles) {
    return request(`/api/projects/${encodeURIComponent(projectId)}/protected-files`, {
      method: 'PUT',
      body: JSON.stringify({ protectedFiles })
    });
  },

  // Sandboxed Multi-Language Code Execution
  async executeCode({ projectId, language, fileName, code, stdin, files, provider }) {
    return request('/api/execute/run', {
      method: 'POST',
      body: JSON.stringify({
        projectId,
        language,
        fileName,
        code,
        stdin,
        files,
        provider
      })
    });
  },

  async getExecutionLanguages() {
    return request('/api/execute/languages', {
      method: 'GET'
    });
  },

  // Project Real-Time Chat
  async getProjectChat(projectId, limit = 100) {
    return request(`/api/projects/${encodeURIComponent(projectId)}/chat?limit=${limit}`, {
      method: 'GET'
    });
  },

  async sendChatMessage(projectId, payload) {
    const data = typeof payload === 'string' ? { message: payload } : (payload || {});
    return request(`/api/projects/${encodeURIComponent(projectId)}/chat`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async editChatMessage(projectId, messageId, payload) {
    const data = typeof payload === 'string' ? { message: payload } : (payload || {});
    return request(`/api/projects/${encodeURIComponent(projectId)}/chat/${encodeURIComponent(messageId)}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
  },

  async deleteChatMessage(projectId, messageId) {
    return request(`/api/projects/${encodeURIComponent(projectId)}/chat/${encodeURIComponent(messageId)}`, {
      method: 'DELETE'
    });
  },

  // Project Code Comments
  async getCodeComments(projectId, filePath = null) {
    const query = filePath ? `?file=${encodeURIComponent(filePath)}` : '';
    return request(`/api/projects/${encodeURIComponent(projectId)}/comments${query}`, {
      method: 'GET'
    });
  },

  async createCodeComment(projectId, payload) {
    const data = typeof payload === 'string' ? { content: payload } : (payload || {});
    if (data.selectedText && !data.lineContent) {
      data.lineContent = data.selectedText;
    }
    return request(`/api/projects/${encodeURIComponent(projectId)}/comments`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async replyCodeComment(projectId, commentId, payload) {
    const data = typeof payload === 'string' ? { content: payload } : (payload || {});
    return request(`/api/projects/${encodeURIComponent(projectId)}/comments/${encodeURIComponent(commentId)}/replies`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async resolveCodeComment(projectId, commentId, isResolved) {
    return request(`/api/projects/${encodeURIComponent(projectId)}/comments/${encodeURIComponent(commentId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ isResolved })
    });
  },

  async deleteCodeComment(projectId, commentId) {
    return request(`/api/projects/${encodeURIComponent(projectId)}/comments/${encodeURIComponent(commentId)}`, {
      method: 'DELETE'
    });
  },

  // In-App Notifications
  async getNotifications(limit = 50) {
    return request(`/api/notifications?limit=${limit}`, {
      method: 'GET'
    });
  },

  async markNotificationRead(id) {
    return request(`/api/notifications/${encodeURIComponent(id)}/read`, {
      method: 'PATCH'
    });
  },

  async markAllNotificationsRead() {
    return request('/api/notifications/read-all', {
      method: 'PATCH'
    });
  }
};

