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

  test('muestra el estado vacío cuando aún no hay habitaciones', async () => {
    getRooms.mockResolvedValue({ data: { rooms: [] } });

    render(<RoomsPage token="test-token" />);

    expect(await screen.findByText('Aún no hay habitaciones')).toBeInTheDocument();
    expect(screen.getByText('Registra una habitación para comenzar a administrar el inventario.')).toBeInTheDocument();
    expect(getRooms).toHaveBeenCalledWith('test-token', expect.any(Object));
  });

  test('trata una respuesta sin lista de habitaciones como inventario vacío', async () => {
    getRooms.mockResolvedValue({ data: {} });

    render(<RoomsPage token="test-token" />);

    expect(await screen.findByText('Aún no hay habitaciones')).toBeInTheDocument();
  });

  test('muestra el error de carga sin inventar datos', async () => {
    getRooms.mockRejectedValue(new Error('No fue posible consultar el inventario'));

    render(<RoomsPage token="test-token" />);

    expect(await screen.findByText('No fue posible consultar el inventario')).toBeInTheDocument();
    expect(screen.getByText('No fue posible cargar el inventario')).toBeInTheDocument();
    expect(screen.queryByText('Aún no hay habitaciones')).not.toBeInTheDocument();
  });
});
