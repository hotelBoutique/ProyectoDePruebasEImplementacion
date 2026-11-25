// HB-47 · Automatización E2E de la gestión del administrador con Selenium WebDriver y Page Object Model:
// habitaciones, productos, usuarios (recepcionistas) y reportes, contra el frontend conectado a la API de QA.
//
// Cada corrida crea desde la interfaz una habitación, un producto y una recepcionista con un identificador
// único, porque la API no permite borrarlos; al terminar quedan desactivados y con el prefijo E2E.
// Para los reportes se prepara por API una estadía pagada hoy (ingresos y ventas) y se reutilizan las
// habitaciones E2E-1xx…4xx con su reserva futura (ocupación). Ver tests/e2e/support/qaData.js.
import { createBrowser } from './pages/BasePage.js';
import { LoginPage } from './pages/LoginPage.js';
import { DashboardPage } from './pages/DashboardPage.js';
import { RoomsPage } from './pages/RoomsPage.js';
import { ProductCatalogPage } from './pages/ProductCatalogPage.js';
import { ReceptionistsPage } from './pages/ReceptionistsPage.js';
import { AdminReportPage } from './pages/AdminReportPage.js';
import {
  ADMIN_PRICE_RANGE,
  RECEPTION_PRODUCT,
  RECEPTION_ROOM,
  RESERVED_WINDOW,
  adminRecords,
  apiGet,
  apiLogin,
  apiLogout,
  completeStayByApi,
  dateOnly,
  ensureReservedWindow,
  ensureRooms,
  prepareReceptionFlow,
  receptionGuest,
} from './support/qaData.js';

const {
  TEST_APP_URL,
  TEST_ADMIN_EMAIL,
  TEST_ADMIN_PASSWORD,
  TEST_RECEPTION_EMAIL,
  TEST_RECEPTION_PASSWORD,
} = process.env;

const runId = Date.now().toString(36);
const { room, product, receptionist } = adminRecords(runId);
const reportGuest = { ...receptionGuest(runId), fullName: `Huésped E2E Reportes ${runId}` };
const TODAY = dateOnly(0);

const normalize = (text) => String(text).replace(/\s/g, ' ');
const currency = (maximumFractionDigits) => (value) => normalize(new Intl.NumberFormat('es-CO', {
  style: 'currency', currency: 'COP', maximumFractionDigits,
}).format(Number(value || 0)));
const cop = currency(0);
const copCents = currency(2);
const longDate = (value) => normalize(new Intl.DateTimeFormat('es-CO', {
  day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC',
}).format(new Date(`${value}T00:00:00.000Z`)));
const normalizeValues = (object) => Object.fromEntries(
  Object.entries(object).map(([key, value]) => [normalize(key), normalize(value)]),
);

// Espera hasta que el texto coincida; si no llega, devuelve el último leído para que Jest muestre la diferencia.
async function settledText(page, read, expected, timeout = 15000) {
  try {
    return await page.waitFor(async () => normalize(await read()), (text) => text === expected, '', timeout);
  } catch {
    return read().then(normalize).catch(() => '(sin mensaje)');
  }
}

let driver;
let adminToken;
let dashboard;
let paidStay;

beforeAll(async () => {
  adminToken = await apiLogin(TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD);

  // Datos de los reportes: inventario E2E con su reserva futura y una estadía pagada hoy.
  const receptionToken = await apiLogin(TEST_RECEPTION_EMAIL, TEST_RECEPTION_PASSWORD);
  try {
    const rooms = await ensureRooms(receptionToken);
    await ensureReservedWindow(receptionToken, rooms['E2E-301']);
    const flow = await prepareReceptionFlow(receptionToken);
    paidStay = await completeStayByApi(receptionToken, { ...flow, guest: reportGuest });
  } finally {
    await apiLogout(receptionToken);
  }

  driver = await createBrowser();
  dashboard = new DashboardPage(driver);
  await new LoginPage(driver).openWithSession(TEST_APP_URL, adminToken);
  await dashboard.waitForDashboard();
  expect(await dashboard.role()).toBe('ROL: ADMIN');
});

afterAll(async () => {
  if (driver) await driver.quit();
  if (adminToken) await apiLogout(adminToken);
});

