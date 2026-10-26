const Reservation = require('../models/reservation');

describe('Reservation: metadatos de cancelación y consulta de pagos', () => {
    it('define los datos requeridos para auditar una cancelación', () => {
        const cancellationSchema = Reservation.schema.path('cancellation').schema;

        expect(cancellationSchema.path('reason').isRequired).toBe(true);
        expect(cancellationSchema.path('reason').options.minlength).toBe(3);
        expect(cancellationSchema.path('reason').options.maxlength).toBe(500);
        expect(cancellationSchema.path('canceledAt').isRequired).toBe(true);
        expect(cancellationSchema.path('canceledBy').options.ref).toBe('User');
    });

    it('incluye un índice para localizar pagos por estado y fecha', () => {
        const indexes = Reservation.schema.indexes().map(([fields]) => fields);

        expect(indexes).toContainEqual({
            status: 1,
            'settlement.status': 1,
            'settlement.paidAt': -1
        });
    });
});
