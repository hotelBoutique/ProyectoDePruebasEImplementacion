import { createBrowser } from '../pages/BasePage.js';
import { LoginPage } from '../pages/LoginPage.js';
import { DashboardPage } from '../pages/DashboardPage.js';
import { RoomsPage } from '../pages/RoomsPage.js';
import { AvailabilityPage } from '../pages/AvailabilityPage.js';
import { ReservationsPage } from '../pages/ReservationsPage.js';
import {
  E2E_ROOMS,
  apiLogin,
  apiLogout,
  dateOnly,
  ensureReceptionist,
  ensureReservedWindow,
  ensureRooms,
} from '../support/qaData.js';

const {
  TEST_APP_URL,
  TEST_ADMIN_EMAIL,
  TEST_ADMIN_PASSWORD,
  TEST_RECEPTION_EMAIL,
  TEST_RECEPTION_PASSWORD,
  TEST_RECEPTION_NAME = 'Recepcionista UAT',
} = process.env;

let driver;
let token;
let dashboard;
let roomsPage;
let availabilityPage;
let reservationsPage;

beforeAll(async () => {
  const missing = [
    ['TEST_ADMIN_EMAIL', TEST_ADMIN_EMAIL],
    ['TEST_ADMIN_PASSWORD', TEST_ADMIN_PASSWORD],
    ['TEST_RECEPTION_EMAIL', TEST_RECEPTION_EMAIL],
    ['TEST_RECEPTION_PASSWORD', TEST_RECEPTION_PASSWORD],
  ].filter(([, value]) => !value).map(([name]) => name);
  if (missing.length) throw new Error(`Completa en frontend/.env.uat: ${missing.join(', ')}.`);

  const adminToken = await apiLogin(TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD);
  try {
    await ensureReceptionist(adminToken, {
      name: TEST_RECEPTION_NAME,
      email: TEST_RECEPTION_EMAIL,
      password: TEST_RECEPTION_PASSWORD,
    });
  } finally {
    await apiLogout(adminToken);
  }

  token = await apiLogin(TEST_RECEPTION_EMAIL, TEST_RECEPTION_PASSWORD);
  const rooms = await ensureRooms(token);
  await ensureReservedWindow(token, rooms['E2E-301']);

  driver = await createBrowser();
  dashboard = new DashboardPage(driver);
  roomsPage = new RoomsPage(driver);
  availabilityPage = new AvailabilityPage(driver);
  reservationsPage = new ReservationsPage(driver);

  await new LoginPage(driver).openWithSession(TEST_APP_URL, token);
  await dashboard.waitForDashboard();
}, 90000);

afterAll(async () => {
  if (driver) await driver.quit();
  if (token) await apiLogout(token);
});

describe('UAT local sanity', () => {
  test('la cuenta de recepción conserva su rol al entrar', async () => {
    expect(await dashboard.role()).toBe('ROL: RECEPCIONISTA');
  });

  test('el listado de habitaciones muestra los fixtures locales', async () => {
    await dashboard.navigate('Listado de habitaciones');
    await roomsPage.waitForPage();

    const expectedNumbers = E2E_ROOMS.map((room) => room.number);
    const rows = await roomsPage.waitForRows(
      (current) => expectedNumbers.every((number) => current.some((room) => room.number === number)),
      'El listado no mostró las habitaciones UAT locales',
    );

    expect(rows.map((room) => room.number)).toEqual(expect.arrayContaining(expectedNumbers));
  });

  test('la búsqueda de disponibilidad devuelve una habitación apta para el periodo', async () => {
    await dashboard.navigate('Consultar disponibilidad');
    await availabilityPage.waitForPage();
    await availabilityPage.setCriteria({
      checkIn: dateOnly(50),
      checkOut: dateOnly(53),
      type: 'Suite',
      guests: '3',
    });
    await availabilityPage.search();

    await availabilityPage.waitForSummary(
      (summary) => summary.includes('3 noches'),
      'El resumen no reflejó las fechas de la búsqueda UAT',
    );
    const rows = await availabilityPage.waitForRows(
      (current) => current.some((room) => room.number === 'E2E-301'),
      'La suite de prueba no apareció disponible para el periodo elegido',
    );

    expect(rows.find((room) => room.number === 'E2E-301')).toMatchObject({
      type: 'Suite',
      capacity: '3 personas',
      totalNights: '3 noches',
    });
  });

  test('la pantalla de reservación permite consultar y seleccionar una habitación', async () => {
    await dashboard.navigate('Nueva reservación');
    await reservationsPage.waitForPage();
    await reservationsPage.setDates(dateOnly(80), dateOnly(81));
    await reservationsPage.searchRooms();
    await reservationsPage.waitForAvailableRooms();

    const availableRooms = await reservationsPage.availableRoomTexts();
    expect(availableRooms.some((text) => text.includes('Habitación E2E-201'))).toBe(true);

    await reservationsPage.selectRoom('E2E-201');
    const rate = await driver.findElement(reservationsPage.nightlyRate).getAttribute('value');
    expect(rate).toBe(String(E2E_ROOMS.find((room) => room.number === 'E2E-201').price));
  });
});
