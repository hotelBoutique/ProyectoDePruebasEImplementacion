// HB-46 · Automatización E2E del flujo completo de recepción con Selenium WebDriver y Page Object Model:
// reservación → check-in → consumo → pago y check-out → comprobante, contra el frontend conectado a la API de QA.
//
// Antes de abrir el navegador se prepara por API una habitación propia (E2E-R01, tarifa $888.100) y un
// producto de prueba, y se cierra cualquier estancia que haya quedado abierta en una corrida anterior.
// El huésped lleva un identificador único por corrida para encontrar su reserva entre las demás de QA.
// Los pasos dependen del anterior: si uno falla, los siguientes lo indican en lugar de fallar por otra causa.
import { createBrowser } from './pages/BasePage.js';
import { LoginPage } from './pages/LoginPage.js';
import { DashboardPage } from './pages/DashboardPage.js';
import { ReservationsPage } from './pages/ReservationsPage.js';
import { CheckInPage } from './pages/CheckInPage.js';
import { ConsumptionPage } from './pages/ConsumptionPage.js';
import { CheckOutPage } from './pages/CheckOutPage.js';
import { ReceiptsPage } from './pages/ReceiptsPage.js';
import { RoomsPage } from './pages/RoomsPage.js';
import {
  RECEPTION_PRICE_RANGE,
  RECEPTION_PRODUCT,
  RECEPTION_ROOM,
  apiLogin,
  apiLogout,
  dateOnly,
  prepareReceptionFlow,
  receptionGuest,
  releaseReceptionRoom,
} from './support/qaData.js';

const { TEST_APP_URL, TEST_RECEPTION_EMAIL, TEST_RECEPTION_PASSWORD } = process.env;

const QUANTITY = 2;
const CONSUMPTION_TOTAL = RECEPTION_PRODUCT.price * QUANTITY;
const STAY_TOTAL = RECEPTION_ROOM.price + CONSUMPTION_TOTAL;
const ROOM_LABEL = `${RECEPTION_ROOM.number} · ${RECEPTION_ROOM.type}`;
const TODAY = dateOnly(0);
const TOMORROW = dateOnly(1);

