import React from 'react';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PaymentsPage from '../../src/pages/PaymentsPage.jsx';
import {
  formatBogotaDateTime,
  formatCOP,
  paymentDetailResponse,
  paymentsResponse,
  receiptFixture,
} from './fixtures/payments.js';

jest.mock('../../src/services/api.js', () => ({
  getPayments: jest.fn(),
  getPaymentDetails: jest.fn(),
  getReceipt: jest.fn(),
}));

import { getPaymentDetails, getPayments, getReceipt } from '../../src/services/api.js';

const TOKEN = 'test-token';

function getRowFor(text) {
  return screen.getByText(text).closest('tr');
}

async function renderWithPayments(response = paymentsResponse) {
  getPayments.mockResolvedValue(response);
  render(<PaymentsPage token={TOKEN} />);
  await screen.findByText('Laura Gómez Ríos');
}

async function openLauraDetail(user) {
  getPaymentDetails.mockResolvedValue(paymentDetailResponse);
  await user.click(within(getRowFor('Laura Gómez Ríos')).getByRole('button', { name: 'Ver detalle' }));
  return screen.findByRole('dialog', { name: 'Pago de Laura Gómez Ríos' });
}

describe('PaymentsPage', () => {
  test('consulta los pagos con el token y los filtros iniciales', async () => {
    await renderWithPayments();

    expect(getPayments).toHaveBeenCalledWith(TOKEN, {
      q: '',
      startDate: '',
      endDate: '',
      paymentMethod: '',
      status: '',
      page: 1,
      limit: 25,
    });
  });

  test('muestra el resumen de pagos con cantidades y total recaudado en pesos', async () => {
    await renderWithPayments();

    const summary = screen.getByRole('region', { name: 'Resumen de pagos' });
    const cards = within(summary).getAllByRole('article');

    expect(within(cards[0]).getByText('2')).toBeInTheDocument();
    expect(within(cards[1]).getByText(formatCOP(1018000))).toBeInTheDocument();
    expect(within(cards[2]).getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2 pagos')).toBeInTheDocument();
  });

  test('presenta cada pago con referencia, huésped, habitación, fecha, método, valor y estado', async () => {
    await renderWithPayments();

    const lauraRow = within(getRowFor('Laura Gómez Ríos'));
    expect(lauraRow.getByText('6b04b12aa0aeedcbd114022a')).toBeInTheDocument();
    expect(lauraRow.getByText('1023456789')).toBeInTheDocument();
    expect(lauraRow.getByText('101')).toBeInTheDocument();
    expect(lauraRow.getByText(formatBogotaDateTime('2026-11-23T21:33:40.000Z'))).toBeInTheDocument();
    expect(lauraRow.getByText('Tarjeta')).toBeInTheDocument();
    expect(lauraRow.getByText(formatCOP(218000))).toBeInTheDocument();
    expect(lauraRow.getByText('Pagado')).toBeInTheDocument();

    const carlosRow = within(getRowFor('Carlos Pérez Mejía'));
    expect(carlosRow.getByText('102')).toBeInTheDocument();
    expect(carlosRow.getByText('Efectivo')).toBeInTheDocument();
    expect(carlosRow.getByText(formatCOP(800000))).toBeInTheDocument();
  });

  test('muestra "1 pago" en singular cuando solo hay un resultado', async () => {
    await renderWithPayments({
      data: {
        payments: [paymentsResponse.data.payments[0]],
        summary: { totalPayments: 1, totalCollected: 218000, todayPayments: 1 },
        pagination: { page: 1, limit: 25, total: 1, totalPages: 1 },
      },
    });

    expect(screen.getByText('1 pago')).toBeInTheDocument();
  });

  test('aplica búsqueda, fechas y método de pago, y vuelve a la página 1', async () => {
    const user = userEvent.setup();
    await renderWithPayments();

    await user.type(screen.getByLabelText('Buscar pago'), 'Laura');
    await user.type(screen.getByLabelText('Fecha inicial'), '2026-11-01');
    await user.type(screen.getByLabelText('Fecha final'), '2026-11-30');
    await user.selectOptions(screen.getByLabelText('Método de pago'), 'tarjeta');
    await user.selectOptions(screen.getByLabelText('Estado del pago'), 'pagada');
    await user.click(screen.getByRole('button', { name: 'Aplicar filtros' }));

    await waitFor(() => expect(getPayments).toHaveBeenLastCalledWith(TOKEN, {
      q: 'Laura',
      startDate: '2026-11-01',
      endDate: '2026-11-30',
      paymentMethod: 'tarjeta',
      status: 'pagada',
      page: 1,
      limit: 25,
    }));
  });

  test('limpia los filtros y vuelve a consultar sin ellos', async () => {
    const user = userEvent.setup();
    await renderWithPayments();

    await user.type(screen.getByLabelText('Buscar pago'), 'Carlos');
    await user.click(screen.getByRole('button', { name: 'Aplicar filtros' }));
    await waitFor(() => expect(getPayments).toHaveBeenLastCalledWith(TOKEN, expect.objectContaining({ q: 'Carlos' })));

    await user.click(screen.getByRole('button', { name: 'Limpiar filtros' }));

    await waitFor(() => expect(getPayments).toHaveBeenLastCalledWith(TOKEN, expect.objectContaining({ q: '', paymentMethod: '' })));
    expect(screen.getByLabelText('Buscar pago')).toHaveValue('');
  });

  test('muestra el estado vacío cuando no hay pagos con los filtros', async () => {
    getPayments.mockResolvedValue({
      data: {
        payments: [],
        summary: { totalPayments: 0, totalCollected: 0, todayPayments: 0 },
        pagination: { page: 1, limit: 25, total: 0, totalPages: 0 },
      },
    });

    render(<PaymentsPage token={TOKEN} />);

    expect(await screen.findByText('No se encontraron pagos con los filtros seleccionados')).toBeInTheDocument();
    expect(screen.getByText('0 pagos')).toBeInTheDocument();
  });

  test('muestra el error de la API y reinicia el resumen', async () => {
    const error = new Error('Solicitud inválida');
    error.details = ['La fecha final debe ser igual o posterior a la fecha inicial'];
    getPayments.mockRejectedValue(error);

    render(<PaymentsPage token={TOKEN} />);

    expect(await screen.findByRole('alert')).toHaveTextContent('La fecha final debe ser igual o posterior a la fecha inicial');
    const summary = screen.getByRole('region', { name: 'Resumen de pagos' });
    expect(within(summary).getByText(formatCOP(0))).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  test('pagina los resultados con Anterior y Siguiente', async () => {
    const user = userEvent.setup();
    await renderWithPayments({
      data: {
        ...paymentsResponse.data,
        pagination: { page: 1, limit: 25, total: 30, totalPages: 2 },
      },
    });

    expect(screen.getByText('Página 1 de 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Siguiente' }));

    await waitFor(() => expect(getPayments).toHaveBeenLastCalledWith(TOKEN, expect.objectContaining({ page: 2 })));
  });

  test('abre el detalle del pago con la liquidación completa', async () => {
    const user = userEvent.setup();
    await renderWithPayments();

    const dialog = within(await openLauraDetail(user));
    expect(getPaymentDetails).toHaveBeenCalledWith(TOKEN, '6b04b12aa0aeedcbd114022a');

    const field = (label) => dialog.getByText(label).nextElementSibling;
    expect(field('Estado del pago')).toHaveTextContent('Pagado');
    expect(field('Método de pago')).toHaveTextContent('Tarjeta');
    expect(field('Identificación')).toHaveTextContent('1023456789');
    expect(field('Habitación')).toHaveTextContent('101');
    expect(field('Noches facturables')).toHaveTextContent('1');
    expect(field('Tarifa por noche')).toHaveTextContent(formatCOP(180000));
    expect(field('Subtotal de alojamiento')).toHaveTextContent(formatCOP(180000));
    expect(field('Total liquidado')).toHaveTextContent(formatCOP(218000));
    expect(field('Total pagado')).toHaveTextContent(formatCOP(218000));
  });

  test('desglosa los consumos y muestra que no hubo cargos al cierre', async () => {
    const user = userEvent.setup();
    await renderWithPayments();

    const dialog = within(await openLauraDetail(user));
    const consumptions = within(dialog.getByRole('region', { name: 'Consumos adicionales' }));

    expect(consumptions.getByText('Agua mineral 600 ml')).toBeInTheDocument();
    expect(consumptions.getByText(`2 × ${formatCOP(5000)}`)).toBeInTheDocument();
    expect(consumptions.getByText(formatCOP(10000))).toBeInTheDocument();
    expect(consumptions.getByText('Desayuno americano')).toBeInTheDocument();
    expect(consumptions.getByText(`1 × ${formatCOP(28000)}`)).toBeInTheDocument();
    expect(consumptions.getByText('Total de consumos').nextElementSibling).toHaveTextContent(formatCOP(38000));

    const charges = within(dialog.getByRole('region', { name: 'Cargos adicionales al cierre' }));
    expect(charges.getByText('No se añadieron cargos al cierre.')).toBeInTheDocument();
    expect(charges.getByText('Total de cargos adicionales').nextElementSibling).toHaveTextContent(formatCOP(0));
  });

  test('muestra los cargos adicionales cuando la liquidación los tiene', async () => {
    const user = userEvent.setup();
    await renderWithPayments();
    const settlement = paymentDetailResponse.data.payment.settlement;
    getPaymentDetails.mockResolvedValue({
      data: {
        payment: {
          ...paymentDetailResponse.data.payment,
          settlement: {
            ...settlement,
            consumptions: [],
            consumptionsTotal: 0,
            additionalCharges: [{ description: 'Daño en toalla', quantity: 1, unitPrice: 40000, amount: 40000 }],
            additionalChargesTotal: 40000,
            totalAmount: 220000,
            paidAmount: 220000,
          },
        },
      },
    });

    await user.click(within(getRowFor('Laura Gómez Ríos')).getByRole('button', { name: 'Ver detalle' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Pago de Laura Gómez Ríos' }));

    expect(dialog.getByText('No se registraron consumos en esta liquidación.')).toBeInTheDocument();
    const charges = within(dialog.getByRole('region', { name: 'Cargos adicionales al cierre' }));
    expect(charges.getByText('Daño en toalla')).toBeInTheDocument();
    expect(charges.getByText('Total de cargos adicionales').nextElementSibling).toHaveTextContent(formatCOP(40000));
    expect(dialog.getByText('Total pagado').nextElementSibling).toHaveTextContent(formatCOP(220000));
  });

  test('informa si no se puede cargar el detalle del pago', async () => {
    const user = userEvent.setup();
    await renderWithPayments();
    getPaymentDetails.mockRejectedValue(new Error('El pago no existe'));

    await user.click(within(getRowFor('Carlos Pérez Mejía')).getByRole('button', { name: 'Ver detalle' }));

    const dialog = await screen.findByRole('dialog', { name: 'Pago realizado' });
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('El pago no existe');
  });

  test('cierra el detalle con el botón × y con la tecla Escape', async () => {
    const user = userEvent.setup();
    await renderWithPayments();

    await openLauraDetail(user);
    await user.click(screen.getByRole('button', { name: 'Cerrar detalle del pago' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await openLauraDetail(user);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('abre el comprobante del pago desde el detalle', async () => {
    const user = userEvent.setup();
    await renderWithPayments();
    getReceipt.mockResolvedValue({ data: { receipt: { ...receiptFixture, reservationId: '6b04b12aa0aeedcbd114022a' } } });

    await openLauraDetail(user);
    await user.click(screen.getByRole('button', { name: 'Comprobante' }));

    const receiptDialog = await screen.findByRole('dialog', { name: 'Comprobante de pago' });
    expect(getReceipt).toHaveBeenCalledWith(TOKEN, '6b04b12aa0aeedcbd114022a');
    expect(await within(receiptDialog).findByRole('article')).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Pago de Laura Gómez Ríos' })).not.toBeInTheDocument();
  });
});
