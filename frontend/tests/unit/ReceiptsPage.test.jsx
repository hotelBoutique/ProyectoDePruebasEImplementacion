import React from 'react';
import { render, screen } from '@testing-library/react';
import ReceiptsPage from '../../src/pages/ReceiptsPage.jsx';

jest.mock('../../src/services/api.js', () => ({ getReceipts: jest.fn() }));
jest.mock('../../src/components/PaymentReceipt.jsx', () => ({
  ReceiptDialog: () => null,
}));

import { getReceipts } from '../../src/services/api.js';

describe('ReceiptsPage', () => {
  test('presenta comprobantes devueltos por la API', async () => {
    getReceipts.mockResolvedValue({
      data: {
        payments: [{
          _id: 'r1',
          guest: { fullName: 'Ana Pérez', identification: '123456' },
          roomNumber: '101',
          settlement: { receiptNumber: 'CP-000001', paidAt: '2026-11-20T15:00:00.000Z', paymentMethod: 'tarjeta', paidAmount: 450000 },
        }],
        pagination: { page: 1, totalPages: 1, total: 1 },
      },
    });

    render(<ReceiptsPage token="test-token" />);

    expect(await screen.findByText('CP-000001')).toBeInTheDocument();
    expect(screen.getByText('Ana Pérez')).toBeInTheDocument();
  });

  test('muestra el estado vacío', async () => {
    getReceipts.mockResolvedValue({
      data: { payments: [], pagination: { page: 1, totalPages: 0, total: 0 } },
    });

    render(<ReceiptsPage token="test-token" />);

    expect(await screen.findByText('Aún no hay pagos registrados')).toBeInTheDocument();
  });

  test('muestra el error de la API sin listar comprobantes', async () => {
    const error = new Error('Solicitud inválida');
    error.details = ['La fecha final debe ser igual o posterior a la fecha inicial'];
    getReceipts.mockRejectedValue(error);

    render(<ReceiptsPage token="test-token" />);

    expect(await screen.findByText('No fue posible consultar los comprobantes')).toBeInTheDocument();
    expect(screen.getByText('La fecha final debe ser igual o posterior a la fecha inicial')).toBeInTheDocument();
    expect(screen.queryByText('Aún no hay pagos registrados')).not.toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  test('usa un mensaje claro si la falla no trae detalle', async () => {
    getReceipts.mockRejectedValue(new Error(''));

    render(<ReceiptsPage token="test-token" />);

    expect(await screen.findByText('No fue posible consultar los comprobantes.')).toBeInTheDocument();
  });
});
