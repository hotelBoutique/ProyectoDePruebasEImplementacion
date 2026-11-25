import { By } from 'selenium-webdriver';
import { BasePage } from './BasePage.js';

// Página "Registrar consumo": cargos del catálogo a una estancia activa.
export class ConsumptionPage extends BasePage {
  constructor(driver) {
    super(driver);
    this.title = By.id('consumption-title');
    this.loading = By.css('.consumption-page .module-placeholder');
    this.refreshButton = By.css('.consumption-page .rooms-heading button.button-secondary');
    this.formHeading = By.css('.consumption-page form .receptionist-form-heading p');
    this.product = By.css('.consumption-page form select');
    this.quantity = By.css('.consumption-page form input[type="number"]');
    this.unitPrice = By.css('.consumption-page form input[readonly]');
    this.subtotal = By.css('.consumption-page form .checkout-total-row strong');
    this.submitButton = By.css('.consumption-page form button[type="submit"]');
    this.historyRows = By.css('.consumption-page .consumption-history .consumption-history-row');
    this.historyEmpty = By.css('.consumption-page .consumption-history .reservation-empty-state');
  }

  stayOption(guestName) {
    return By.xpath(`//section[contains(@class,'consumption-page')]//button[contains(concat(' ', normalize-space(@class), ' '), ' checkout-reservation-option ')][.//strong[normalize-space(.)='${guestName}']]`);
  }

  async waitForPage(timeout = 30000) {
    await this.visible(this.title, timeout);
    await this.waitUntilLoaded(timeout);
  }

  async waitUntilLoaded(timeout = 30000) {
    await this.driver.wait(async () => (await this.driver.findElements(this.loading)).length === 0, timeout, 'Las estancias activas no terminaron de cargar');
  }

  async selectStay(guestName, timeout = 30000) {
    await this.driver.wait(async () => {
      if ((await this.driver.findElements(this.stayOption(guestName))).length) return true;
      await this.click(this.refreshButton);
      await this.waitUntilLoaded();
      return (await this.driver.findElements(this.stayOption(guestName))).length > 0;
    }, timeout, `No apareció la estancia activa de ${guestName}`);
    await this.click(this.stayOption(guestName));
    await this.waitFor(
      () => this.text(this.formHeading),
      (text) => text.startsWith(guestName),
      `El formulario de consumo no quedó asignado a ${guestName}`,
    );
  }

  // Resumen del botón de la estancia: "N consumos registrados" y el total acumulado.
  async staySummary(guestName) {
    const option = await this.visible(this.stayOption(guestName));
    const lines = await option.findElements(By.css('span > span'));
    return {
      consumptions: (await lines[lines.length - 1].getText()).trim(),
      total: (await option.findElement(By.xpath('./strong')).getText()).trim(),
    };
  }

  async selectProduct(productId) {
    await this.setValue(this.product, productId);
  }

  async setQuantity(value) {
    await this.setValue(this.quantity, value);
  }

  async unitPriceText() {
    const input = await this.visible(this.unitPrice);
    return input.getAttribute('value');
  }

  async subtotalText() {
    return this.text(this.subtotal);
  }

  async submit() {
    await this.click(this.submitButton);
  }

  async history() {
    const rows = await this.driver.findElements(this.historyRows);
    return Promise.all(rows.map(async (row) => ({
      description: (await row.findElement(By.css('span > strong')).getText()).trim(),
      detail: (await row.findElement(By.css('span > span')).getText()).trim(),
      subtotal: (await row.findElement(By.xpath('./strong')).getText()).trim(),
    })));
  }

  async waitForHistory(predicate, message, timeout = 30000) {
    return this.waitFor(() => this.history(), predicate, message, timeout);
  }
}
