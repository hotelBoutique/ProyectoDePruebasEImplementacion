import { By } from 'selenium-webdriver';
import { BasePage } from './BasePage.js';

export class RoomsPage extends BasePage {
  constructor(driver) {
    super(driver);
    this.title = By.id('rooms-title');
    this.table = By.css('.rooms-table');
    this.rowsLocator = By.css('.rooms-table tbody tr');
    this.loading = By.xpath("//*[@role='status' and normalize-space()='Cargando habitaciones…']");
    this.emptyTitle = By.css('.receptionist-empty-state strong');
    this.summary = By.css('.rooms-filters-summary');
    this.filterErrorMessage = By.css('.rooms-filters-error');
    this.refreshButton = By.css('button.receptionist-refresh');
    this.filterButton = By.xpath("//form//button[normalize-space()='Filtrar']");
    this.clearButton = By.xpath("//form//button[normalize-space()='Limpiar']");
    this.fields = {
      status: By.id('filter-status'),
      type: By.id('filter-type'),
      minCapacity: By.id('filter-capacity'),
      minPrice: By.id('filter-min-price'),
      maxPrice: By.id('filter-max-price'),
    };
  }

  async waitForPage() {
    await this.visible(this.title);
  }

  async roomTableText() {
    return this.text(this.table);
  }

  async refresh() {
    await this.click(this.refreshButton);
  }

  // Completa los filtros indicados; los que no se pasan quedan vacíos.
  async filter({ status = '', type = '', minCapacity = '', minPrice = '', maxPrice = '' } = {}) {
    await this.setValue(this.fields.status, status);
    await this.setValue(this.fields.type, type);
    await this.setValue(this.fields.minCapacity, minCapacity);
    await this.setValue(this.fields.minPrice, minPrice);
    await this.setValue(this.fields.maxPrice, maxPrice);
    await this.click(this.filterButton);
  }

  async clearFilters() {
    const buttons = await this.driver.findElements(this.clearButton);
    if (buttons.length && await buttons[0].isEnabled()) await buttons[0].click();
  }

  async isLoading() {
    return (await this.driver.findElements(this.loading)).length > 0;
  }

  // Filas de la tabla como objetos con los textos de cada columna.
  async rows() {
    const rows = await this.driver.findElements(this.rowsLocator);
    return Promise.all(rows.map(async (row) => {
      const cells = await row.findElements(By.css('td'));
      const [number, typeCell, capacity, price, status] = await Promise.all(cells.slice(0, 5).map((cell) => cell.getText()));
      const type = await cells[1].findElement(By.css('strong')).getText();
      return { number, type, typeAndDescription: typeCell, capacity, price, status };
    }));
  }

  // Espera a que termine la carga y las filas cumplan la condición.
  async waitForRows(predicate, message, timeout = 30000) {
    return this.waitFor(async () => {
      if (await this.isLoading()) throw new Error('cargando');
      return this.rows();
    }, predicate, message, timeout);
  }

  async waitForEmptyState(timeout = 30000) {
    return this.waitFor(async () => {
      if (await this.isLoading()) throw new Error('cargando');
      return this.text(this.emptyTitle, 2000);
    }, Boolean, 'No apareció el estado vacío del listado', timeout);
  }

  async summaryText() {
    return this.text(this.summary);
  }

  async filterError() {
    return this.text(this.filterErrorMessage);
  }
}
