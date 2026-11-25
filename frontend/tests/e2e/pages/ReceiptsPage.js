import { By } from 'selenium-webdriver';
import { BasePage } from './BasePage.js';

// Página "Comprobantes de pago": búsqueda de los pagos emitidos al hacer check-out.
export class ReceiptsPage extends BasePage {
  constructor(driver) {
    super(driver);
    this.title = By.id('receipts-title');
    this.search = By.id('receipts-search');
    this.searchButton = By.css('form[aria-label="Buscar comprobantes"] button[type="submit"]');
    this.loading = By.xpath("//*[@role='status' and normalize-space()='Buscando comprobantes…']");
    this.rowsLocator = By.css('.receipts-table tbody tr');
  }

  async waitForPage(timeout = 30000) {
    await this.visible(this.title, timeout);
    await this.waitUntilLoaded(timeout);
  }

  async waitUntilLoaded(timeout = 30000) {
    await this.driver.wait(async () => (await this.driver.findElements(this.loading)).length === 0, timeout, 'Los comprobantes no terminaron de cargar');
  }

  async searchFor(text) {
    await this.type(this.search, text);
    await this.click(this.searchButton);
    await this.waitUntilLoaded();
  }

  async rows() {
    const rows = await this.driver.findElements(this.rowsLocator);
    return Promise.all(rows.map(async (row) => {
      const cell = async (label) => (await row.findElement(By.css(`td[data-label="${label}"]`)).getText()).trim();
      return {
        receipt: await cell('Comprobante'),
        guest: (await row.findElement(By.css('td[data-label="Huésped"] strong')).getText()).trim(),
        room: await cell('Habitación'),
        method: await cell('Método'),
        amount: await cell('Valor'),
      };
    }));
  }

  async waitForRows(predicate, message, timeout = 30000) {
    return this.waitFor(() => this.rows(), predicate, message, timeout);
  }
}
