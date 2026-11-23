import { By } from 'selenium-webdriver';
import { BasePage } from './BasePage.js';

export class ReservationsPage extends BasePage {
  constructor(driver) {
    super(driver);
  }

  async waitForPage() {
    await this.visible(By.id('reservations-title'));
  }

  async setDates(checkIn, checkOut) {
    await this.type(By.css('input[name="checkIn"]'), checkIn);
    await this.type(By.css('input[name="checkOut"]'), checkOut);
  }

  async searchRooms() {
    await this.click(By.xpath("//button[normalize-space()='Buscar habitaciones']"));
  }

  async selectFirstRoom() {
    await this.click(By.css('.reservation-room-option'));
  }

  async fillGuest({ fullName, email, phone, identification }) {
    await this.type(By.css('input[name="fullName"]'), fullName);
    await this.type(By.css('input[name="email"]'), email);
    await this.type(By.css('input[name="phone"]'), phone);
    await this.type(By.css('input[name="identification"]'), identification);
  }

  async confirm() {
    await this.click(By.xpath("//button[normalize-space()='Confirmar reservación']"));
  }

  async confirmationText() {
    return this.text(By.css('.reservation-receipt'));
  }
}
