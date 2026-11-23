import { Builder, until } from 'selenium-webdriver';

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
