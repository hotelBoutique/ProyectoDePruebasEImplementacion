import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AvailabilityPage from '../../src/pages/AvailabilityPage.jsx';

jest.mock('../../src/services/api.js', () => ({
  getAvailableRooms: jest.fn(),
}));

import { getAvailableRooms } from '../../src/services/api.js';

describe('AvailabilityPage', () => {
  test('consulta disponibilidad y presenta resultados', async () => {
    getAvailableRooms.mockResolvedValue({
      data: { rooms: [{ _id: 'r1', number: '201', type: 'Suite', capacity: 3, price: 320000, description: 'Con balcón' }] },
    });
    const user = userEvent.setup();

    render(<AvailabilityPage token="test-token" />);

    await user.click(screen.getByRole('button', { name: 'Consultar disponibilidad' }));

    expect(await screen.findByText('201')).toBeInTheDocument();
    expect(screen.getAllByText('Suite').length).toBeGreaterThan(0);
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
