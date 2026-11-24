import { By, until } from 'selenium-webdriver';
import { BasePage } from './BasePage.js';

export const SESSION_TOKEN_KEY = 'estancia.session.token';

export class LoginPage extends BasePage {
  constructor(driver) {
    super(driver);
    this.email = By.id('admin-email');
    this.password = By.id('admin-password');
    this.submit = By.css('.auth-submit');
    this.feedback = By.css('.auth-feedback');
    this.feedbackMessage = By.css('.auth-feedback .feedback-message');
    this.heading = By.xpath("//form[contains(@class,'auth-form')]");
  }

  async open(url) {
    await super.open(url);
    await this.visible(this.email);
  }

  // Abre la app sin sesión previa: borra el token guardado y recarga.
  async openClean(url) {
    await super.open(url);
    await this.driver.executeScript('window.sessionStorage.clear();');
    await this.open(url);
  }

  async login(email, password) {
    await this.type(this.email, email);
    await this.type(this.password, password);
    await this.click(this.submit);
  }

  // Espera a que aparezca el mensaje de la app (no solo el contenedor vacío).
  async waitForFeedback(timeout = 15000) {
    return this.text(this.feedbackMessage, timeout);
  }

  async feedbackTone(timeout = 15000) {
    const element = await this.visible(this.feedbackMessage, timeout);
    const className = await element.getAttribute('class');
    return (className.match(/feedback-(error|success|warning|info)/) || [])[1];
  }

  async hasFeedback() {
    const messages = await this.driver.findElements(this.feedbackMessage);
    return messages.length > 0;
  }

  async isDisplayed() {
    const forms = await this.driver.findElements(this.heading);
    return forms.length > 0 && forms[0].isDisplayed();
  }

  async waitUntilEnabled(timeout = 15000) {
    const button = await this.visible(this.submit, timeout);
    await this.driver.wait(until.elementIsEnabled(button), timeout);
  }

  // Estado de validación nativa del navegador para un campo (required, type="email").
  async validity(field) {
    const locator = field === 'email' ? this.email : this.password;
    const element = await this.visible(locator);
    return this.driver.executeScript(
      'const v = arguments[0].validity; return { valid: v.valid, valueMissing: v.valueMissing, typeMismatch: v.typeMismatch };',
      element,
    );
  }

  async sessionToken() {
    return this.driver.executeScript(`return window.sessionStorage.getItem('${SESSION_TOKEN_KEY}');`);
  }
}
