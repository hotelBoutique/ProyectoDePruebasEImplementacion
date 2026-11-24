import { By } from 'selenium-webdriver';
import { BasePage } from './BasePage.js';

export class DashboardPage extends BasePage {
  constructor(driver) {
    super(driver);
    this.layout = By.css('.dashboard-layout');
    this.navigation = By.css('aside[aria-label="Menú principal"] nav[aria-label]');
    this.roleBadge = By.css('.sidebar-role');
    this.greetingTitle = By.id('dashboard-title');
    this.logoutButton = By.css('aside[aria-label="Menú principal"] button.sidebar-logout');
  }

  async waitForDashboard(timeout = 30000) {
    await this.visible(this.layout, timeout);
    await this.visible(this.navigation, timeout);
  }

  async isDisplayed() {
    const layouts = await this.driver.findElements(this.layout);
    return layouts.length > 0;
  }

  async role() {
    return this.text(this.roleBadge);
  }

  async greeting(timeout = 30000) {
    return this.text(this.greetingTitle, timeout);
  }

  async logout() {
    await this.click(this.logoutButton);
  }

  async navigate(label) {
    await this.click(By.xpath(`//aside[@aria-label='Menú principal']//nav//button[contains(concat(' ', normalize-space(@class), ' '), ' sidebar-link ')][.//span[normalize-space(.)='${label}']]`));
  }

  async heading(title) {
    return this.text(By.xpath(`//div[contains(concat(' ', normalize-space(@class), ' '), ' dashboard-layout ')]//h1[normalize-space(.)='${title}']`));
  }
}
