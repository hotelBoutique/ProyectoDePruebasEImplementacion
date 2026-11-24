import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../../src/App.jsx';

jest.mock('../../src/services/api.js', () => ({
  login: jest.fn(),
  logoutSession: jest.fn(),
  getCurrentUser: jest.fn(),
  getAdminDashboard: jest.fn(),
  getReceptionDashboard: jest.fn(),
}));

jest.mock('../../src/components/hotel2d/HotelShowcase.jsx', () => ({
  __esModule: true,
  default: () => <div data-testid="hotel-showcase" />,
}));

jest.mock('../../src/components/DashboardHome.jsx', () => ({
  __esModule: true,
  default: () => <h1>Espacio de recepción</h1>,
}));

import { login, getReceptionDashboard } from '../../src/services/api.js';

describe('inicio de sesión', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  test('muestra campos y rechaza credenciales inválidas', async () => {
    login.mockRejectedValue(new Error('Credenciales inválidas'));
    const user = userEvent.setup();

    render(<App />);

    const email = await screen.findByLabelText('Correo electrónico');
    expect(screen.getByLabelText('Contraseña')).toBeInTheDocument();
    await user.type(email, 'persona@hotel.com');
    await user.type(screen.getByLabelText('Contraseña'), 'incorrecta');
    await user.click(screen.getByRole('button', { name: /iniciar sesión/i }));

    expect(await screen.findByText('Credenciales inválidas')).toBeInTheDocument();
  });

  test('rechaza una respuesta vacía de la API sin abrir el panel', async () => {
    login.mockResolvedValue({ data: {} });
    const user = userEvent.setup();

    render(<App />);

    await user.type(await screen.findByLabelText('Correo electrónico'), 'recepcion@hotel.com');
    await user.type(screen.getByLabelText('Contraseña'), 'clave-test');
    await user.click(screen.getByRole('button', { name: /iniciar sesión/i }));

    expect(await screen.findByText('La API no devolvió los datos necesarios para iniciar sesión.')).toBeInTheDocument();
    expect(getReceptionDashboard).not.toHaveBeenCalled();
    expect(window.sessionStorage.length).toBe(0);
  });

  test('informa cuando no hay conexión con el servidor', async () => {
    login.mockRejectedValue(new TypeError('Failed to fetch'));
    const user = userEvent.setup();

    render(<App />);

    await user.type(await screen.findByLabelText('Correo electrónico'), 'recepcion@hotel.com');
    await user.type(screen.getByLabelText('Contraseña'), 'clave-test');
    await user.click(screen.getByRole('button', { name: /iniciar sesión/i }));

    expect(await screen.findByText('No fue posible conectar con el servidor. Inténtalo de nuevo.')).toBeInTheDocument();
  });

  test('permite el acceso con credenciales válidas', async () => {
    login.mockResolvedValue({
      data: {
        token: 'test-token',
        user: { role: 'RECEPCIONISTA', name: 'Recepción Uno' },
      },
    });
    getReceptionDashboard.mockResolvedValue({
      user: { role: 'RECEPCIONISTA', name: 'Recepción Uno' },
    });
    const user = userEvent.setup();

    render(<App />);

    await user.type(await screen.findByLabelText('Correo electrónico'), 'recepcion@hotel.com');
    await user.type(screen.getByLabelText('Contraseña'), 'clave-test');
    await user.click(screen.getByRole('button', { name: /iniciar sesión/i }));

    await waitFor(() => {
      expect(screen.getAllByText('Espacio de recepción').length).toBeGreaterThan(0);
    });
    expect(login).toHaveBeenCalledWith({
      email: 'recepcion@hotel.com',
      password: 'clave-test',
    });
  });
});
