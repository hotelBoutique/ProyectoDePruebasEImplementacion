import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReceiptDialog, ReceiptDocument } from '../../src/components/PaymentReceipt.jsx';
import {
  formatCOP,
  formatReceiptDate,
  formatReceiptDateTime,
  receiptFixture,
} from './fixtures/payments.js';

jest.mock('../../src/services/api.js', () => ({ getReceipt: jest.fn() }));

import { getReceipt } from '../../src/services/api.js';

const TOKEN = 'test-token';

function totalRow(label) {
  return screen.getByText(label, { selector: 'dt' }).nextElementSibling;
}

describe('ReceiptDocument', () => {
  test('muestra el encabezado con el hotel, el número de comprobante y la fecha de emisión', () => {
    render(<ReceiptDocument receipt={receiptFixture} />);

    expect(screen.getByText('Hotel Boutique')).toBeInTheDocument();
    expect(screen.getByText('Gestión hotelera')).toBeInTheDocument();
    expect(screen.getByRole('article', { name: 'CP-000003' })).toBeInTheDocument();
    expect(screen.getByText(formatReceiptDateTime('2026-11-25T16:00:00.000Z'))).toBeInTheDocument();
  });

  test('presenta los datos del huésped y de la estadía', () => {
    render(<ReceiptDocument receipt={receiptFixture} />);

    expect(screen.getByText('María Fernanda Rodríguez')).toBeInTheDocument();
    expect(screen.getByText('Identificación 52987654')).toBeInTheDocument();
    expect(screen.getByText('maria.rodriguez@example.com')).toBeInTheDocument();
    expect(screen.getByText('3009876543')).toBeInTheDocument();
    expect(screen.getByText('Habitación 201 · Suite', { selector: 'strong' })).toBeInTheDocument();
    expect(screen.getByText(
      `Ingreso ${formatReceiptDate('2026-11-23T17:00:00.000Z')} · Salida ${formatReceiptDate('2026-11-25T16:00:00.000Z')}`,
    )).toBeInTheDocument();
    expect(screen.getByText('2 noches')).toBeInTheDocument();
  });

  test('lista cada concepto con categoría, cantidad, valor unitario y subtotal', () => {
    render(<ReceiptDocument receipt={receiptFixture} />);

    const rows = within(screen.getByRole('table')).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(4);

    // El formato de pesos usa un espacio no separable; se normaliza para comparar.
    const cells = (row) => within(row).getAllByRole('cell').map((cell) => cell.textContent.replace(/\s/g, ' '));
    expect(cells(rows[0])).toEqual(['AlojamientoHabitación 201 · Suite', '2', formatCOP(250000), formatCOP(500000)]);
    expect(cells(rows[1])).toEqual(['ConsumoDesayuno americano', '1', formatCOP(28000), formatCOP(28000)]);
    expect(cells(rows[2])).toEqual(['ConsumoCerveza nacional', '2', formatCOP(11000), formatCOP(22000)]);
    expect(cells(rows[3])).toEqual(['Cargo adicionalLate check-out', '1', formatCOP(30000), formatCOP(30000)]);
  });

  test('muestra los totales y el método de pago', () => {
    render(<ReceiptDocument receipt={receiptFixture} />);

    expect(totalRow('Alojamiento')).toHaveTextContent(formatCOP(500000));
    expect(totalRow('Consumos')).toHaveTextContent(formatCOP(50000));
    expect(totalRow('Cargos adicionales')).toHaveTextContent(formatCOP(30000));
    expect(totalRow('Total')).toHaveTextContent(formatCOP(580000));
    expect(totalRow('Pagado · Transferencia')).toHaveTextContent(formatCOP(580000));
  });

  test('oculta el saldo cuando el pago cubre el total', () => {
    render(<ReceiptDocument receipt={receiptFixture} />);

    expect(screen.queryByText('Saldo')).not.toBeInTheDocument();
  });

  test('muestra el saldo cuando el pago no coincide con el total', () => {
    render(<ReceiptDocument receipt={{
      ...receiptFixture,
      totals: { ...receiptFixture.totals, paid: 560000, balance: 20000 },
    }} />);

    expect(totalRow('Saldo')).toHaveTextContent(formatCOP(20000));
  });

  test('usa "noche" en singular y omite correo y teléfono vacíos', () => {
    render(<ReceiptDocument receipt={{
      ...receiptFixture,
      guest: { fullName: 'Laura Gómez Ríos', identification: '', email: '', phone: '' },
      stay: { ...receiptFixture.stay, nights: 1 },
    }} />);

    expect(screen.getByText('1 noche')).toBeInTheDocument();
    expect(screen.getByText('Identificación —')).toBeInTheDocument();
    expect(screen.queryByText('maria.rodriguez@example.com')).not.toBeInTheDocument();
    expect(screen.queryByText('3009876543')).not.toBeInTheDocument();
  });

  test('cita la reservación en el pie del comprobante', () => {
    render(<ReceiptDocument receipt={receiptFixture} />);

    expect(screen.getByText('Comprobante de pago de la estadía. Reserva 6b04b12aa0aeedcbd1140230.')).toBeInTheDocument();
  });
});

