import { By } from 'selenium-webdriver';
import { BasePage } from './BasePage.js';

export class DashboardPage extends BasePage {
  constructor(driver) {
    super(driver);
    this.layout = By.css('.dashboard-layout');
    this.roleBadge = By.css('.sidebar-role');
    this.greetingTitle = By.id('dashboard-title');
    this.logoutButton = By.xpath("//aside//button[contains(@class,'sidebar-logout') and normalize-space()='Cerrar sesión']");
  }

  async waitForDashboard(timeout = 30000) {
    await this.visible(this.layout, timeout);
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
    await this.click(By.xpath(`//aside//*[normalize-space()='${label}']`));
  }

  async heading(title) {
    return this.text(By.xpath(`//h1[normalize-space()='${title}']`));
  }
}
