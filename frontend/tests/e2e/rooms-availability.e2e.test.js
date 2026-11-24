// Automatización de la consulta del listado de habitaciones y de la búsqueda de disponibilidad
// con Selenium WebDriver y Page Object Model, contra el frontend conectado a la API de QA.
// Antes de abrir el navegador se preparan datos fijos (habitaciones E2E-… y una reserva futura)
// para poder comprobar resultados concretos. Ver tests/e2e/support/qaData.js.
import { createBrowser } from './pages/BasePage.js';
import { LoginPage } from './pages/LoginPage.js';
import { DashboardPage } from './pages/DashboardPage.js';
import { RoomsPage } from './pages/RoomsPage.js';
import { AvailabilityPage } from './pages/AvailabilityPage.js';
import {
  E2E_ROOMS,
  PRICE_RANGE,
  RESERVED_WINDOW,
  apiLogin,
  apiLogout,
  dateOnly,
  ensureReservedWindow,
  ensureRooms,
} from './support/qaData.js';

const { TEST_APP_URL, TEST_RECEPTION_EMAIL, TEST_RECEPTION_PASSWORD } = process.env;

const STATUS_LABELS = { disponible: 'Disponible', 'fuera de servicio': 'Fuera de servicio' };
const E2E_NUMBERS = E2E_ROOMS.map((room) => room.number);
const RANGE = { minPrice: PRICE_RANGE.min, maxPrice: PRICE_RANGE.max };

const normalize = (text) => text.replace(/\s/g, ' ');
const cop = (value) => normalize(new Intl.NumberFormat('es-CO', {
  style: 'currency', currency: 'COP', maximumFractionDigits: 0,
}).format(value));
const shortDate = (value) => normalize(new Intl.DateTimeFormat('es-CO', {
  day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC',
}).format(new Date(`${value}T00:00:00.000Z`)));
const nightsLabel = (nights) => (nights === 1 ? '1 noche' : `${nights} noches`);
const numbersOf = (rows) => rows.map((row) => row.number);
const e2eRoom = (number) => E2E_ROOMS.find((room) => room.number === number);

let driver;
let token;
let dashboard;
let roomsPage;
let availabilityPage;

beforeAll(async () => {
  token = await apiLogin(TEST_RECEPTION_EMAIL, TEST_RECEPTION_PASSWORD);
  const rooms = await ensureRooms(token);
  await ensureReservedWindow(token, rooms['E2E-301']);

  driver = await createBrowser();
  dashboard = new DashboardPage(driver);
  roomsPage = new RoomsPage(driver);
  availabilityPage = new AvailabilityPage(driver);

  await new LoginPage(driver).openWithSession(TEST_APP_URL, token);
  await dashboard.waitForDashboard();
  expect(await dashboard.role()).toBe('ROL: RECEPCIONISTA');
});

afterAll(async () => {
  if (driver) await driver.quit();
  if (token) await apiLogout(token);
});

describe('Consulta del listado de habitaciones', () => {
  beforeAll(async () => {
    await dashboard.navigate('Listado de habitaciones');
    await roomsPage.waitForPage();
  });

  test('carga el inventario al abrir la página', async () => {
    const rows = await roomsPage.waitForRows(
      (current) => E2E_NUMBERS.every((number) => numbersOf(current).includes(number)),
      'El inventario no mostró las habitaciones de prueba',
    );

    expect(rows.length).toBeGreaterThanOrEqual(E2E_ROOMS.length);
  });

  test('presenta número, tipo, descripción, capacidad, tarifa y estado de cada habitación', async () => {
    await roomsPage.filter(RANGE);
    const rows = await roomsPage.waitForRows(
      (current) => current.length === E2E_ROOMS.length,
      'El filtro por rango de precio no dejó solo las habitaciones de prueba',
    );

    for (const room of E2E_ROOMS) {
      const row = rows.find((item) => item.number === room.number);
      expect(row).toMatchObject({
        type: room.type,
        capacity: `${room.capacity} personas`,
        price: cop(room.price),
        status: STATUS_LABELS[room.status],
      });
      expect(row.typeAndDescription).toContain(room.description);
    }
    expect(await roomsPage.summaryText()).toBe('4 habitaciones coinciden con los filtros.');
  });

  test('filtra por tipo de habitación', async () => {
    await roomsPage.filter({ ...RANGE, type: 'Suite' });
    const rows = await roomsPage.waitForRows((current) => current.length === 1, 'El filtro por tipo no devolvió una sola habitación');

    expect(numbersOf(rows)).toEqual(['E2E-301']);
    expect(await roomsPage.summaryText()).toBe('1 habitación coincide con los filtros.');
  });

  test('filtra por estado', async () => {
    await roomsPage.filter({ ...RANGE, status: 'fuera de servicio' });
    const rows = await roomsPage.waitForRows((current) => current.length === 1, 'El filtro por estado no devolvió una sola habitación');

    expect(rows[0]).toMatchObject({ number: 'E2E-401', status: 'Fuera de servicio' });
  });

  test('filtra por capacidad mínima', async () => {
    await roomsPage.filter({ ...RANGE, minCapacity: 3 });
    const rows = await roomsPage.waitForRows((current) => current.length === 2, 'El filtro por capacidad no devolvió dos habitaciones');

    expect(numbersOf(rows).sort()).toEqual(['E2E-301', 'E2E-401']);
  });

  test('muestra el estado vacío cuando ninguna habitación coincide', async () => {
    await roomsPage.filter({ ...RANGE, type: 'Sencilla', minCapacity: 4 });

    expect(await roomsPage.waitForEmptyState()).toBe('Ninguna habitación coincide');
  });

  test('valida que el precio máximo no sea menor que el mínimo', async () => {
    await roomsPage.filter({ minPrice: 900000, maxPrice: 100 });

    expect(await roomsPage.filterError()).toBe('El precio máximo debe ser mayor o igual al precio mínimo.');
  });

  test('limpiar los filtros vuelve a mostrar todo el inventario', async () => {
    await roomsPage.filter({ ...RANGE, type: 'Suite' });
    await roomsPage.waitForRows((current) => current.length === 1, 'No se aplicó el filtro previo');

    await roomsPage.clearFilters();
    const rows = await roomsPage.waitForRows(
      (current) => current.length >= E2E_ROOMS.length && E2E_NUMBERS.every((number) => numbersOf(current).includes(number)),
      'Limpiar filtros no restauró el inventario',
    );

    expect(rows.length).toBeGreaterThanOrEqual(E2E_ROOMS.length);
  });
});