// Mismos formatos que usan las páginas: sin decimales en reservas y comprobantes; hasta 2 en consumos y check-out.
const normalize = (text) => String(text).replace(/\s/g, ' ');
const currency = (maximumFractionDigits) => (value) => normalize(new Intl.NumberFormat('es-CO', {
  style: 'currency', currency: 'COP', maximumFractionDigits,
}).format(value));
const cop = currency(0);
const copCents = currency(2);
const mediumDate = (value) => normalize(new Intl.DateTimeFormat('es-CO', {
  dateStyle: 'medium', timeZone: 'UTC',
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
let token;
let room;
let product;
let dashboard;
const guest = receptionGuest();
const completed = {};

function requireStep(step) {
  if (!completed[step]) throw new Error(`Se omite: no se completó el paso previo "${step}".`);
}

beforeAll(async () => {
  token = await apiLogin(TEST_RECEPTION_EMAIL, TEST_RECEPTION_PASSWORD);
  ({ room, product } = await prepareReceptionFlow(token));

  driver = await createBrowser();
  dashboard = new DashboardPage(driver);
  await new LoginPage(driver).openWithSession(TEST_APP_URL, token);
  await dashboard.waitForDashboard();
  expect(await dashboard.role()).toBe('ROL: RECEPCIONISTA');
});

afterAll(async () => {
  if (driver) await driver.quit();
  if (token) {
    // Si el flujo se interrumpió, no deja la habitación de prueba ocupada ni reservada.
    if (room) await releaseReceptionRoom(token, room).catch(() => {});
    await apiLogout(token);
  }
});

describe('1. Reservación del huésped', () => {
  const page = () => new ReservationsPage(driver);

  beforeAll(async () => {
    await dashboard.navigate('Nueva reservación');
    await page().waitForPage();
    await page().setDates(TODAY, TOMORROW);
    await page().searchRooms();
    await page().selectRoom(RECEPTION_ROOM.number);
  });

  test('al seleccionar la habitación propone su tarifa por noche', async () => {
    expect(await page().nightlyRateValue()).toBe(String(RECEPTION_ROOM.price));
  });

  test('no confirma la reservación sin los datos obligatorios del huésped', async () => {
    await page().confirm();

    const expected = 'Completa los datos obligatorios del huésped: nombre completo, correo electrónico, teléfono, identificación.';
    expect(await settledText(page(), () => page().feedbackNotice('error'), expected)).toBe(expected);
  });

  test('rechaza un correo de huésped con formato inválido', async () => {
    await page().fillGuest({ ...guest, email: 'correo-invalido' });
    await page().confirm();

    const expected = 'Ingresa un correo válido para el huésped.';
    expect(await settledText(page(), () => page().feedbackNotice('error'), expected)).toBe(expected);
  });

  test('confirma la reservación de hoy y muestra el comprobante', async () => {
    await page().fillGuest(guest);
    await page().confirm();

    expect(await page().feedbackNotice('success')).toBeTruthy();
    expect(normalizeValues(await page().receiptDetails())).toEqual({
      Huésped: guest.fullName,
      Habitación: ROOM_LABEL,
      'Check-in': TODAY,
      'Check-out': TOMORROW,
      Noches: '1',
      'Tarifa por noche': cop(RECEPTION_ROOM.price),
      Total: cop(RECEPTION_ROOM.price),
    });
    completed.reservation = true;
  });
});

describe('2. Check-in', () => {
  const page = () => new CheckInPage(driver);

  beforeAll(async () => {
    requireStep('reservation');
    await dashboard.navigate('Registrar check-in');
    await page().waitForPage();
  });

  test('la reservación aparece entre los ingresos programados para hoy', async () => {
    const details = normalizeValues(await page().reservationDetails(guest.fullName));

    expect(details).toMatchObject({
      contact: `${guest.identification} · ${guest.phone}`,
      status: 'Reservación confirmada',
      Habitación: ROOM_LABEL,
      'Check-in programado': mediumDate(TODAY),
      'Check-out': mediumDate(TOMORROW),
      Correo: guest.email,
    });
  });

  test('registra el ingreso y la reservación sale de la lista de pendientes', async () => {
    await page().checkIn(guest.fullName);

    expect(await page().feedbackNotice('success'))
      .toBe('El check-in se registró correctamente y la habitación ahora está ocupada');
    await page().waitUntilReservationLeaves(guest.fullName);
    completed.checkIn = true;
  });
});

describe('3. Consumo durante la estancia', () => {
  const page = () => new ConsumptionPage(driver);

  beforeAll(async () => {
    requireStep('checkIn');
    await dashboard.navigate('Registrar consumo');
    await page().waitForPage();
    await page().selectStay(guest.fullName);
  });

  test('la estancia recién iniciada no tiene consumos', async () => {
    expect(normalizeValues(await page().staySummary(guest.fullName))).toEqual({
      consumptions: '0 consumos registrados',
      total: copCents(0),
    });
  });

  test('muestra el precio unitario y el subtotal antes de registrar', async () => {
    await page().selectProduct(product._id);
    await page().setQuantity(String(QUANTITY));

    expect(normalize(await page().unitPriceText())).toBe(copCents(RECEPTION_PRODUCT.price));
    expect(normalize(await page().subtotalText())).toBe(copCents(CONSUMPTION_TOTAL));
  });

  test('valida que la cantidad sea un entero entre 1 y 1000', async () => {
    await page().setQuantity('0');
    await page().submit();

    const expected = 'La cantidad debe ser un entero entre 1 y 1000.';
    expect(await settledText(page(), () => page().feedbackNotice('error'), expected)).toBe(expected);
  });

  test('registra el consumo en la cuenta de la estancia', async () => {
    await page().selectProduct(product._id);
    await page().setQuantity(String(QUANTITY));
    await page().submit();

    expect(await page().feedbackNotice('success')).toBeTruthy();
    const history = await page().waitForHistory(
      (rows) => rows.some((row) => row.description === RECEPTION_PRODUCT.name),
      'El consumo no apareció en el historial de la estancia',
    );
    expect(history.map(normalizeValues)).toEqual([{
      description: RECEPTION_PRODUCT.name,
      detail: `${QUANTITY} × ${copCents(RECEPTION_PRODUCT.price)}`,
      subtotal: copCents(CONSUMPTION_TOTAL),
    }]);
    expect(normalizeValues(await page().staySummary(guest.fullName))).toEqual({
      consumptions: '1 consumos registrados',
      total: copCents(CONSUMPTION_TOTAL),
    });
    completed.consumption = true;
  });
});

describe('4. Pago y check-out', () => {
  const page = () => new CheckOutPage(driver);

  beforeAll(async () => {
    requireStep('consumption');
    await dashboard.navigate('Registrar pago y check-out');
    await page().waitForPage();
    await page().selectStay(guest.fullName);
  });

  test('la liquidación suma el alojamiento y los consumos registrados', async () => {
    expect(normalizeValues(await page().summaryDetails())).toEqual({
      Habitación: ROOM_LABEL,
      'Noches efectivas': '1',
      'Tarifa por noche': copCents(RECEPTION_ROOM.price),
      Alojamiento: copCents(RECEPTION_ROOM.price),
      'Consumos registrados': copCents(CONSUMPTION_TOTAL),
      'Cargos al cierre': copCents(0),
      Impuestos: 'No configurados',
    });
    expect((await page().consumptionBreakdown()).map(normalizeValues)).toEqual([{
      description: RECEPTION_PRODUCT.name,
      detail: `${QUANTITY} × ${copCents(RECEPTION_PRODUCT.price)}`,
      subtotal: copCents(CONSUMPTION_TOTAL),
    }]);
    expect(normalize(await page().totalText())).toBe(copCents(STAY_TOTAL));
  });

  test('no permite confirmar un cargo adicional sin concepto', async () => {
    await page().addCharge({ description: '', quantity: '1', unitPrice: '5000' });
    expect(normalize(await page().totalText())).toBe(copCents(STAY_TOTAL + 5000));

    await page().submit();
    const expected = 'Cada cargo debe tener un concepto de 2 a 120 caracteres y un importe válido mayor o igual a 0.';
    expect(await settledText(page(), () => page().feedbackNotice('error'), expected)).toBe(expected);

    await page().removeCharge(0);
    expect(await page().chargeCount()).toBe(0);
    expect(normalize(await page().totalText())).toBe(copCents(STAY_TOTAL));
  });

  test('confirma el pago con tarjeta, finaliza la estancia y muestra la liquidación pagada', async () => {
    await page().selectPaymentMethod('tarjeta');
    await page().submit();

    expect(await page().feedbackNotice('success')).toBeTruthy();
    const receipt = await page().waitForReceipt();
    expect(receipt.title).toBe('Salida confirmada');
    expect(normalize(receipt.subtitle)).toMatch(new RegExp(`^La habitación ${RECEPTION_ROOM.number} quedó disponible`));
    expect(normalizeValues(receipt.details)).toMatchObject({
      Huésped: guest.fullName,
      Habitación: ROOM_LABEL,
      'Noches cobradas': '1',
      'Tarifa por noche': copCents(RECEPTION_ROOM.price),
      Alojamiento: copCents(RECEPTION_ROOM.price),
      [`${RECEPTION_PRODUCT.name} · ${QUANTITY} × ${copCents(RECEPTION_PRODUCT.price)}`]: copCents(CONSUMPTION_TOTAL),
      'Subtotal de consumos registrados': copCents(CONSUMPTION_TOTAL),
      'Subtotal de cargos al cierre': copCents(0),
      'Gran total pagado · tarjeta': copCents(STAY_TOTAL),
    });

    await page().waitFor(() => page().hasStay(guest.fullName), (present) => !present, 'La estancia siguió activa después del check-out');
    completed.checkOut = true;
  });
});

describe('5. Después del check-out', () => {
  beforeAll(() => requireStep('checkOut'));

  test('el comprobante del pago aparece en Comprobantes de pago', async () => {
    const page = new ReceiptsPage(driver);
    await dashboard.navigate('Comprobantes de pago');
    await page.waitForPage();
    await page.searchFor(guest.fullName);

    const rows = await page.waitForRows((current) => current.length === 1, 'La búsqueda no devolvió el comprobante del huésped');
    expect(normalizeValues(rows[0])).toMatchObject({
      guest: guest.fullName,
      room: RECEPTION_ROOM.number,
      method: 'Tarjeta',
      amount: cop(STAY_TOTAL),
    });
    expect(rows[0].receipt).toMatch(/^CP-\d+$|^Se numera al abrirlo$/);
  });

  test('la habitación vuelve a estar disponible en el inventario', async () => {
    const page = new RoomsPage(driver);
    await dashboard.navigate('Listado de habitaciones');
    await page.waitForPage();
    await page.filter({ minPrice: RECEPTION_PRICE_RANGE.min, maxPrice: RECEPTION_PRICE_RANGE.max });

    const rows = await page.waitForRows(
      (current) => current.some((row) => row.number === RECEPTION_ROOM.number),
      'El inventario no mostró la habitación del flujo de recepción',
    );
    expect(rows.find((row) => row.number === RECEPTION_ROOM.number).status).toBe('Disponible');
  });
});
