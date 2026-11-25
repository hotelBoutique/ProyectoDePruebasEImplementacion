import { By } from 'selenium-webdriver';
import { BasePage } from './BasePage.js';

export class ReservationsPage extends BasePage {
  constructor(driver) {
    super(driver);
    this.title = By.id('reservations-title');
    this.checkIn = By.css('.reservation-date-grid .form-field:first-child input[type="date"]');
    this.checkOut = By.css('.reservation-date-grid .form-field:nth-child(2) input[type="date"]');
    this.searchButton = By.css('.reservation-search-footer button[type="button"]');
    this.availableRoomsTitle = By.id('available-rooms-title');
    this.roomOptions = By.css('button.reservation-room-option');
    this.emptyRooms = By.css('.reservation-empty-state');
    this.guestFields = {
      fullName: By.css('input[name="fullName"]'),
      email: By.css('input[name="email"]'),
      phone: By.css('input[name="phone"]'),
      identification: By.css('input[name="identification"]'),
    };
    this.nightlyRate = By.css('input[name="nightlyRate"]');
    this.confirmButton = By.css('form.receptionist-form-card button[type="submit"]');
    this.receipt = By.css('.reservation-receipt');
    this.notice = By.css('.rooms-notice');
    this.inlineError = By.css('.reservation-inline-error');
  }

  async waitForPage() {
    await this.visible(this.title);
  }

  async setDates(checkIn, checkOut) {
    await this.setValue(this.checkIn, checkIn);
    await this.setValue(this.checkOut, checkOut);
  }

  async searchRooms() {
    await this.click(this.searchButton);
  }

  async waitForAvailableRooms(timeout = 30000) {
    return this.visible(this.availableRoomsTitle, timeout);
  }

  async availableRoomTexts() {
    const options = await this.driver.findElements(this.roomOptions);
    return Promise.all(options.map((option) => option.getText()));
  }

  async emptyRoomsText(timeout = 10000) {
    return this.text(this.emptyRooms, timeout);
  }

  async selectRoom(roomNumber) {
    await this.waitForAvailableRooms();
    const options = await this.driver.findElements(this.roomOptions);
    const option = roomNumber == null
      ? options[0]
      : await this.findRoomOption(options, roomNumber);

    if (!option) {
      const target = roomNumber == null ? 'No hay habitaciones disponibles para seleccionar' : `No se encontró la habitación ${roomNumber}`;
      throw new Error(target);
    }
    await option.click();
  }

  async findRoomOption(options, roomNumber) {
    for (const option of options) {
      const text = await option.getText();
      if (text.includes(`Habitación ${roomNumber}`)) return option;
    }
    return null;
  }

  async selectFirstRoom() {
    await this.selectRoom();
  }

  async fillGuest({ fullName, email, phone, identification }) {
    await this.type(this.guestFields.fullName, fullName);
    await this.type(this.guestFields.email, email);
    await this.type(this.guestFields.phone, phone);
    await this.type(this.guestFields.identification, identification);
  }

  async setNightlyRate(value) {
    await this.setValue(this.nightlyRate, value);
  }

  async confirm() {
    await this.click(this.confirmButton);
  }

  async confirmationText() {
    return this.text(this.receipt);
  }

  // Datos del comprobante "Reservación registrada" como { Huésped, Habitación, Check-in, ... }.
  async receiptDetails(timeout = 30000) {
    return this.definitions(this.receipt, timeout);
  }

  async nightlyRateValue() {
    const input = await this.visible(this.nightlyRate);
    return input.getAttribute('value');
  }

  async errorText(timeout = 10000) {
    return this.waitFor(async () => {
      for (const locator of [this.notice, this.inlineError]) {
        const elements = await this.driver.findElements(locator);
        if (elements.length) {
          const text = await elements[0].getText();
          if (text.trim()) return text;
        }
      }
      return '';
    }, Boolean, 'No apareció el mensaje de error de la reservación', timeout);
  }
}
