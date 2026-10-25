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
  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || `La API respondió con estado ${response.status}`);
  }

  return data;
}
