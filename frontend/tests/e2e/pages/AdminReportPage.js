import { By } from 'selenium-webdriver';
import { BasePage } from './BasePage.js';

// Reportes del administrador. Las tres páginas comparten estructura y solo cambia el prefijo de los IDs:
// "occupancy" (ocupación), "income" (ingresos y consumos) y "sales" (ventas de productos).
export class AdminReportPage extends BasePage {
  constructor(driver, prefix) {
    super(driver);
    this.title = By.id(`${prefix}-report-title`);
    this.startDate = By.id(`${prefix}-start-date`);
    this.endDate = By.id(`${prefix}-end-date`);
    this.submitButton = By.css('form.occupancy-report-filter button[type="submit"]');
    this.range = By.css('.occupancy-report-range');
    this.metricsLocator = By.css('.occupancy-report-summary .occupancy-report-metric');
  }

  async waitForPage(timeout = 30000) {
    await this.visible(this.title, timeout);
  }

  async setRange(start, end) {
    await this.setValue(this.startDate, start);
    await this.setValue(this.endDate, end);
  }

  async generate() {
    await this.click(this.submitButton);
  }

  async hasReport() {
    return (await this.driver.findElements(this.range)).length > 0;
  }

  // Espera el encabezado del periodo generado ("Periodo del … al …").
  async waitForReport(expectedStart, timeout = 30000) {
    return this.waitFor(
      () => this.text(this.range, 5000),
      (text) => text.replace(/\s/g, ' ').startsWith(expectedStart),
      'El reporte no se generó para el periodo solicitado',
      timeout,
    );
  }

  // Tarjetas del resumen como { ETIQUETA: valor }. La etiqueta se lee del HTML (textContent).
  async metrics() {
    const cards = await this.driver.findElements(this.metricsLocator);
    const entries = await Promise.all(cards.map(async (card) => [
      (await card.findElement(By.css('.card-kicker')).getAttribute('textContent')).trim(),
      (await card.findElement(By.css('strong')).getText()).trim(),
    ]));
    return Object.fromEntries(entries);
  }

  // Filas de la tabla de una sección (por su aria-label) como objetos { columna: texto }.
  async tableRows(sectionLabel) {
    const rows = await this.driver.findElements(By.css(`section[aria-label="${sectionLabel}"] tbody tr`));
    return Promise.all(rows.map(async (row) => {
      const cells = await row.findElements(By.css('td'));
      const entries = await Promise.all(cells.map(async (cell) => [
        await cell.getAttribute('data-label'),
        (await cell.getText()).trim(),
      ]));
      return Object.fromEntries(entries);
    }));
  }

  async endDateValidity() {
    const element = await this.visible(this.endDate);
    return this.driver.executeScript(
      'const v = arguments[0].validity; return { valid: v.valid, rangeUnderflow: v.rangeUnderflow };',
      element,
    );
  }
}
