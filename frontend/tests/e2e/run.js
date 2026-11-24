import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createBrowser } from './pages/BasePage.js';
import { LoginPage } from './pages/LoginPage.js';
import { DashboardPage } from './pages/DashboardPage.js';
import { RoomsPage } from './pages/RoomsPage.js';
import { AvailabilityPage } from './pages/AvailabilityPage.js';
import { ReservationsPage } from './pages/ReservationsPage.js';
import { shouldCreateReservation } from './support/runConfig.js';

const appUrl = process.env.TEST_APP_URL || 'http://localhost:5173';
const testEmail = process.env.TEST_USER_EMAIL;
const testPassword = process.env.TEST_USER_PASSWORD;
const reportDirectory = fileURLToPath(new URL('../../reports/e2e/', import.meta.url));

function redact(value) {
  return [
    ...Object.entries(process.env)
      .filter(([name, secret]) => /PASSWORD|TOKEN|EMAIL|PHONE|IDENTIFICATION|GUEST|USER_ID/i.test(name) && secret)
      .map(([, secret]) => secret),
    testPassword,
    testEmail,
  ].filter(Boolean).reduce((message, secret) => message.split(secret).join('[redacted]'), String(value));
}

function sensitiveValues() {
  return [...new Set([
    ...Object.entries(process.env)
      .filter(([name, secret]) => /PASSWORD|TOKEN|EMAIL|PHONE|IDENTIFICATION|GUEST|USER_ID/i.test(name) && secret)
      .map(([, secret]) => secret),
    testPassword,
    testEmail,
  ].filter(Boolean))];
}

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
  let failure;
  const runId = new Date().toISOString().replace(/[:.]/g, '-');
  const report = {
    startedAt: new Date().toISOString(),
    approved: [],
    notExecuted: [],
    failures: [],
    evidence: [],
  };

  try {
    driver = await createBrowser();

    const login = new LoginPage(driver);
    await login.open(appUrl);
    await login.login('credenciales.invalidas@example.test', 'clave-invalida');
    const invalidFeedback = await login.waitForFeedback();
    assert.equal(invalidFeedback, 'Correo o contraseña incorrectos');
    assert.equal(await login.feedbackTone(), 'error');
    assert.equal(await login.sessionToken(), null);
    assert.equal(await login.isDisplayed(), true);
    report.approved.push('Login inválido');

    if (!testEmail || !testPassword) {
      report.notExecuted.push('Login válido: faltan TEST_USER_EMAIL y TEST_USER_PASSWORD');
      report.notExecuted.push('Navegación y consulta: requiere una sesión válida');
      report.notExecuted.push('Creación de reserva: requiere datos aislados y una sesión válida');
      report.notExecuted.push('Check-in, consumo y check-out: pendiente de entorno aislado');
    } else {
      await login.open(appUrl);
      await login.login(testEmail, testPassword);

      const dashboard = new DashboardPage(driver);
      await dashboard.waitForDashboard();
      report.approved.push('Login válido');

      await dashboard.navigate('Listado de habitaciones');
      const rooms = new RoomsPage(driver);
      await rooms.waitForPage();
      report.approved.push('Navegación a habitaciones');

      await dashboard.navigate('Consultar disponibilidad');
      const availability = new AvailabilityPage(driver);
      await availability.waitForPage();
      const checkIn = todayDateOnly();
      await availability.setDates(checkIn, nextDate(checkIn));
      await availability.search();
      await availability.resultText();
      report.approved.push('Consulta de disponibilidad');

      await dashboard.navigate('Nueva reservación');
      const reservations = new ReservationsPage(driver);
      await reservations.waitForPage();

      if (!shouldCreateReservation()) {
        report.notExecuted.push('Creación de reserva: habilitar con TEST_CREATE_RESERVATION=true y datos de prueba aislados');
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
        report.approved.push('Creación de reserva');
      }

      report.notExecuted.push('Check-in, consumo y check-out: no ejecutar sin entorno aislado y datos identificados');
    }
  } catch (error) {
    failure = error;
    report.failures.push({
      name: error?.name || 'Error',
      message: redact(error?.message || error),
    });

    if (driver) {
      try {
        await driver.executeScript(`
          const sensitive = arguments[0];
          document.querySelectorAll('input, textarea').forEach(field => { field.value = ''; });
          window.sessionStorage.clear();
          window.localStorage.clear();
          const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
          while (walker.nextNode()) {
            for (const value of sensitive) {
              walker.currentNode.nodeValue = walker.currentNode.nodeValue.split(value).join('[redacted]');
            }
          }
        `, sensitiveValues());
        const screenshot = await driver.takeScreenshot();
        const screenshotName = `selenium-failure-${runId}.png`;
        await mkdir(reportDirectory, { recursive: true });
        await writeFile(path.join(reportDirectory, screenshotName), Buffer.from(screenshot, 'base64'));
        report.evidence.push(screenshotName);
      } catch (evidenceError) {
        report.failures.push({
          name: 'EvidenceCaptureError',
          message: redact(evidenceError?.message || evidenceError),
        });
      }
    }
  } finally {
    if (driver) {
      try {
        await driver.quit();
      } catch (quitError) {
        failure = failure || quitError;
        report.failures.push({
          name: 'WebDriverQuitError',
          message: redact(quitError?.message || quitError),
        });
      }
    }
    report.finishedAt = new Date().toISOString();
    await mkdir(reportDirectory, { recursive: true });
    await writeFile(
      path.join(reportDirectory, `selenium-manual-${runId}.json`),
      `${JSON.stringify(report, null, 2)}\n`,
      'utf8',
    );
  }

  console.log(JSON.stringify(report, null, 2));
  if (failure) {
    console.error(`Prueba Selenium fallida: ${redact(failure?.message || failure)}`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`No se pudo completar el runner Selenium: ${redact(error?.message || error)}`);
  process.exitCode = 1;
});
