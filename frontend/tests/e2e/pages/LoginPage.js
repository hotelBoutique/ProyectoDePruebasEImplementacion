import { By, until } from 'selenium-webdriver';
import { BasePage } from './BasePage.js';

export class LoginPage extends BasePage {
  constructor(driver) {
    super(driver);
    this.email = By.id('admin-email');
    this.password = By.id('admin-password');
    this.submit = By.css('.auth-submit');
    this.feedback = By.css('.auth-feedback');
  }

  async open(url) {
    await super.open(url);
    await this.visible(this.email);
  }

  async login(email, password) {
    await this.type(this.email, email);
    await this.type(this.password, password);
    await this.click(this.submit);
  }

  async waitForFeedback(timeout = 10000) {
    await this.driver.wait(until.elementLocated(this.feedback), timeout);
    return this.text(this.feedback, timeout);
  }
}