describe('Búsqueda de disponibilidad por fechas', () => {
  beforeAll(async () => {
    await dashboard.navigate('Consultar disponibilidad');
    await availabilityPage.waitForPage();
  });

  async function searchAndWait(criteria) {
    await availabilityPage.setCriteria(criteria);
    await availabilityPage.search();
    const nights = Math.round((new Date(criteria.checkOut) - new Date(criteria.checkIn)) / 86400000);
    const expectedEnd = `${nightsLabel(nights)} · ${shortDate(criteria.checkIn)} – ${shortDate(criteria.checkOut)}`;
    const summary = await availabilityPage.waitForSummary(
      (text) => normalize(text).endsWith(expectedEnd),
      `El resumen no reflejó la búsqueda ${criteria.checkIn} → ${criteria.checkOut}`,
    );
    return { nights, summary: normalize(summary), rows: await availabilityPage.rows() };
  }

  test('consulta con las fechas por defecto (hoy y mañana)', async () => {
    await availabilityPage.search();
    const summary = await availabilityPage.waitForSummary(
      (text) => normalize(text).includes(`1 noche · ${shortDate(dateOnly(0))} – ${shortDate(dateOnly(1))}`),
      'La búsqueda por defecto no mostró 1 noche entre hoy y mañana',
    );

    expect(summary).toBeTruthy();
    expect(numbersOf(await availabilityPage.rows())).not.toContain('E2E-401');
  });

  test('muestra las habitaciones libres con tarifa y total estimado por las noches elegidas', async () => {
    const { nights, rows } = await searchAndWait({ checkIn: dateOnly(50), checkOut: dateOnly(53) });

    expect(nights).toBe(3);
    expect(numbersOf(rows)).toEqual(expect.arrayContaining(['E2E-101', 'E2E-201', 'E2E-301']));

    const suite = rows.find((row) => row.number === 'E2E-301');
    expect(suite).toMatchObject({
      type: 'Suite',
      capacity: '3 personas',
      price: cop(e2eRoom('E2E-301').price),
      total: cop(e2eRoom('E2E-301').price * 3),
      totalNights: '3 noches',
    });
  });

  test('excluye las habitaciones fuera de servicio', async () => {
    const { rows } = await searchAndWait({ checkIn: dateOnly(50), checkOut: dateOnly(52) });

    expect(numbersOf(rows)).not.toContain('E2E-401');
    expect(numbersOf(rows)).toContain('E2E-101');
  });

  test('excluye la habitación que ya tiene una reserva en esas fechas', async () => {
    const { rows } = await searchAndWait(RESERVED_WINDOW);

    expect(numbersOf(rows)).not.toContain('E2E-301');
    expect(numbersOf(rows)).toEqual(expect.arrayContaining(['E2E-101', 'E2E-201']));
  });

  test('el día de salida de una reserva queda libre para una nueva entrada', async () => {
    const { rows } = await searchAndWait({ checkIn: RESERVED_WINDOW.checkOut, checkOut: dateOnly(44) });

    expect(numbersOf(rows)).toContain('E2E-301');
  });

  test('aplica los filtros de tipo y número de huéspedes', async () => {
    const { rows } = await searchAndWait({ checkIn: dateOnly(60), checkOut: dateOnly(61), type: 'Suite', guests: '3' });

    expect(numbersOf(rows)).toContain('E2E-301');
    expect(numbersOf(rows)).not.toContain('E2E-101');
    expect(numbersOf(rows)).not.toContain('E2E-201');
    expect(rows.every((row) => row.type === 'Suite')).toBe(true);
  });

  test('muestra el estado vacío cuando ninguna habitación cumple los criterios', async () => {
    const { summary, rows } = await searchAndWait({ checkIn: dateOnly(70), checkOut: dateOnly(72), maxPrice: '0' });

    expect(rows).toHaveLength(0);
    expect(summary.startsWith('0 habitaciones')).toBe(true);
    expect(normalize(await availabilityPage.emptyStateText())).toContain('No hay habitaciones disponibles');
    expect(normalize(await availabilityPage.emptyStateText())).toContain('Ninguna habitación libre cumple los criterios');
  });

  test('valida que el check-out sea posterior al check-in', async () => {
    await availabilityPage.setCriteria({ checkIn: dateOnly(10), checkOut: dateOnly(5) });
    await availabilityPage.search();

    expect(await availabilityPage.noticeText()).toBe('El check-out debe ser posterior al check-in.');
  });

  test('no permite buscar con una fecha de check-in pasada', async () => {
    await availabilityPage.setCriteria({ checkIn: dateOnly(-1), checkOut: dateOnly(1) });
    await availabilityPage.search();

    expect(await availabilityPage.noticeText()).toBe('La fecha de check-in no puede estar en el pasado.');
  });
});
