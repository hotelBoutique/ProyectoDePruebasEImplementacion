import { By } from 'selenium-webdriver';
import { BasePage } from './BasePage.js';

export class AvailabilityPage extends BasePage {
  constructor(driver) {
    super(driver);
    this.title = By.id('availability-title');
    this.checkIn = By.id('availability-check-in');
    this.checkOut = By.id('availability-check-out');
    this.type = By.id('availability-type');
    this.guests = By.id('availability-guests');
    this.maxPrice = By.id('availability-max-price');
    this.submit = By.css('form.receptionist-form-card button[type="submit"]');
    this.results = By.css('[aria-labelledby="availability-results-title"]');
    this.summary = By.css('.availability-summary');
    this.rowsLocator = By.css('[aria-labelledby="availability-results-title"] tbody tr');
    this.emptyState = By.css('[aria-labelledby="availability-results-title"] .receptionist-empty-state');
    this.notice = By.css('.rooms-notice');
  }

  async waitForPage() {
    await this.visible(this.title);
  }

  async setDates(checkIn, checkOut) {
    await this.setValue(this.checkIn, checkIn);
    await this.setValue(this.checkOut, checkOut);
  }

  // Define todos los criterios de búsqueda; los opcionales vacíos significan "sin filtro".
  async setCriteria({ checkIn, checkOut, type = '', guests = '', maxPrice = '' }) {
    await this.setDates(checkIn, checkOut);
    await this.setValue(this.type, type);
    await this.setValue(this.guests, guests);
    await this.setValue(this.maxPrice, maxPrice);
  }

  async search() {
    await this.click(this.submit);
  }

  async resultText() {
    return this.text(this.results);
  }

  async waitForResults(timeout = 30000) {
    return this.visible(this.results, timeout);
  }

  // Espera a que el resumen corresponda a la búsqueda pedida (p. ej. "2 noches · …").
  async waitForSummary(predicate, message, timeout = 30000) {
    return this.waitFor(() => this.text(this.summary, 2000), predicate, message, timeout);
  }

  async rows() {
    const rows = await this.driver.findElements(this.rowsLocator);
    return Promise.all(rows.map(async (row) => {
      const cells = await row.findElements(By.css('td'));
      const [number, , capacity, price] = await Promise.all(cells.slice(0, 4).map((cell) => cell.getText()));
      const type = await cells[1].findElement(By.css('strong')).getText();
      const total = await cells[4].findElement(By.css('strong')).getText();
      const totalNights = await cells[4].findElement(By.css('.room-description')).getText();
      return { number, type, capacity, price, total, totalNights };
    }));
  }

  async waitForRows(predicate, message, timeout = 30000) {
    await this.waitForResults(timeout);
    return this.waitFor(() => this.rows(), predicate, message, timeout);
  }

  async emptyStateText() {
    return this.text(this.emptyState);
  }

  async waitForEmptyState(timeout = 30000) {
    await this.waitForResults(timeout);
    return this.waitFor(() => this.text(this.emptyState, 2000), Boolean, 'No apareció el estado vacío de disponibilidad', timeout);
  }

  async noticeText(timeout = 10000) {
    return this.text(this.notice, timeout);
  }

  async hasResults() {
    return (await this.driver.findElements(this.results)).length > 0;
  }
}
