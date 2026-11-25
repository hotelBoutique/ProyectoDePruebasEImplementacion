// Datos fijos para las suites E2E, creados en la API y base de pruebas indicadas por TEST_API_URL.
// La UAT local valida antes que la API y MongoDB apunten a loopback y a una base _test.
// Es idempotente: solo crea o corrige lo que falte, así que se puede ejecutar en cada corrida.
// Las habitaciones usan el prefijo "E2E-" y precios únicos (777.xxx) para distinguirlas
// de los datos que dejan otras pruebas (por ejemplo, la colección de Postman).

const DAY = 24 * 60 * 60 * 1000;

export const PRICE_RANGE = { min: 777000, max: 777999 };

export const E2E_ROOMS = [
  { number: 'E2E-101', type: 'Sencilla', capacity: 1, price: 777100, status: 'disponible', description: 'Habitación de prueba E2E sencilla' },
  { number: 'E2E-201', type: 'Doble', capacity: 2, price: 777200, status: 'disponible', description: 'Habitación de prueba E2E doble' },
  { number: 'E2E-301', type: 'Suite', capacity: 3, price: 777300, status: 'disponible', description: 'Habitación de prueba E2E con reserva futura' },
  { number: 'E2E-401', type: 'Familiar', capacity: 4, price: 777400, status: 'fuera de servicio', description: 'Habitación de prueba E2E fuera de servicio' },
];

export function dateOnly(offsetDays) {
  return new Date(Date.now() + offsetDays * DAY).toISOString().slice(0, 10);
}

// Ventana futura en la que E2E-301 queda reservada: [hoy+40, hoy+42).
export const RESERVED_WINDOW = { checkIn: dateOnly(40), checkOut: dateOnly(42) };

function apiBase() {
  return `${process.env.TEST_API_URL}/api/v1`;
}

async function request(method, path, token, body) {
  const response = await fetch(`${apiBase()}${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const details = Array.isArray(data.errors) ? data.errors.map((item) => item.msg).join('. ') : '';
    throw new Error(`${method} ${path} respondió ${response.status}: ${data.message || ''} ${details}`.trim());
  }
  return data;
}

export async function apiLogin(email, password) {
  const data = await request('POST', '/auth/login', null, { email, password });
  return data.data.token;
}

export async function apiLogout(token) {
  try {
    await request('POST', '/auth/logout', token);
  } catch {
    // Si el token ya no es válido no hay nada que revocar.
  }
}

export async function ensureReceptionist(adminToken, account) {
  const response = await request('GET', '/users', adminToken);
  const users = response.data?.users || [];
  const existing = users.find((user) => user.email?.toLowerCase() === account.email.toLowerCase());

  if (!existing) {
    const created = await request('POST', '/users', adminToken, account);
    return created.data?.user;
  }

  if (!existing.isActive) {
    const activated = await request('PATCH', `/users/${existing._id}/status`, adminToken, { isActive: true });
    return activated.data?.user;
  }

  return existing;
}

async function listE2ERooms(token) {
  const query = new URLSearchParams({ minPrice: String(PRICE_RANGE.min), maxPrice: String(PRICE_RANGE.max) });
  const data = await request('GET', `/rooms?${query}`, token);
  return new Map((data.data?.rooms || []).map((room) => [room.number, room]));
}

// Crea las habitaciones E2E que falten y corrige su estado si alguien lo cambió.
// Solo inicia sesión como administrador si hay algo que crear o corregir.
export async function ensureRooms(receptionToken) {
  let existing = await listE2ERooms(receptionToken);
  const pending = E2E_ROOMS.filter((room) => {
    const current = existing.get(room.number);
    return !current || current.status !== room.status || current.price !== room.price;
  });

  if (pending.length) {
    const adminToken = await apiLogin(process.env.TEST_ADMIN_EMAIL, process.env.TEST_ADMIN_PASSWORD);
    try {
      for (const room of pending) {
        const current = existing.get(room.number);
        if (current) {
          await request('PATCH', `/rooms/${current._id}`, adminToken, { status: room.status, price: room.price });
        } else {
          await request('POST', '/rooms', adminToken, room);
        }
      }
    } finally {
      await apiLogout(adminToken);
    }
    existing = await listE2ERooms(receptionToken);
  }

  return Object.fromEntries(E2E_ROOMS.map((room) => [room.number, existing.get(room.number)]));
}

// Deja E2E-301 reservada en RESERVED_WINDOW (solo la crea si todavía está libre).
export async function ensureReservedWindow(receptionToken, room) {
  const { checkIn, checkOut } = RESERVED_WINDOW;
  const query = new URLSearchParams({ checkIn, checkOut, roomId: room._id });
  const availability = await request('GET', `/reservations/availability?${query}`, receptionToken);
  const stillFree = (availability.data?.rooms || []).some((item) => item._id === room._id);

  if (stillFree) {
    await request('POST', '/reservations', receptionToken, {
      guest: {
        fullName: 'Huésped E2E Disponibilidad',
        email: 'e2e.disponibilidad@example.test',
        phone: '3000000000',
        identification: 'E2E-0001',
      },
      roomId: room._id,
      checkIn,
      checkOut,
      nightlyRate: room.price,
    });
  }
}
