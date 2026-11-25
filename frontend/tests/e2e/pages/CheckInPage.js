import { By, until } from 'selenium-webdriver';
import { BasePage } from './BasePage.js';

// Página "Registrar check-in": lista las reservaciones que ingresan hoy.
export class CheckInPage extends BasePage {
  constructor(driver) {
    super(driver);
    this.title = By.id('check-in-title');
    this.loading = By.css('.check-in-page .module-placeholder');
    this.refreshButton = By.css('.check-in-page .rooms-heading button.button-secondary');
    this.emptyState = By.css('.check-in-page .check-in-empty-state');
  }

  card(guestName) {
    return By.xpath(`//article[contains(concat(' ', normalize-space(@class), ' '), ' check-in-card ')][.//h2[normalize-space(.)='${guestName}']]`);
  }

  async waitForPage(timeout = 30000) {
    await this.visible(this.title, timeout);
    await this.waitUntilLoaded(timeout);
  }

  async waitUntilLoaded(timeout = 30000) {
    await this.driver.wait(async () => (await this.driver.findElements(this.loading)).length === 0, timeout, 'La lista de ingresos no terminó de cargar');
  }

  async refresh() {
    await this.click(this.refreshButton);
    await this.waitUntilLoaded();
  }

  async hasReservation(guestName) {
    return (await this.driver.findElements(this.card(guestName))).length > 0;
  }

  // Espera a que aparezca la tarjeta del huésped (pulsa "Actualizar lista" si aún no está).
  async waitForReservation(guestName, timeout = 30000) {
    await this.driver.wait(async () => {
      if (await this.hasReservation(guestName)) return true;
      await this.refresh();
      return this.hasReservation(guestName);
    }, timeout, `No apareció la reservación de ${guestName} entre los ingresos de hoy`);
    return this.driver.findElement(this.card(guestName));
  }

  async reservationDetails(guestName) {
    const card = await this.waitForReservation(guestName);
    return {
      contact: (await card.findElement(By.css('.check-in-card-heading p:not(.eyebrow)')).getText()).trim(),
      status: (await card.findElement(By.css('.status-badge')).getText()).trim(),
      ...(await this.definitions(this.card(guestName))),
    };
  }

  async checkIn(guestName) {
    const card = await this.waitForReservation(guestName);
    const button = await card.findElement(By.css('.check-in-card-footer button.button-primary'));
    await this.driver.wait(until.elementIsEnabled(button), 10000);
    await button.click();
  }

  async waitUntilReservationLeaves(guestName, timeout = 30000) {
    await this.driver.wait(async () => !(await this.hasReservation(guestName)), timeout, `La reservación de ${guestName} siguió pendiente de check-in`);
  }
}
