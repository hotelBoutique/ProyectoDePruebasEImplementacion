import { useEffect, useState } from 'react';
import { getReceipt } from '../services/api.js';

const PAYMENT_METHOD_LABELS = {
  efectivo: 'Efectivo',
  tarjeta: 'Tarjeta',
  transferencia: 'Transferencia',
};

function formatCurrency(value) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function formatDateTime(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('es-CO', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(value));
}

function formatDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium' }).format(new Date(value));
}

function getErrorMessage(error) {
  return Array.isArray(error.details) && error.details.length
    ? error.details.join('. ')
    : error.message || 'No fue posible generar el comprobante.';
}

export function ReceiptDocument({ receipt }) {
  return (
    <article className="payment-receipt" aria-labelledby="payment-receipt-title">
      <header className="payment-receipt-header">
        <div>
          <strong className="payment-receipt-hotel">{receipt.hotel.name}</strong>
          <span>{receipt.hotel.caption}</span>
        </div>
        <div className="payment-receipt-number">
          <span>COMPROBANTE DE PAGO</span>
          <strong id="payment-receipt-title">{receipt.receiptNumber}</strong>
          <span>{formatDateTime(receipt.issuedAt)}</span>
        </div>
      </header>

      <dl className="payment-receipt-parties">
        <div>
          <dt>Huésped</dt>
          <dd>
            <strong>{receipt.guest.fullName}</strong>
            <span>Identificación {receipt.guest.identification || '—'}</span>
            {receipt.guest.email && <span>{receipt.guest.email}</span>}
            {receipt.guest.phone && <span>{receipt.guest.phone}</span>}
          </dd>
        </div>
        <div>
          <dt>Estadía</dt>
          <dd>
            <strong>Habitación {receipt.stay.roomNumber} · {receipt.stay.roomType}</strong>
            <span>Ingreso {formatDate(receipt.stay.checkInAt)} · Salida {formatDate(receipt.stay.checkOutAt)}</span>
            <span>{receipt.stay.nights} {receipt.stay.nights === 1 ? 'noche' : 'noches'}</span>
          </dd>
        </div>
      </dl>

      <table className="payment-receipt-lines">
        <thead>
          <tr>
            <th scope="col">Concepto</th>
            <th scope="col">Cant.</th>
            <th scope="col">Valor unitario</th>
            <th scope="col">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {receipt.lines.map((line, index) => (
            <tr key={`${line.category}-${index}`}>
              <td>
                <span className="payment-receipt-category">{line.category}</span>
                {line.description}
              </td>
              <td>{line.quantity}</td>
              <td>{formatCurrency(line.unitPrice)}</td>
              <td>{formatCurrency(line.subtotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <dl className="payment-receipt-totals">
        <div><dt>Alojamiento</dt><dd>{formatCurrency(receipt.totals.accommodation)}</dd></div>
        <div><dt>Consumos</dt><dd>{formatCurrency(receipt.totals.consumptions)}</dd></div>
        <div><dt>Cargos adicionales</dt><dd>{formatCurrency(receipt.totals.additionalCharges)}</dd></div>
        <div className="payment-receipt-grand-total"><dt>Total</dt><dd>{formatCurrency(receipt.totals.total)}</dd></div>
        <div><dt>Pagado · {PAYMENT_METHOD_LABELS[receipt.paymentMethod] || receipt.paymentMethod}</dt><dd>{formatCurrency(receipt.totals.paid)}</dd></div>
        {receipt.totals.balance !== 0 && (
          <div><dt>Saldo</dt><dd>{formatCurrency(receipt.totals.balance)}</dd></div>
        )}
      </dl>

      <footer className="payment-receipt-footer">
        Comprobante de pago de la estadía. Reserva {receipt.reservationId}.
      </footer>
    </article>
  );
}

// Carga el comprobante de una estancia pagada y lo muestra listo para imprimir o guardar como PDF.
export function ReceiptDialog({ token, reservationId, onClose }) {
  const [receipt, setReceipt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isCurrent = true;
    setLoading(true);
    setError('');

    getReceipt(token, reservationId)
      .then((response) => {
        if (isCurrent) setReceipt(response.data?.receipt || null);
      })
      .catch((loadError) => {
        if (isCurrent) setError(getErrorMessage(loadError));
      })
      .finally(() => {
        if (isCurrent) setLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [token, reservationId]);

  useEffect(() => {
    function closeOnEscape(event) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  return (
    <div
      className="reservation-detail-backdrop receipt-dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className="reservation-detail-dialog receipt-dialog" role="dialog" aria-modal="true" aria-label="Comprobante de pago">
        <div className="reservation-detail-heading receipt-dialog-actions">
          <div>
            <span className="card-kicker">COMPROBANTE DE PAGO</span>
            <h2>{receipt ? receipt.receiptNumber : 'Comprobante'}</h2>
          </div>
          <div className="receipt-dialog-buttons">
            <button className="button-primary" type="button" onClick={() => window.print()} disabled={!receipt}>
              Imprimir / Guardar PDF
            </button>
            <button className="reservation-detail-close" type="button" onClick={onClose} aria-label="Cerrar comprobante">×</button>
          </div>
        </div>

        {loading ? (
          <div className="receptionist-empty-state" role="status">Generando comprobante…</div>
        ) : error ? (
          <div className="rooms-notice feedback-error" role="alert">{error}</div>
        ) : receipt && (
          <div className="receipt-print-area">
            <ReceiptDocument receipt={receipt} />
          </div>
        )}
      </section>
    </div>
  );
}
