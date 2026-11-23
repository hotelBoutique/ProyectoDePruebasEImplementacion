import assert from 'node:assert/strict';
import { createBrowser } from './pages/BasePage.js';
import { LoginPage } from './pages/LoginPage.js';
import { DashboardPage } from './pages/DashboardPage.js';
import { RoomsPage } from './pages/RoomsPage.js';
import { AvailabilityPage } from './pages/AvailabilityPage.js';
import { ReservationsPage } from './pages/ReservationsPage.js';

const appUrl = process.env.TEST_APP_URL || 'http://localhost:5173';
const testEmail = process.env.TEST_USER_EMAIL;
const testPassword = process.env.TEST_USER_PASSWORD;

function todayDateOnly() {
  return new Date().toISOString().slice(0, 10);
}

function nextDate(value) {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

async function main() {
  let driver;
  const approved = [];
  const notExecuted = [];

  try {
    driver = await createBrowser();

    const login = new LoginPage(driver);
    await login.open(appUrl);
    await login.login('credenciales.invalidas@example.test', 'clave-invalida');
    const invalidFeedback = await login.waitForFeedback();
    assert.match(invalidFeedback, /credencial|contraseña|sesión|iniciar|API|servidor/i);
    approved.push('Login inválido');

    if (!testEmail || !testPassword) {
      notExecuted.push('Login válido: faltan TEST_USER_EMAIL y TEST_USER_PASSWORD');
      notExecuted.push('Navegación y consulta: requiere una sesión válida');
      notExecuted.push('Creación de reserva: requiere datos aislados y una sesión válida');
      notExecuted.push('Check-in, consumo y check-out: pendiente de entorno aislado');
      console.log(JSON.stringify({ approved, notExecuted }, null, 2));
      return;
    }

    await login.open(appUrl);
    await login.login(testEmail, testPassword);

    const dashboard = new DashboardPage(driver);
    await dashboard.waitForDashboard();
    approved.push('Login válido');

    await dashboard.navigate('Listado de habitaciones');
    const rooms = new RoomsPage(driver);
    await rooms.waitForPage();
    approved.push('Navegación a habitaciones');

    await dashboard.navigate('Consultar disponibilidad');
    const availability = new AvailabilityPage(driver);
    await availability.waitForPage();
    const checkIn = todayDateOnly();
    await availability.setDates(checkIn, nextDate(checkIn));
    await availability.search();
    await availability.resultText();
    approved.push('Consulta de disponibilidad');

    await dashboard.navigate('Nueva reservación');
    const reservations = new ReservationsPage(driver);
    await reservations.waitForPage();

    if (!process.env.TEST_CREATE_RESERVATION) {
      notExecuted.push('Creación de reserva: habilitar con TEST_CREATE_RESERVATION=true y datos de prueba aislados');
    } else {
      const reservationCheckIn = process.env.TEST_RESERVATION_CHECK_IN || nextDate(todayDateOnly());
      const reservationCheckOut = process.env.TEST_RESERVATION_CHECK_OUT || nextDate(reservationCheckIn);
      await reservations.setDates(reservationCheckIn, reservationCheckOut);
      await reservations.searchRooms();
      await reservations.selectFirstRoom();
      await reservations.fillGuest({
        fullName: process.env.TEST_GUEST_NAME || 'Prueba Automatizada',
        email: process.env.TEST_GUEST_EMAIL || 'prueba.automatizada@example.test',
        phone: process.env.TEST_GUEST_PHONE || '3000000000',
        identification: process.env.TEST_GUEST_ID || '900000001',
      });
      await reservations.confirm();
      await reservations.confirmationText();
      approved.push('Creación de reserva');
    }

    notExecuted.push('Check-in, consumo y check-out: no ejecutar sin entorno aislado y datos identificados');
    console.log(JSON.stringify({ approved, notExecuted }, null, 2));
  } finally {
    if (driver) await driver.quit();
  }
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
