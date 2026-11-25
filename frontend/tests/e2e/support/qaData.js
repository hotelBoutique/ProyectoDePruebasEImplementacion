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

// ---------------------------------------------------------------------------
// Datos del flujo de recepción (reservation-flow: reserva → check-in → consumo → pago y check-out).
// Usa su propia habitación y su propio producto, con precios 888.xxx, para no alterar las
// suites de habitaciones y disponibilidad, que esperan exactamente cuatro habitaciones 777.xxx.

export const RECEPTION_PRICE_RANGE = { min: 888000, max: 888999 };

export const RECEPTION_ROOM = {
  number: 'E2E-R01',
  type: 'Doble',
  capacity: 2,
  price: 888100,
  status: 'disponible',
  description: 'Habitación de prueba E2E del flujo de recepción',
};

export const RECEPTION_PRODUCT = {
  name: 'Agua E2E Recepción',
  description: 'Producto de prueba E2E del flujo de recepción',
  category: 'Minibar',
  price: 8800,
  stock: 500,
  isActive: true,
};

// Stock mínimo antes de reponer el producto de prueba.
const RECEPTION_PRODUCT_MIN_STOCK = 50;

// Datos únicos del huésped en cada corrida, para encontrar su reserva entre las demás de QA.
export function receptionGuest(runId = Date.now().toString(36)) {
  return {
    fullName: `Huésped E2E Recepción ${runId}`,
    email: `e2e.recepcion.${runId}@example.test`,
    phone: '3001234567',
    identification: `E2E-${runId}`,
  };
}

// Pide el token de administrador solo la primera vez que se necesita.
function lazyAdminToken() {
  let token;
  return {
    async get() {
      if (!token) token = await apiLogin(process.env.TEST_ADMIN_EMAIL, process.env.TEST_ADMIN_PASSWORD);
      return token;
    },
    async release() {
      if (token) await apiLogout(token);
    },
  };
}

async function findReceptionRoom(token) {
  const query = new URLSearchParams({
    minPrice: String(RECEPTION_PRICE_RANGE.min),
    maxPrice: String(RECEPTION_PRICE_RANGE.max),
  });
  const data = await request('GET', `/rooms?${query}`, token);
  return (data.data?.rooms || []).find((room) => room.number === RECEPTION_ROOM.number);
}

async function findReceptionProduct(token) {
  const query = new URLSearchParams({ search: RECEPTION_PRODUCT.name });
  const data = await request('GET', `/products?${query}`, token);
  return (data.data?.products || []).find((product) => product.name === RECEPTION_PRODUCT.name);
}

// Cierra lo que haya dejado una corrida anterior que falló a mitad del flujo:
// hace check-out de una estancia activa en la habitación de prueba y cancela sus reservas pendientes.
export async function releaseReceptionRoom(receptionToken, room) {
  const pendingCheckOuts = await request('GET', '/reservations/check-outs/pending', receptionToken);
  const activeStays = (pendingCheckOuts.data?.reservations || [])
    .filter((reservation) => reservation.roomNumber === RECEPTION_ROOM.number && reservation.settlementEstimate);
  for (const stay of activeStays) {
    await request('POST', `/reservations/${stay._id}/check-out`, receptionToken, {
      additionalCharges: [],
      paidAmount: stay.settlementEstimate.totalDue,
      paymentMethod: 'efectivo',
    });
  }

  const query = new URLSearchParams({ roomId: room._id, status: 'reservada' });
  const reserved = await request('GET', `/reservations?${query}`, receptionToken);
  for (const reservation of reserved.data?.reservations || []) {
    await request('POST', `/reservations/${reservation._id}/cancel`, receptionToken, {
      reason: 'Limpieza automática de la suite E2E del flujo de recepción',
    });
  }
}

