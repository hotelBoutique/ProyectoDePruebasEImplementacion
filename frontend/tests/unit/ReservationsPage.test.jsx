import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ReservationsPage from '../../src/pages/ReservationsPage.jsx';

jest.mock('../../src/services/api.js', () => ({
  cancelReservation: jest.fn(),
  createReservation: jest.fn(),
  getAvailableRooms: jest.fn(),
  getReservation: jest.fn(),
  getReservations: jest.fn(),
  getRooms: jest.fn(),
  updateReservation: jest.fn(),
}));

import { getAvailableRooms, createReservation } from '../../src/services/api.js';

describe('ReservationsPage', () => {
  test('valida datos obligatorios antes de confirmar', async () => {
    getAvailableRooms.mockResolvedValue({
      data: { rooms: [{ _id: 'r1', number: '301', type: 'Doble', capacity: 2, price: 240000 }] },
    });
    const user = userEvent.setup();

    render(<ReservationsPage token="test-token" mode="create" />);
    await user.click(screen.getByRole('button', { name: 'Buscar habitaciones' }));
    await user.click(await screen.findByRole('button', { name: /Habitación 301/i }));
    await user.click(screen.getByRole('button', { name: 'Confirmar reservación' }));

    expect(await screen.findByText(/Completa los datos obligatorios del huésped/i)).toBeInTheDocument();
    expect(createReservation).not.toHaveBeenCalled();
  });

  test('presenta el resultado cuando la API confirma la reservación', async () => {
    getAvailableRooms.mockResolvedValue({
      data: { rooms: [{ _id: 'r1', number: '301', type: 'Doble', capacity: 2, price: 240000 }] },
    });
    createReservation.mockResolvedValue({
      message: 'La reservación se confirmó correctamente.',
      data: { receipt: {
        guest: { fullName: 'Prueba Usuario' }, roomNumber: '301', roomType: 'Doble',
        checkIn: '2026-11-24', checkOut: '2026-11-25', nights: 1,
        nightlyRate: 240000, totalAmount: 240000,
      } },
    });
    const user = userEvent.setup();

    render(<ReservationsPage token="test-token" mode="create" />);
    await user.click(screen.getByRole('button', { name: 'Buscar habitaciones' }));
    await user.click(await screen.findByRole('button', { name: /Habitación 301/i }));

    await user.type(screen.getByLabelText(/Nombre completo/i), 'Prueba Usuario');
    await user.type(screen.getByLabelText(/Correo electrónico/i), 'prueba@example.test');
    await user.type(screen.getByLabelText(/Teléfono/i), '3000000000');
    await user.type(screen.getByLabelText(/Identificación/i), '900000001');
    await user.click(screen.getByRole('button', { name: 'Confirmar reservación' }));

    expect(await screen.findByText('Reservación registrada')).toBeInTheDocument();
  });
});