describe('1. Gestión de habitaciones', () => {
  const page = () => new RoomsPage(driver);

  beforeAll(async () => {
    await dashboard.navigate('Registrar habitación');
    await page().waitFor(() => page().titleText(), (text) => text === 'Registrar habitación', 'No se abrió el formulario de habitación');
  });

  test('no registra una habitación sin los datos obligatorios', async () => {
    await page().submitRoomForm();

    const expected = 'Completa los siguientes datos obligatorios: número de habitación, tipo de habitación, precio.';
    expect(await settledText(page(), () => page().feedbackNotice('error'), expected)).toBe(expected);
  });

  test('valida que la capacidad sea un entero mayor o igual a 1', async () => {
    await page().fillRoomForm({ ...room, capacity: '0' });
    await page().submitRoomForm();

    const expected = 'La capacidad debe ser un número entero mayor o igual a 1.';
    expect(await settledText(page(), () => page().feedbackNotice('error'), expected)).toBe(expected);
  });

  test('registra una habitación nueva', async () => {
    await page().fillRoomForm(room);
    await page().submitRoomForm();

    expect(await page().feedbackNotice('success')).toBe('La habitación se registró correctamente.');
  });

  test('rechaza un número de habitación repetido', async () => {
    await page().fillRoomForm(room);
    await page().submitRoomForm();

    const expected = 'Ya existe una habitación con ese número';
    expect(await settledText(page(), () => page().feedbackNotice('error'), expected)).toBe(expected);
  });

  test('la habitación aparece en el inventario con sus datos', async () => {
    await dashboard.navigate('Listado de habitaciones');
    await page().waitForPage();
    await page().filter({ minPrice: ADMIN_PRICE_RANGE.min, maxPrice: ADMIN_PRICE_RANGE.max });

    expect(await page().rowFor(room.number)).toMatchObject({
      type: room.type,
      capacity: `${room.capacity} personas`,
      price: cop(room.price),
      status: 'Disponible',
    });
    expect((await page().rowFor(room.number)).typeAndDescription).toContain(room.description);
  });

  test('edita la tarifa y el estado de la habitación', async () => {
    await page().editRoom(room.number);
    expect(await page().roomFormHeading()).toBe(`Habitación ${room.number}`);

    await page().fillRoomForm({ price: '999200', status: 'mantenimiento' });
    await page().submitRoomForm();

    expect(await page().feedbackNotice('success')).toBe('La habitación se actualizó correctamente.');
    const row = await page().waitFor(
      () => page().rowFor(room.number),
      (current) => current?.status === 'Mantenimiento',
      'El listado no reflejó la edición de la habitación',
    );
    expect(row).toMatchObject({ price: cop(999200), status: 'Mantenimiento' });
  });

  test('desactiva la habitación y queda fuera de servicio', async () => {
    await page().deactivateRoom(room.number);

    expect(await page().feedbackNotice('success'))
      .toBe(`La habitación ${room.number} quedó fuera de servicio y ya no figura como disponible.`);
    const row = await page().waitFor(
      () => page().rowFor(room.number),
      (current) => current?.status === 'Fuera de servicio',
      'La habitación no quedó fuera de servicio',
    );
    expect(row.status).toBe('Fuera de servicio');
    expect(await page().canDeactivate(room.number)).toBe(false);
  });
});