// Deja lista la habitación E2E-R01 (libre y con su tarifa) y el producto de prueba con stock.
// Es idempotente: solo crea o corrige lo que falte.
export async function prepareReceptionFlow(receptionToken) {
  const admin = lazyAdminToken();
  try {
    let room = await findReceptionRoom(receptionToken);
    if (!room) {
      await request('POST', '/rooms', await admin.get(), RECEPTION_ROOM);
      room = await findReceptionRoom(receptionToken);
    }

    await releaseReceptionRoom(receptionToken, room);
    room = await findReceptionRoom(receptionToken);
    if (room.status !== RECEPTION_ROOM.status || room.price !== RECEPTION_ROOM.price) {
      await request('PATCH', `/rooms/${room._id}`, await admin.get(), {
        status: RECEPTION_ROOM.status,
        price: RECEPTION_ROOM.price,
      });
      room = await findReceptionRoom(receptionToken);
    }

    // La recepción solo ve productos activos; si no aparece, se busca como administrador.
    let product = await findReceptionProduct(receptionToken)
      || await findReceptionProduct(await admin.get());
    if (!product) {
      await request('POST', '/products', await admin.get(), RECEPTION_PRODUCT);
    } else if (
      !product.isActive
      || product.price !== RECEPTION_PRODUCT.price
      || product.stock < RECEPTION_PRODUCT_MIN_STOCK
    ) {
      await request('PATCH', `/products/${product._id}`, await admin.get(), {
        isActive: true,
        price: RECEPTION_PRODUCT.price,
        stock: Math.max(product.stock, RECEPTION_PRODUCT.stock),
      });
    }
    product = await findReceptionProduct(receptionToken);

    return { room, product };
  } finally {
    await admin.release();
  }
}

// ---------------------------------------------------------------------------
// Datos de la suite del administrador (admin-management): habitaciones, productos, usuarios y reportes.

// Lectura directa de la API, para comparar lo que muestra la interfaz con lo que responde el servidor.
export async function apiGet(path, token) {
  return request('GET', path, token);
}

// Las habitaciones que crea la suite del administrador usan el rango 999.xxx, distinto de las demás suites.
export const ADMIN_PRICE_RANGE = { min: 999000, max: 999999 };

// Registros únicos por corrida. La API no permite borrar habitaciones, productos ni usuarios,
// así que la suite los deja desactivados al terminar y con el prefijo E2E para identificarlos.
export function adminRecords(runId = Date.now().toString(36)) {
  return {
    room: {
      number: `E2E-A${runId}`,
      type: 'Suite',
      description: 'Habitación de prueba E2E del administrador',
      capacity: '3',
      price: '999100',
      status: 'disponible',
    },
    product: {
      name: `Producto E2E Admin ${runId}`,
      category: 'Minibar E2E',
      description: 'Producto de prueba E2E del administrador',
      price: '9900',
      stock: '30',
    },
    receptionist: {
      name: `Recepcionista E2E ${runId}`,
      email: `e2e.admin.${runId}@example.test`,
      password: `Recepcion-E2E-${runId}`,
    },
  };
}

// Registra por API una estadía completa y pagada hoy en la habitación del flujo de recepción
// (reserva → check-in → consumo → check-out), para que los reportes de ingresos y ventas tengan
// un pago conocido. Devuelve el total cobrado.
export async function completeStayByApi(receptionToken, { room, product, guest, quantity = 2 }) {
  const created = await request('POST', '/reservations', receptionToken, {
    guest,
    roomId: room._id,
    checkIn: dateOnly(0),
    checkOut: dateOnly(1),
    nightlyRate: room.price,
  });
  const reservationId = created.data.reservation._id;
  await request('POST', `/reservations/${reservationId}/check-in`, receptionToken);
  await request('POST', `/reservations/${reservationId}/consumptions`, receptionToken, {
    productId: product._id,
    quantity,
  });

  const pending = await request('GET', '/reservations/check-outs/pending', receptionToken);
  const stay = (pending.data?.reservations || []).find((reservation) => reservation._id === reservationId);
  await request('POST', `/reservations/${reservationId}/check-out`, receptionToken, {
    additionalCharges: [],
    paidAmount: stay.settlementEstimate.totalDue,
    paymentMethod: 'transferencia',
  });
  return { reservationId, total: stay.settlementEstimate.totalDue };
}