describe('ReceiptDialog', () => {
  test('muestra "Generando comprobante…" y luego el comprobante de la reservación', async () => {
    getReceipt.mockResolvedValue({ data: { receipt: receiptFixture } });

    render(<ReceiptDialog token={TOKEN} reservationId="6b04b12aa0aeedcbd1140230" onClose={jest.fn()} />);

    expect(screen.getByRole('status')).toHaveTextContent('Generando comprobante…');
    expect(screen.getByRole('button', { name: 'Imprimir / Guardar PDF' })).toBeDisabled();

    expect(await screen.findByRole('heading', { name: 'CP-000003', level: 2 })).toBeInTheDocument();
    expect(getReceipt).toHaveBeenCalledWith(TOKEN, '6b04b12aa0aeedcbd1140230');
    expect(screen.getByRole('article', { name: 'CP-000003' })).toBeInTheDocument();
  });

  test('imprime el comprobante cuando ya está cargado', async () => {
    const user = userEvent.setup();
    const printSpy = jest.spyOn(window, 'print').mockImplementation(() => {});
    getReceipt.mockResolvedValue({ data: { receipt: receiptFixture } });

    render(<ReceiptDialog token={TOKEN} reservationId="6b04b12aa0aeedcbd1140230" onClose={jest.fn()} />);
    const printButton = screen.getByRole('button', { name: 'Imprimir / Guardar PDF' });
    await screen.findByRole('article', { name: 'CP-000003' });

    expect(printButton).toBeEnabled();
    await user.click(printButton);
    expect(printSpy).toHaveBeenCalledTimes(1);

    printSpy.mockRestore();
  });

  test('muestra el error si la API no puede generar el comprobante', async () => {
    const error = new Error('Solicitud rechazada');
    error.details = ['La reservación no tiene un pago registrado'];
    getReceipt.mockRejectedValue(error);

    render(<ReceiptDialog token={TOKEN} reservationId="6b04b12aa0aeedcbd1140230" onClose={jest.fn()} />);

    expect(await screen.findByRole('alert')).toHaveTextContent('La reservación no tiene un pago registrado');
    expect(screen.getByRole('button', { name: 'Imprimir / Guardar PDF' })).toBeDisabled();
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
  });

  test('se cierra con el botón ×, con Escape y al hacer clic fuera del comprobante', async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();
    getReceipt.mockResolvedValue({ data: { receipt: receiptFixture } });

    render(<ReceiptDialog token={TOKEN} reservationId="6b04b12aa0aeedcbd1140230" onClose={onClose} />);
    await screen.findByRole('article', { name: 'CP-000003' });

    await user.click(screen.getByRole('button', { name: 'Cerrar comprobante' }));
    expect(onClose).toHaveBeenCalledTimes(1);

    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(2);

    fireEvent.mouseDown(screen.getByRole('dialog').parentElement);
    expect(onClose).toHaveBeenCalledTimes(3);

    fireEvent.mouseDown(screen.getByRole('dialog'));
    expect(onClose).toHaveBeenCalledTimes(3);
  });
});