describe('2. Gestión de productos', () => {
  const page = () => new ProductCatalogPage(driver);

  beforeAll(async () => {
    await dashboard.navigate('Registrar producto');
    await page().waitForTitle('Registrar producto');
  });

  test('no registra un producto sin los datos obligatorios', async () => {
    await page().submitProductForm();

    const expected = 'Completa los datos obligatorios: nombre, categoría y precio.';
    expect(await settledText(page(), () => page().feedbackNotice('error'), expected)).toBe(expected);
  });

  test('valida que las existencias no sean negativas', async () => {
    await page().fillProductForm({ ...product, stock: '-1' });
    await page().submitProductForm();

    const expected = 'Las existencias deben ser un número entero mayor o igual a 0.';
    expect(await settledText(page(), () => page().feedbackNotice('error'), expected)).toBe(expected);
  });

  test('registra un producto nuevo y limpia el formulario', async () => {
    await page().fillProductForm(product);
    await page().submitProductForm();

    expect(await page().feedbackNotice('success')).toBeTruthy();
    const nameInput = await page().visible(page().fields.name);
    expect(await nameInput.getAttribute('value')).toBe('');
  });

  test('rechaza un nombre de producto repetido', async () => {
    await page().fillProductForm(product);
    await page().submitProductForm();

    const expected = 'Ya existe un producto con ese nombre';
    expect(await settledText(page(), () => page().feedbackNotice('error'), expected)).toBe(expected);
  });

  test('el producto aparece en el catálogo con sus datos', async () => {
    await dashboard.navigate('Catálogo de productos');
    await page().waitForTitle('Catálogo de productos');
    await page().searchFor(product.name);

    const rows = await page().waitFor(() => page().rows(), (current) => current.length === 1, 'La búsqueda no devolvió solo el producto creado');
    expect(rows[0]).toMatchObject({
      name: product.name,
      category: product.category,
      price: cop(product.price),
      stock: product.stock,
      status: 'Activo',
    });
  });

  test('edita el precio y las existencias, y marca existencias bajas', async () => {
    await page().editProduct(product.name);
    await page().waitForTitle('Editar producto');
    await page().fillProductForm({ price: '10500', stock: '4' });
    await page().submitProductForm();

    await page().waitForTitle('Catálogo de productos');
    expect(await page().feedbackNotice('success')).toBe(`${product.name} se actualizó correctamente.`);
    const row = await page().waitForRow(product.name, (current) => current.stock === '4 · Bajo', 'El catálogo no reflejó la edición');
    expect(row).toMatchObject({ price: cop(10500), stock: '4 · Bajo', status: 'Activo' });
  });

  test('desactiva el producto para que recepción no lo vea', async () => {
    await page().toggleProduct(product.name);

    expect(await page().feedbackNotice('success'))
      .toBe(`${product.name} se desactivó y ya no aparece para registrar consumos.`);
    const row = await page().waitForRow(product.name, (current) => current.status === 'Inactivo', 'El producto no quedó inactivo');
    expect(row.actions).toContain('Activar');
  });
});

describe('3. Gestión de usuarios', () => {
  const page = () => new ReceptionistsPage(driver);

  beforeAll(async () => {
    await dashboard.navigate('Crear recepcionista');
    await page().waitForTitle('Crear recepcionista');
  });

  test('el navegador no envía la cuenta con un correo inválido', async () => {
    await page().fillCreateForm({ ...receptionist, email: 'correo-invalido' });
    await page().submit();

    expect(await page().validity('email')).toMatchObject({ valid: false, typeMismatch: true });
    expect(await page().titleText()).toBe('Crear recepcionista');
  });

  test('crea una recepcionista y vuelve al listado con la cuenta activa', async () => {
    await page().fillCreateForm(receptionist);
    await page().submit();

    await page().waitForTitle('Recepcionistas');
    expect(await page().rowFor(receptionist.email)).toEqual({
      name: receptionist.name,
      email: receptionist.email,
      status: 'Activa',
    });
  });

  test('rechaza un correo que ya está registrado', async () => {
    await dashboard.navigate('Crear recepcionista');
    await page().waitForTitle('Crear recepcionista');
    await page().fillCreateForm(receptionist);
    await page().submit();

    expect(await page().feedbackNotice('error')).toBe('El correo ya está registrado');
  });

  test('edita el nombre de la recepcionista', async () => {
    await dashboard.navigate('Listado de usuarios');
    await page().waitForTitle('Recepcionistas');
    await page().editUser(receptionist.email);
    await page().setEditName(`${receptionist.name} Editada`);
    await page().submit();

    expect(await page().feedbackNotice('success')).toBe('La cuenta de recepcionista se actualizó correctamente.');
    const row = await page().waitForRow(
      receptionist.email,
      (current) => current.name === `${receptionist.name} Editada`,
      'El listado no reflejó el nuevo nombre',
    );
    expect(row.status).toBe('Activa');
  });

  test('desactiva la cuenta y ya no puede iniciar sesión', async () => {
    await page().toggleUser(receptionist.email);

    expect(await page().feedbackNotice('success')).toBe('La cuenta se desactivó y sus sesiones fueron revocadas.');
    const row = await page().waitForRow(receptionist.email, (current) => current.status === 'Inactiva', 'La cuenta no quedó inactiva');
    expect(row.status).toBe('Inactiva');
    await expect(apiLogin(receptionist.email, receptionist.password)).rejects.toThrow('La cuenta está desactivada');
  });
});

