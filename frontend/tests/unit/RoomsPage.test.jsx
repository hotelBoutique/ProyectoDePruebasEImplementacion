import React from 'react';
import { render, screen } from '@testing-library/react';
import RoomsPage from '../../src/pages/RoomsPage.jsx';

jest.mock('../../src/services/api.js', () => ({
  getRooms: jest.fn(),
  createRoom: jest.fn(),
  updateRoom: jest.fn(),
}));

import { getRooms } from '../../src/services/api.js';

describe('RoomsPage', () => {
  test('presenta habitaciones devueltas por la API', async () => {
    getRooms.mockResolvedValue({
      data: { rooms: [{ _id: 'r1', number: '101', type: 'Doble', description: 'Vista al jardín', capacity: 2, price: 180000, status: 'disponible' }] },
    });

    render(<RoomsPage token="test-token" />);

    expect(await screen.findByText('101')).toBeInTheDocument();
    expect(screen.getAllByText('Doble').length).toBeGreaterThan(0);
  });

  test('muestra el error de carga sin inventar datos', async () => {
    getRooms.mockRejectedValue(new Error('No fue posible consultar el inventario'));

    render(<RoomsPage token="test-token" />);

    expect(await screen.findByText('No fue posible consultar el inventario')).toBeInTheDocument();
  });
});
