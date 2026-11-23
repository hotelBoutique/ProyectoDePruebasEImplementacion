import { By } from 'selenium-webdriver';
import { BasePage } from './BasePage.js';

export class DashboardPage extends BasePage {
  constructor(driver) {
    super(driver);
  }

  async waitForDashboard() {
    await this.visible(By.css('.dashboard-layout'));
  }

  async navigate(label) {
    await this.click(By.xpath(`//aside//*[normalize-space()='${label}']`));
  }

  async heading(title) {
    return this.text(By.xpath(`//h1[normalize-space()='${title}']`));
  }
}
