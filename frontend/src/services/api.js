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

export function getOccupancyReport(token, { startDate, endDate }) {
  const params = new URLSearchParams({ startDate, endDate });
  return apiRequest(`/admin/reports/occupancy?${params.toString()}`, { token });
}

export function getIncomeReport(token, { startDate, endDate }) {
  const params = new URLSearchParams({ startDate, endDate });
  return apiRequest(`/admin/reports/income?${params.toString()}`, { token });
}

export function getSalesReport(token, { startDate, endDate }) {
  const params = new URLSearchParams({ startDate, endDate });
  return apiRequest(`/admin/reports/sales?${params.toString()}`, { token });
}

export function getReceptionDashboard(token) {
  return apiRequest('/reception/dashboard', { token });
}

function getReceptionReport(token, report, date) {
  const query = date ? `?${new URLSearchParams({ date }).toString()}` : '';
  return apiRequest(`/reception/reports/${report}${query}`, { token });
}

export function getDailyReport(token, date) {
  return getReceptionReport(token, 'daily', date);
}

export function getArrivalsReport(token, date) {
  return getReceptionReport(token, 'arrivals', date);
}

export function getDeparturesReport(token, date) {
  return getReceptionReport(token, 'departures', date);
}

export function getCurrentOccupancyReport(token) {
  return getReceptionReport(token, 'occupancy');
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

export function getRooms(token, filters = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([name, value]) => {
    const text = String(value ?? '').trim();
    if (text) params.set(name, text);
  });
  const query = params.toString();

  return apiRequest(`/rooms${query ? `?${query}` : ''}`, { token });
}

export function updateRoom(token, roomId, changes) {
  return apiRequest(`/rooms/${encodeURIComponent(roomId)}`, {
    method: 'PATCH',
    token,
    body: JSON.stringify(changes),
  });
}

export function getAvailableRooms(token, { checkIn, checkOut, roomId, type, guests, maxPrice }) {
  const params = new URLSearchParams({ checkIn, checkOut });
  Object.entries({ roomId, type, guests, maxPrice }).forEach(([name, value]) => {
    const text = String(value ?? '').trim();
    if (text) params.set(name, text);
  });

  return apiRequest(`/reservations/availability?${params.toString()}`, { token });
}

export function getReservations(token, filters = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([name, value]) => {
    if (value) params.set(name, value);
  });
  const query = params.toString();
  return apiRequest(`/reservations${query ? `?${query}` : ''}`, { token });
}

export function getSettlementHistory(token) {
  return apiRequest('/reservations/settlements/history', { token });
}

export function getPayments(token, filters = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([name, value]) => {
    const text = String(value ?? '').trim();
    if (text) params.set(name, text);
  });
  const query = params.toString();
  return apiRequest(`/reservations/payments${query ? `?${query}` : ''}`, { token });
}

export function getPaymentDetails(token, reservationId) {
  return apiRequest(`/reservations/payments/${encodeURIComponent(reservationId)}`, { token });
}

export function getReservation(token, reservationId) {
  return apiRequest(`/reservations/${encodeURIComponent(reservationId)}`, { token });
}

export function cancelReservation(token, reservationId, reason) {
  return apiRequest(`/reservations/${encodeURIComponent(reservationId)}/cancel`, {
    method: 'POST',
    token,
    body: JSON.stringify({ reason }),
  });
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

export function getProducts(token, filters = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([name, value]) => {
    const text = String(value ?? '').trim();
    if (text) params.set(name, text);
  });
  const query = params.toString();

  return apiRequest(`/products${query ? `?${query}` : ''}`, { token });
}

export function getProductCategories(token) {
  return apiRequest('/products/categories', { token });
}

export function addReservationConsumption(token, reservationId, consumption) {
  return apiRequest(`/reservations/${encodeURIComponent(reservationId)}/consumptions`, {
    method: 'POST',
    token,
    body: JSON.stringify(consumption),
  });
}
