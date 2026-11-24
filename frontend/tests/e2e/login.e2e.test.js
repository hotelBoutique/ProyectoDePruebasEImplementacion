// Automatización del inicio de sesión con Selenium WebDriver y Page Object Model.
// Requiere el frontend en TEST_APP_URL (npm run dev:e2e) conectado a la API de QA.
// Las credenciales se leen de frontend/.env.e2e (ver tests/e2e/e2e.env.example).
import { createBrowser } from './pages/BasePage.js';
import { LoginPage } from './pages/LoginPage.js';
import { DashboardPage } from './pages/DashboardPage.js';

const {
  TEST_APP_URL,
  TEST_API_URL,
  TEST_ADMIN_EMAIL,
  TEST_ADMIN_PASSWORD,
  TEST_ADMIN_NAME = 'Administrador',
  TEST_RECEPTION_EMAIL,
  TEST_RECEPTION_PASSWORD,
  TEST_RECEPTION_NAME = 'Recepción',
} = process.env;

const INVALID_CREDENTIALS_MESSAGE = 'Correo o contraseña incorrectos';

let driver;
let loginPage;
let dashboard;

beforeAll(async () => {
  driver = await createBrowser();
  loginPage = new LoginPage(driver);
  dashboard = new DashboardPage(driver);
});

afterAll(async () => {
  if (driver) await driver.quit();
});

beforeEach(async () => {
  await loginPage.openClean(TEST_APP_URL);
});

describe('Inicio de sesión con credenciales válidas', () => {
  test('el administrador accede a su panel y se guarda la sesión', async () => {
    await loginPage.login(TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD);

    await dashboard.waitForDashboard();
    expect(await dashboard.role()).toBe('ROL: ADMIN');
    expect(await dashboard.greeting()).toBe(`Hola, ${TEST_ADMIN_NAME}.`);
    expect(await loginPage.sessionToken()).toEqual(expect.any(String));
    expect(await loginPage.isDisplayed()).toBe(false);
  });

  test('la recepcionista accede a su panel con el rol correcto', async () => {
    await loginPage.login(TEST_RECEPTION_EMAIL, TEST_RECEPTION_PASSWORD);

    await dashboard.waitForDashboard();
    expect(await dashboard.role()).toBe('ROL: RECEPCIONISTA');
    expect(await dashboard.greeting()).toBe(`Hola, ${TEST_RECEPTION_NAME}.`);
    expect(await loginPage.sessionToken()).toEqual(expect.any(String));
  });

  test('cerrar sesión vuelve al login y el servidor revoca el token', async () => {
    await loginPage.login(TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD);
    await dashboard.waitForDashboard();
    const token = await loginPage.sessionToken();

    await dashboard.logout();

    expect(await loginPage.waitForFeedback()).toBe('Sesión cerrada correctamente.');
    expect(await loginPage.feedbackTone()).toBe('success');
    expect(await loginPage.sessionToken()).toBeNull();
    expect(await dashboard.isDisplayed()).toBe(false);

    const response = await fetch(`${TEST_API_URL}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(response.status).toBe(401);
  });
});

describe('Inicio de sesión con credenciales inválidas', () => {
  test('rechaza una contraseña incorrecta y permite reintentar con el correo escrito', async () => {
    await loginPage.login(TEST_ADMIN_EMAIL, 'Clave-Incorrecta-123');

    expect(await loginPage.waitForFeedback()).toBe(INVALID_CREDENTIALS_MESSAGE);
    expect(await loginPage.feedbackTone()).toBe('error');
    expect(await loginPage.sessionToken()).toBeNull();
    expect(await dashboard.isDisplayed()).toBe(false);

    await loginPage.waitUntilEnabled();
    expect(await driver.findElement(loginPage.email).getAttribute('value')).toBe(TEST_ADMIN_EMAIL);
  });

  test('rechaza un correo que no está registrado con el mismo mensaje', async () => {
    await loginPage.login('no.registrado@hotelboutique.test', 'Cualquier-Clave-123');

    expect(await loginPage.waitForFeedback()).toBe(INVALID_CREDENTIALS_MESSAGE);
    expect(await loginPage.feedbackTone()).toBe('error');
    expect(await loginPage.sessionToken()).toBeNull();
  });
});

describe('Validaciones del formulario antes de llamar a la API', () => {
  test('no envía el formulario con los campos vacíos', async () => {
    await loginPage.click(loginPage.submit);

    expect(await loginPage.validity('email')).toMatchObject({ valid: false, valueMissing: true });
    expect(await loginPage.validity('password')).toMatchObject({ valid: false, valueMissing: true });
    expect(await loginPage.hasFeedback()).toBe(false);
    expect(await loginPage.isDisplayed()).toBe(true);
  });

  test('no envía el formulario con un correo sin formato válido', async () => {
    await loginPage.login('correo-sin-arroba', 'Cualquier-Clave-123');

    expect(await loginPage.validity('email')).toMatchObject({ valid: false, typeMismatch: true });
    expect(await loginPage.hasFeedback()).toBe(false);
    expect(await dashboard.isDisplayed()).toBe(false);
  });
});
