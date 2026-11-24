// Datos de prueba para PaymentsPage y PaymentReceipt.
// Replican la forma que devuelve el backend (reservationService y receiptService),
// con valores ficticios y cálculos coherentes entre sí.

export const formatCOP = (value) => new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 2,
}).format(Number(value) || 0).replace(/\s/g, ' ');

export const formatBogotaDateTime = (value) => new Intl.DateTimeFormat('es-CO', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'America/Bogota',
}).format(new Date(value)).replace(/\s/g, ' ');

export const formatReceiptDateTime = (value) => new Intl.DateTimeFormat('es-CO', {
  dateStyle: 'long',
  timeStyle: 'short',
}).format(new Date(value)).replace(/\s/g, ' ');

export const formatReceiptDate = (value) => new Intl.DateTimeFormat('es-CO', {
  dateStyle: 'medium',
}).format(new Date(value)).replace(/\s/g, ' ');

// Listado de pagos: lo que devuelve GET /reservations/payments
export const paymentsResponse = {
  data: {
    payments: [
      {
        _id: '6b04b12aa0aeedcbd114022a',
        guest: { fullName: 'Laura Gómez Ríos', identification: '1023456789' },
        roomNumber: '101',
        settlement: {
          paidAt: '2026-11-23T21:33:40.000Z',
          paymentMethod: 'tarjeta',
          paidAmount: 218000,
          receiptNumber: 'CP-000001',
        },
      },
      {
        _id: '6b04b12aa0aeedcbd114022b',
        guest: { fullName: 'Carlos Pérez Mejía', identification: '80123456' },
        roomNumber: '102',
        settlement: {
          paidAt: '2026-11-22T15:10:00.000Z',
          paymentMethod: 'efectivo',
          paidAmount: 800000,
          receiptNumber: 'CP-000002',
        },
      },
    ],
    summary: { totalPayments: 2, totalCollected: 1018000, todayPayments: 1 },
    pagination: { page: 1, limit: 25, total: 2, totalPages: 1 },
  },
};

// Detalle de un pago: lo que devuelve GET /reservations/payments/:id
// 1 noche x 180.000 + consumos 38.000 = 218.000
export const paymentDetailResponse = {
  data: {
    payment: {
      _id: '6b04b12aa0aeedcbd114022a',
      guest: { fullName: 'Laura Gómez Ríos', identification: '1023456789' },
      roomNumber: '101',
      checkIn: '2026-11-23T00:00:00.000Z',
      checkOut: '2026-11-24T00:00:00.000Z',
      checkInAt: '2026-11-23T21:33:31.000Z',
      checkOutAt: '2026-11-23T21:33:40.000Z',
      settlement: {
        status: 'pagada',
        paidAt: '2026-11-23T21:33:40.000Z',
        paymentMethod: 'tarjeta',
        actualNights: 1,
        nightlyRate: 180000,
        roomSubtotal: 180000,
        consumptions: [
          { description: 'Agua mineral 600 ml', quantity: 2, unitPrice: 5000, subtotal: 10000 },
          { description: 'Desayuno americano', quantity: 1, unitPrice: 28000, subtotal: 28000 },
        ],
        consumptionsTotal: 38000,
        additionalCharges: [],
        additionalChargesTotal: 0,
        totalAmount: 218000,
        paidAmount: 218000,
        receiptNumber: 'CP-000001',
      },
    },
  },
};

// Comprobante: lo que devuelve GET /reservations/:id/receipt
// 2 noches x 250.000 + consumos 50.000 + cargo 30.000 = 580.000
export const receiptFixture = {
  receiptNumber: 'CP-000003',
  issuedAt: '2026-11-25T16:00:00.000Z',
  hotel: { name: 'Hotel Boutique', caption: 'Gestión hotelera' },
  reservationId: '6b04b12aa0aeedcbd1140230',
  guest: {
    fullName: 'María Fernanda Rodríguez',
    identification: '52987654',
    email: 'maria.rodriguez@example.com',
    phone: '3009876543',
  },
  stay: {
    roomNumber: '201',
    roomType: 'Suite',
    checkInAt: '2026-11-23T17:00:00.000Z',
    checkOutAt: '2026-11-25T16:00:00.000Z',
    nights: 2,
  },
  lines: [
    { category: 'Alojamiento', description: 'Habitación 201 · Suite', quantity: 2, unitPrice: 250000, subtotal: 500000 },
    { category: 'Consumo', description: 'Desayuno americano', quantity: 1, unitPrice: 28000, subtotal: 28000 },
    { category: 'Consumo', description: 'Cerveza nacional', quantity: 2, unitPrice: 11000, subtotal: 22000 },
    { category: 'Cargo adicional', description: 'Late check-out', quantity: 1, unitPrice: 30000, subtotal: 30000 },
  ],
  totals: {
    accommodation: 500000,
    consumptions: 50000,
    additionalCharges: 30000,
    total: 580000,
    paid: 580000,
    balance: 0,
  },
  paymentMethod: 'transferencia',
};
