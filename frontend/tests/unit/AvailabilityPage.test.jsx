import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AvailabilityPage from '../../src/pages/AvailabilityPage.jsx';

jest.mock('../../src/services/api.js', () => ({
  getAvailableRooms: jest.fn(),
}));

import { getAvailableRooms } from '../../src/services/api.js';

function dateAfter(days) {
  const date = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

describe('AvailabilityPage', () => {
  test('ajusta el check-out al seleccionar un check-in posterior', () => {
    render(<AvailabilityPage token="test-token" />);

    const checkIn = screen.getByLabelText(/Check-in/);
    const checkOut = screen.getByLabelText(/Check-out/);
    const selectedCheckIn = dateAfter(10);
    const expectedCheckOut = dateAfter(11);

    fireEvent.change(checkIn, { target: { value: selectedCheckIn } });

    expect(checkIn).toHaveValue(selectedCheckIn);
    expect(checkOut).toHaveValue(expectedCheckOut);
    expect(checkOut).toHaveAttribute('min', expectedCheckOut);
    expect(getAvailableRooms).not.toHaveBeenCalled();
  });

  test('envía las fechas seleccionadas y presenta las habitaciones disponibles', async () => {
    getAvailableRooms.mockResolvedValue({
      data: { rooms: [{ _id: 'r1', number: '201', type: 'Suite', capacity: 3, price: 320000, description: 'Con balcón' }] },
    });
    const user = userEvent.setup();

    render(<AvailabilityPage token="test-token" />);

    const checkIn = dateAfter(10);
    const checkOut = dateAfter(12);
    fireEvent.change(screen.getByLabelText(/Check-in/), { target: { value: checkIn } });
    fireEvent.change(screen.getByLabelText(/Check-out/), { target: { value: checkOut } });
    fireEvent.change(screen.getByLabelText(/Tipo de habitación/), { target: { value: 'Suite' } });
    fireEvent.change(screen.getByLabelText(/Huéspedes/), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText(/Precio máximo por noche/), { target: { value: '350000' } });

    await user.click(screen.getByRole('button', { name: 'Consultar disponibilidad' }));

    const results = await screen.findByRole('region', { name: 'Habitaciones disponibles' });
    const table = within(results).getByRole('table');
    const room = within(table).getByRole('row', { name: /201.*Suite/ });

    expect(getAvailableRooms).toHaveBeenCalledWith('test-token', {
      checkIn,
      checkOut,
      type: 'Suite',
      guests: '2',
      maxPrice: '350000',
    });
    expect(within(room).getByText('Con balcón')).toBeInTheDocument();
    expect(within(room).getByText('3 personas')).toBeInTheDocument();
    expect(within(room).getByText(/320\.000/)).toBeInTheDocument();
    expect(within(room).getByText(/640\.000/)).toBeInTheDocument();
    expect(within(results).getByRole('status')).toHaveTextContent(/1 habitación · 2 noches ·/);
  });

  test('no consulta si el check-out no es posterior al check-in', async () => {
    const user = userEvent.setup();
    render(<AvailabilityPage token="test-token" />);

    const checkIn = dateAfter(10);
    fireEvent.change(screen.getByLabelText(/Check-in/), { target: { value: checkIn } });
    fireEvent.change(screen.getByLabelText(/Check-out/), { target: { value: checkIn } });
    await user.click(screen.getByRole('button', { name: 'Consultar disponibilidad' }));

    expect(screen.getByRole('status')).toHaveTextContent('El check-out debe ser posterior al check-in.');
    expect(getAvailableRooms).not.toHaveBeenCalled();
  });

  test('muestra un estado vacío cuando no existen coincidencias', async () => {
    getAvailableRooms.mockResolvedValue({ data: { rooms: [] } });
    const user = userEvent.setup();

    render(<AvailabilityPage token="test-token" />);
    await user.click(screen.getByRole('button', { name: 'Consultar disponibilidad' }));

    expect(await screen.findByText('No hay habitaciones disponibles')).toBeInTheDocument();
  });

  test('muestra el detalle del error cuando la API rechaza la consulta', async () => {
    const error = new Error('Solicitud inválida');
    error.details = ['El check-in no puede estar en el pasado'];
    getAvailableRooms.mockRejectedValue(error);
    const user = userEvent.setup();

    render(<AvailabilityPage token="test-token" />);
    await user.click(screen.getByRole('button', { name: 'Consultar disponibilidad' }));

    expect(await screen.findByText('El check-in no puede estar en el pasado')).toBeInTheDocument();
    expect(screen.queryByText('No hay habitaciones disponibles')).not.toBeInTheDocument();
  });

  test('usa un mensaje claro si la falla no trae detalle', async () => {
    getAvailableRooms.mockRejectedValue(new Error(''));
    const user = userEvent.setup();

    render(<AvailabilityPage token="test-token" />);
    await user.click(screen.getByRole('button', { name: 'Consultar disponibilidad' }));

    expect(await screen.findByText('No fue posible consultar la disponibilidad.')).toBeInTheDocument();
  });
});