describe('4. Reportes', () => {
  test('ocupación: no genera el reporte si la fecha final es anterior a la inicial', async () => {
    const page = new AdminReportPage(driver, 'occupancy');
    await dashboard.navigate('Reporte de ocupación');
    await page.waitForPage();
    await page.setRange(dateOnly(5), dateOnly(3));
    await page.generate();

    expect(await page.endDateValidity()).toMatchObject({ valid: false, rangeUnderflow: true });
    expect(await page.hasReport()).toBe(false);
  });

  test('ocupación: clasifica las habitaciones de prueba y coincide con la API', async () => {
    const page = new AdminReportPage(driver, 'occupancy');
    const day = RESERVED_WINDOW.checkIn;
    await page.setRange(day, day);
    await page.generate();
    await page.waitForReport(`Periodo del ${longDate(day)} al ${longDate(day)}`);

    const available = (await page.tableRows('Habitaciones disponibles')).map((row) => row['Habitación']);
    expect(available).toEqual(expect.arrayContaining(['E2E-101', 'E2E-201']));
    expect(available).not.toContain('E2E-301'); // reservada en esa fecha
    expect(available).not.toContain('E2E-401'); // fuera de servicio
    expect(available).not.toContain(room.number); // desactivada en esta corrida

    const api = (await apiGet(`/admin/reports/occupancy?startDate=${day}&endDate=${day}`, adminToken)).data;
    expect(await page.metrics()).toEqual({
      OCUPADAS: String(api.occupiedRooms.length),
      DISPONIBLES: String(api.availableRooms.length),
      RESERVADAS: String(api.reservedRooms.length),
      'NO DISPONIBLES': String(api.unavailableRooms.length),
    });
    expect(api.reservedRooms.map((item) => item.number)).toContain('E2E-301');
    expect(api.unavailableRooms.map((item) => item.number)).toContain('E2E-401');
  });

  test('ingresos: incluye la estadía pagada hoy con su alojamiento y consumos', async () => {
    const page = new AdminReportPage(driver, 'income');
    await dashboard.navigate('Reporte de ingresos');
    await page.waitForPage();
    await page.setRange(TODAY, TODAY);
    await page.generate();
    await page.waitForReport(`Periodo del ${longDate(TODAY)} al ${longDate(TODAY)}`);

    const rows = (await page.tableRows('Detalle de pagos')).map(normalizeValues);
    const row = rows.find((item) => item['Huésped / habitación'].startsWith(reportGuest.fullName));
    expect(row).toMatchObject({
      'Huésped / habitación': `${reportGuest.fullName} Habitación ${RECEPTION_ROOM.number} · ${RECEPTION_ROOM.type}`,
      Alojamiento: copCents(RECEPTION_ROOM.price),
      Productos: copCents(RECEPTION_PRODUCT.price * 2),
      'Otros cargos': copCents(0),
      Recaudado: copCents(paidStay.total),
    });

    const api = (await apiGet(`/admin/reports/income?startDate=${TODAY}&endDate=${TODAY}`, adminToken)).data;
    expect(normalizeValues(await page.metrics())).toEqual({
      ALOJAMIENTO: copCents(api.totals.accommodation),
      CONSUMOS: copCents(api.totals.products),
      'CARGOS ADICIONALES': copCents(api.totals.additionalCharges),
      'TOTAL RECAUDADO': copCents(api.totals.collected),
    });
  });

  test('ventas: muestra las unidades e ingresos del producto vendido hoy', async () => {
    const page = new AdminReportPage(driver, 'sales');
    await dashboard.navigate('Ventas de productos');
    await page.waitForPage();
    await page.setRange(TODAY, TODAY);
    await page.generate();
    await page.waitForReport(`Periodo del ${longDate(TODAY)} al ${longDate(TODAY)}`);

    const api = (await apiGet(`/admin/reports/sales?startDate=${TODAY}&endDate=${TODAY}`, adminToken)).data;
    const sold = api.products.find((item) => item.description === RECEPTION_PRODUCT.name);
    expect(sold.quantity).toBeGreaterThanOrEqual(2);

    const rows = (await page.tableRows('Detalle de productos vendidos')).map(normalizeValues);
    expect(rows.find((item) => item.Producto === RECEPTION_PRODUCT.name)).toEqual({
      Producto: RECEPTION_PRODUCT.name,
      'Unidades vendidas': String(sold.quantity),
      Ingresos: copCents(sold.total),
    });
    expect(normalizeValues(await page.metrics())).toEqual({
      'INGRESOS POR VENTAS': copCents(api.totals.revenue),
      'UNIDADES VENDIDAS': String(api.totals.quantity),
      'PRODUCTOS DISTINTOS': String(api.totals.productCount),
    });
  });
});
