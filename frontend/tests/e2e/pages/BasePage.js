import { Builder, By, until } from 'selenium-webdriver';

export class BasePage {
  constructor(driver) {
    this.driver = driver;
  }

  async open(url) {
    await this.driver.get(url);
  }

  async visible(locator, timeout = 10000) {
    return this.driver.wait(until.elementLocated(locator), timeout);
  }

  async text(locator, timeout = 10000) {
    const element = await this.visible(locator, timeout);
    await this.driver.wait(until.elementIsVisible(element), timeout);
    return element.getText();
  }

  async click(locator, timeout = 10000) {
    const element = await this.visible(locator, timeout);
    await this.driver.wait(until.elementIsEnabled(element), timeout);
    await element.click();
  }

  async type(locator, value, timeout = 10000) {
    const element = await this.visible(locator, timeout);
    await this.driver.wait(until.elementIsVisible(element), timeout);
    await element.clear();
    await element.sendKeys(value);
  }

  // Asigna el valor de un input o select controlado por React y dispara el evento que React escucha.
  // Se usa en fechas y listas, donde escribir con el teclado depende del idioma del navegador.
  async setValue(locator, value, timeout = 10000) {
    const element = await this.visible(locator, timeout);
    await this.setElementValue(element, value);
  }

  // Igual que setValue, pero sobre un elemento ya encontrado (por ejemplo, dentro de una fila).
  async setElementValue(element, value) {
    await this.driver.executeScript(`
      const element = arguments[0];
      const prototype = element.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, arguments[1]);
      element.dispatchEvent(new Event(element.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
    `, element, String(value ?? ''));
  }

  // Espera el aviso de la página (.rooms-notice) con el tono indicado: success, error, warning o info.
  async feedbackNotice(tone, timeout = 30000) {
    return this.text(By.css(`.rooms-notice.feedback-${tone}`), timeout);
  }

  // Lee una lista de definición (<dl>) como objeto { término: valor }. Los términos se leen del HTML
  // (textContent) porque el CSS los muestra en mayúsculas; los valores, con el texto visible.
  async definitions(locator, timeout = 10000) {
    const list = await this.visible(locator, timeout);
    const terms = await list.findElements(By.css('dt'));
    const values = await list.findElements(By.css('dd'));
    const entries = await Promise.all(terms.map(async (term, index) => [
      (await term.getAttribute('textContent')).replace(/\s+/g, ' ').trim(),
      values[index] ? (await values[index].getText()).trim() : '',
    ]));
    return Object.fromEntries(entries);
  }

  // Repite la lectura hasta que cumpla la condición; útil cuando la página vuelve a consultar la API.
  async waitFor(read, predicate, message, timeout = 30000) {
    let last;
    await this.driver.wait(async () => {
      try {
        last = await read();
        return predicate(last);
      } catch {
        return false;
      }
    }, timeout, message);
    return last;
  }
}

export async function createBrowser() {
  const chrome = await import('selenium-webdriver/chrome.js');
  const options = new chrome.Options();
  if (process.env.SELENIUM_HEADLESS !== 'false') {
    options.addArguments('--headless=new', '--window-size=1440,1000');
  }
  options.addArguments('--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage');
  return new Builder().forBrowser('chrome').setChromeOptions(options).build();
}
