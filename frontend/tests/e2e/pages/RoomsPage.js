import { By } from 'selenium-webdriver';
import { BasePage } from './BasePage.js';

export class RoomsPage extends BasePage {
  constructor(driver) {
    super(driver);
  }

  async waitForPage() {
    await this.visible(By.id('rooms-title'));
  }

  async roomTableText() {
    return this.text(By.css('.receptionist-table'));
  }
}
