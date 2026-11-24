export function shouldCreateReservation(value = process.env.TEST_CREATE_RESERVATION) {
  return value === 'true';
}
