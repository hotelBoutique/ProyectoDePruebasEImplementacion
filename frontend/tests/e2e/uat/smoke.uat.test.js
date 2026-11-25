import { createBrowser } from '../pages/BasePage.js';
import { LoginPage } from '../pages/LoginPage.js';

const { TEST_API_URL, TEST_APP_URL } = process.env;

let driver;

beforeAll(async () => {
  driver = await createBrowser();
});

afterAll(async () => {
  if (driver) await driver.quit();
});

describe('UAT local smoke', () => {
  test('la API local responde en health', async () => {
    const response = await fetch(`${TEST_API_URL}/health`);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe('success');
  });

  test('el proxy local del frontend alcanza health de la API', async () => {
    const response = await fetch(`${TEST_APP_URL}/health`);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.message).toBe('API funcionando correctamente');
  });

  test('la interfaz presenta el formulario de inicio de sesión en Chrome', async () => {
    const login = new LoginPage(driver);
    await login.open(TEST_APP_URL);

    expect(await login.isDisplayed()).toBe(true);
    expect(await driver.findElement(login.email).isDisplayed()).toBe(true);
    expect(await driver.findElement(login.password).isDisplayed()).toBe(true);
    expect(await driver.findElement(login.submit).isDisplayed()).toBe(true);
  });
});
