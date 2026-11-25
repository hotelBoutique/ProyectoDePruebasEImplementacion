import { By } from 'selenium-webdriver';
import { BasePage } from './BasePage.js';

// Catálogo de productos del administrador: registrar, buscar, editar y activar/desactivar.
export class ProductCatalogPage extends BasePage {
  constructor(driver) {
    super(driver);
    this.title = By.id('catalog-title');
    this.loading = By.xpath("//*[@role='status' and normalize-space()='Cargando catálogo…']");
    this.search = By.id('catalog-search');
    this.status = By.id('catalog-status');
    this.filterButton = By.css('form[aria-label="Filtrar productos"] button[type="submit"]');
    this.rowsLocator = By.css('.catalog-table tbody tr');
    this.emptyTitle = By.css('.receptionist-list-card .receptionist-empty-state strong');
    this.formSubmit = By.css('form.receptionist-form-card button[type="submit"]');
    this.fields = {
      name: By.id('product-name'),
      category: By.id('product-category'),
      description: By.id('product-description'),
      price: By.id('product-price'),
      stock: By.id('product-stock'),
      isActive: By.id('product-status'),
    };
  }

  async titleText() {
    return this.text(this.title);
  }

  // Espera el título indicado ("Registrar producto", "Editar producto" o "Catálogo de productos").
  async waitForTitle(expected, timeout = 30000) {
    return this.waitFor(() => this.titleText(), (text) => text === expected, `No apareció la vista "${expected}"`, timeout);
  }

  async waitUntilLoaded(timeout = 30000) {
    await this.driver.wait(async () => (await this.driver.findElements(this.loading)).length === 0, timeout, 'El catálogo no terminó de cargar');
  }

  async fillProductForm(values) {
    for (const [field, locator] of Object.entries(this.fields)) {
      if (values[field] !== undefined) await this.setValue(locator, values[field]);
    }
  }

  async submitProductForm() {
    await this.click(this.formSubmit);
  }

  async searchFor(name, status = '') {
    await this.waitUntilLoaded();
    await this.setValue(this.search, name);
    await this.setValue(this.status, status);
    await this.click(this.filterButton);
    await this.waitUntilLoaded();
  }

  row(name) {
    return By.xpath(`//table[contains(concat(' ', normalize-space(@class), ' '), ' catalog-table ')]//tbody/tr[td[1]/strong[normalize-space(.)='${name}']]`);
  }

  async rows() {
    const rows = await this.driver.findElements(this.rowsLocator);
    return Promise.all(rows.map(async (row) => {
      const cells = await row.findElements(By.css('td'));
      const texts = await Promise.all(cells.map(async (cell) => (await cell.getText()).trim()));
      return {
        name: (await cells[0].findElement(By.css('strong')).getText()).trim(),
        category: texts[1],
        price: texts[2],
        stock: texts[3],
        status: texts[4],
        actions: texts[5],
      };
    }));
  }

  async rowFor(name, timeout = 30000) {
    await this.visible(this.row(name), timeout);
    return (await this.rows()).find((row) => row.name === name);
  }

  async waitForRow(name, predicate, message, timeout = 30000) {
    return this.waitFor(() => this.rowFor(name, 5000), (row) => Boolean(row) && predicate(row), message, timeout);
  }

  async editProduct(name) {
    const row = await this.visible(this.row(name));
    await row.findElement(By.css('button.receptionist-edit-action')).click();
  }

  // Botón Desactivar/Activar de la fila.
  async toggleProduct(name) {
    const row = await this.visible(this.row(name));
    const buttons = await row.findElements(By.css('button.receptionist-status-action'));
    await buttons[buttons.length - 1].click();
  }
}
