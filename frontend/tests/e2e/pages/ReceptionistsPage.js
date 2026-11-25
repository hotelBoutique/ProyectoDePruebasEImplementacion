import { By, until } from 'selenium-webdriver';
import { BasePage } from './BasePage.js';

// Gestión de usuarios del administrador: crear, editar y activar/desactivar recepcionistas.
export class ReceptionistsPage extends BasePage {
  constructor(driver) {
    super(driver);
    this.title = By.id('receptionists-title');
    this.loading = By.xpath("//*[@role='status']//p[normalize-space()='Cargando cuentas…']");
    this.create = {
      name: By.id('receptionist-name'),
      email: By.id('receptionist-email'),
      password: By.id('receptionist-password'),
    };
    this.edit = {
      name: By.id('edit-receptionist-name'),
      isActive: By.id('edit-receptionist-status'),
    };
    this.formSubmit = By.css('form.receptionist-form-card button[type="submit"]');
  }

  async titleText() {
    return this.text(this.title);
  }

  async waitForTitle(expected, timeout = 30000) {
    return this.waitFor(() => this.titleText(), (text) => text === expected, `No apareció la vista "${expected}"`, timeout);
  }

  async waitUntilLoaded(timeout = 30000) {
    await this.driver.wait(async () => (await this.driver.findElements(this.loading)).length === 0, timeout, 'El listado de cuentas no terminó de cargar');
  }

  // Esta página usa su propio contenedor de avisos.
  async feedbackNotice(tone, timeout = 30000) {
    return this.text(By.css(`.receptionists-notice.feedback-${tone}`), timeout);
  }

  // Escribe con el teclado (no por script) para que el navegador aplique sus validaciones nativas.
  async fillCreateForm({ name, email, password }) {
    await this.type(this.create.name, name);
    await this.type(this.create.email, email);
    await this.type(this.create.password, password);
  }

  async submit() {
    await this.click(this.formSubmit);
  }

  // Estado de validación nativa de un campo del formulario de creación.
  async validity(field) {
    const element = await this.visible(this.create[field]);
    return this.driver.executeScript(
      'const v = arguments[0].validity; return { valid: v.valid, valueMissing: v.valueMissing, typeMismatch: v.typeMismatch, tooShort: v.tooShort };',
      element,
    );
  }

  row(email) {
    return By.xpath(`//table[contains(concat(' ', normalize-space(@class), ' '), ' receptionist-table ')]//tbody/tr[td[@data-label='Correo'][normalize-space(.)='${email}']]`);
  }

  async rowFor(email, timeout = 30000) {
    await this.waitUntilLoaded(timeout);
    const row = await this.visible(this.row(email), timeout);
    return {
      name: (await row.findElement(By.css('td[data-label="Nombre"] strong')).getText()).trim(),
      email: (await row.findElement(By.css('td[data-label="Correo"]')).getText()).trim(),
      status: (await row.findElement(By.css('td[data-label="Estado"]')).getText()).trim(),
    };
  }

  async waitForRow(email, predicate, message, timeout = 30000) {
    return this.waitFor(() => this.rowFor(email, 5000), predicate, message, timeout);
  }

  async editUser(email) {
    const row = await this.visible(this.row(email));
    await row.findElement(By.css('button.receptionist-edit-action')).click();
    await this.visible(this.edit.name);
  }

  async setEditName(name) {
    await this.type(this.edit.name, name);
  }

  // Botón Desactivar/Activar de la fila.
  async toggleUser(email) {
    const row = await this.visible(this.row(email));
    const buttons = await row.findElements(By.css('button.receptionist-status-action'));
    const button = buttons[buttons.length - 1];
    await this.driver.wait(until.elementIsEnabled(button), 10000);
    await button.click();
  }
}
