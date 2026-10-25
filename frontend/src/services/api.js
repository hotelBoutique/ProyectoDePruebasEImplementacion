const apiBase = import.meta.env.VITE_API_BASE_URL || '/api/v1';

export async function checkBackend() {
  const response = await fetch('/health', {
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`El backend respondió con estado ${response.status}`);
  }

  return response.json();
}

export async function apiRequest(path, options = {}) {
  const { token, ...requestOptions } = options;

  const response = await fetch(`${apiBase}${path}`, {
    ...requestOptions,
    headers: {
      Accept: 'application/json',
      ...(requestOptions.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...requestOptions.headers,
    },
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.message || `La API respondió con estado ${response.status}`);
    error.status = response.status;
    throw error;
  }

  return data;
}

export function login(credentials) {
  return apiRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify(credentials),
  });
}

export function getCurrentUser(token) {
  return apiRequest('/auth/me', { token });
}

export function getAdminDashboard(token) {
  return apiRequest('/admin/dashboard', { token });
}

export function getReceptionDashboard(token) {
  return apiRequest('/reception/dashboard', { token });
}

export function logoutSession(token) {
  return apiRequest('/auth/logout', {
    method: 'POST',
    token,
  });
}
