import { By } from 'selenium-webdriver';
import { BasePage } from './BasePage.js';

// Página "Registrar pago y check-out": liquidación, método de pago y cierre de la estancia.
export class CheckOutPage extends BasePage {
  constructor(driver) {
    super(driver);
    this.title = By.id('checkout-title');
    this.loading = By.css('.checkout-page .module-placeholder');
    this.refreshButton = By.css('.checkout-page .rooms-heading button.button-secondary');
    this.formHeading = By.css('.checkout-page form .receptionist-form-heading h2');
    this.summary = By.css('.checkout-page .checkout-summary');
    this.consumptionRows = By.css('.checkout-page .checkout-consumption-breakdown .consumption-history-row');
    this.addChargeButton = By.xpath("//section[contains(@class,'checkout-page')]//div[contains(@class,'checkout-charges-heading')]//button");
    this.chargeRows = By.css('.checkout-page .checkout-charge-row');
    this.paymentMethod = By.css('.checkout-page .checkout-payment-method select');
    this.total = By.css('.checkout-page form .checkout-total-row strong');
    this.submitButton = By.css('.checkout-page form button[type="submit"]');
    this.receipt = By.css('.checkout-page .checkout-receipt');
    this.receiptTitle = By.id('checkout-receipt-title');
    this.receiptSubtitle = By.css('.checkout-page .checkout-receipt .reservation-receipt-heading p:not(.eyebrow)');
    this.receiptDetails = By.css('.checkout-page .checkout-receipt .reservation-receipt-grid');
  }

  stayOption(guestName) {
    return By.xpath(`//section[contains(@class,'checkout-page')]//button[contains(concat(' ', normalize-space(@class), ' '), ' checkout-reservation-option ')][.//strong[normalize-space(.)='${guestName}']]`);
  }

  async waitForPage(timeout = 30000) {
    await this.visible(this.title, timeout);
    await this.waitUntilLoaded(timeout);
  }

  async waitUntilLoaded(timeout = 30000) {
    await this.driver.wait(async () => (await this.driver.findElements(this.loading)).length === 0, timeout, 'Las estancias activas no terminaron de cargar');
  }

  async hasStay(guestName) {
    return (await this.driver.findElements(this.stayOption(guestName))).length > 0;
  }

  async selectStay(guestName, timeout = 30000) {
    await this.driver.wait(async () => {
      if (await this.hasStay(guestName)) return true;
      await this.click(this.refreshButton);
      await this.waitUntilLoaded();
      return this.hasStay(guestName);
    }, timeout, `No apareció la estancia activa de ${guestName}`);
    await this.click(this.stayOption(guestName));
    await this.waitFor(
      () => this.text(this.formHeading),
      (text) => text === `Liquidación de ${guestName}`,
      `La liquidación no quedó asignada a ${guestName}`,
    );
  }

  async summaryDetails() {
    return this.definitions(this.summary);
  }

  async consumptionBreakdown() {
    const rows = await this.driver.findElements(this.consumptionRows);
    return Promise.all(rows.map(async (row) => ({
      description: (await row.findElement(By.css('span > strong')).getText()).trim(),
      detail: (await row.findElement(By.css('span > span')).getText()).trim(),
      subtotal: (await row.findElement(By.xpath('./strong')).getText()).trim(),
    })));
  }

  // Añade una fila de cargo adicional y la completa; los campos vacíos se dejan sin valor.
  async addCharge({ description = '', quantity = '1', unitPrice = '' } = {}) {
    const before = (await this.driver.findElements(this.chargeRows)).length;
    await this.click(this.addChargeButton);
    await this.driver.wait(async () => (await this.driver.findElements(this.chargeRows)).length === before + 1, 10000, 'No se añadió la fila del cargo');
    const row = (await this.driver.findElements(this.chargeRows))[before];
    await this.setElementValue(await row.findElement(By.css('input:not([type])')), description);
    await this.setElementValue(await row.findElement(By.css('input[type="number"][step="1"]')), quantity);
    await this.setElementValue(await row.findElement(By.css('input[type="number"][step="0.01"]')), unitPrice);
  }

  async chargeCount() {
    return (await this.driver.findElements(this.chargeRows)).length;
  }

  async removeCharge(index = 0) {
    const rows = await this.driver.findElements(this.chargeRows);
    await rows[index].findElement(By.css('button.checkout-remove-charge')).click();
  }

  async selectPaymentMethod(method) {
    await this.setValue(this.paymentMethod, method);
  }

  async totalText() {
    return this.text(this.total);
  }

  async submit() {
    await this.click(this.submitButton);
  }

  async waitForReceipt(timeout = 30000) {
    await this.visible(this.receipt, timeout);
    return {
      title: await this.text(this.receiptTitle),
      subtitle: await this.text(this.receiptSubtitle),
      details: await this.definitions(this.receiptDetails),
    };
  }
}
