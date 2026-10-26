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
    error.details = data.errors?.map((item) => item.msg).filter(Boolean) || data.details || [];
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

export function updateMyProfile(token, profile) {
  return apiRequest('/auth/me', {
    method: 'PATCH',
    token,
    body: JSON.stringify(profile),
  });
}

export function getAdminDashboard(token) {
  return apiRequest('/admin/dashboard', { token });
}

export function getReceptionDashboard(token) {
  return apiRequest('/reception/dashboard', { token });
}

export function getReceptionists(token) {
  return apiRequest('/users', { token });
}

export function createReceptionist(token, receptionist) {
  return apiRequest('/users', {
    method: 'POST',
    token,
    body: JSON.stringify(receptionist),
  });
}

export function createAdminUser(token, account) {
  return apiRequest('/users/admin', {
    method: 'POST',
    token,
    body: JSON.stringify(account),
  });
}

export function setReceptionistStatus(token, userId, isActive) {
  return apiRequest(`/users/${encodeURIComponent(userId)}/status`, {
    method: 'PATCH',
    token,
    body: JSON.stringify({ isActive }),
  });
}

export function updateReceptionist(token, userId, changes) {
  return apiRequest(`/users/${encodeURIComponent(userId)}`, {
    method: 'PATCH',
    token,
    body: JSON.stringify(changes),
  });
}

export function logoutSession(token) {
  return apiRequest('/auth/logout', {
    method: 'POST',
    token,
  });
}

export function createRoom(token, room) {
  return apiRequest('/rooms', {
    method: 'POST',
    token,
    body: JSON.stringify(room),
  });
}

export function getRooms(token) {
  return apiRequest('/rooms', { token });
}

export function updateRoom(token, roomId, changes) {
  return apiRequest(`/rooms/${encodeURIComponent(roomId)}`, {
    method: 'PATCH',
    token,
    body: JSON.stringify(changes),
  });
}

export function getAvailableRooms(token, { checkIn, checkOut, roomId }) {
  const params = new URLSearchParams({ checkIn, checkOut });
  if (roomId) params.set('roomId', roomId);

  return apiRequest(`/reservations/availability?${params.toString()}`, { token });
}

export function createReservation(token, reservation) {
  return apiRequest('/reservations', {
    method: 'POST',
    token,
    body: JSON.stringify(reservation),
  });
}

export function getPendingCheckIns(token) {
  return apiRequest('/reservations/check-ins/pending', { token });
}

export function checkInReservation(token, reservationId) {
  return apiRequest(`/reservations/${encodeURIComponent(reservationId)}/check-in`, {
    method: 'POST',
    token,
  });
}

export function getPendingCheckOuts(token) {
  return apiRequest('/reservations/check-outs/pending', { token });
}

export function checkOutReservation(token, reservationId, settlement) {
  return apiRequest(`/reservations/${encodeURIComponent(reservationId)}/check-out`, {
    method: 'POST',
    token,
    body: JSON.stringify(settlement),
  });
}
