import { By } from 'selenium-webdriver';
import { BasePage } from './BasePage.js';

export class AvailabilityPage extends BasePage {
  constructor(driver) {
    super(driver);
  }

  async waitForPage() {
    await this.visible(By.id('availability-title'));
  }

  async setDates(checkIn, checkOut) {
    await this.type(By.id('availability-check-in'), checkIn);
    await this.type(By.id('availability-check-out'), checkOut);
  }

  async search() {
    await this.click(By.css('button[type="submit"]'));
  }

  async resultText() {
    return this.text(By.css('[aria-labelledby="availability-results-title"]'));
  }
}
