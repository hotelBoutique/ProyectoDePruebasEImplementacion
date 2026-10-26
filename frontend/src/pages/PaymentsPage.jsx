import { useEffect, useState } from 'react';
import { ReceiptDialog } from '../components/PaymentReceipt.jsx';
import { getPaymentDetails, getPayments } from '../services/api.js';

const EMPTY_FILTERS = {
  q: '',
  startDate: '',
  endDate: '',
  paymentMethod: '',
  status: '',
};

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
  }).format(Number(value) || 0);
}

function formatCount(value) {
  return new Intl.NumberFormat('es-CO').format(Number(value) || 0);
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Bogota',
  }).format(date);
}

function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/Bogota',
  }).format(date);
}

function formatStayDateTime(timestamp, scheduledDate) {
  return timestamp ? formatDateTime(timestamp) : formatDate(scheduledDate);
}

function getErrorMessage(error) {
  return Array.isArray(error.details) && error.details.length
    ? error.details.join('. ')
    : error.message || 'No fue posible cargar los pagos realizados.';
}

function PaymentDetails({ payment, loading, error }) {
  if (loading) {
    return <div className="reservation-list-message" role="status">Cargando detalle del pago…</div>;
  }

  if (error) {
    return <div className="reservation-list-message reservation-list-error" role="alert">{error}</div>;
  }

  if (!payment) return null;

  const settlement = payment.settlement || {};
  const consumptions = settlement.consumptions || [];
  const additionalCharges = settlement.additionalCharges || [];

  return (
    <>
      <dl className="reservation-detail-grid settlement-history-detail-grid">
        <div><dt>Referencia real de pago y liquidación</dt><dd>{payment._id}</dd></div>
        <div><dt>Estado del pago</dt><dd>Pagado</dd></div>
        <div><dt>Fecha y hora</dt><dd>{formatDateTime(settlement.paidAt)}</dd></div>
        <div><dt>Método de pago</dt><dd>{PAYMENT_METHOD_LABELS[settlement.paymentMethod] || '—'}</dd></div>
        <div><dt>Huésped</dt><dd>{payment.guest?.fullName || '—'}</dd></div>
        <div><dt>Identificación</dt><dd>{payment.guest?.identification || '—'}</dd></div>
        <div><dt>Habitación</dt><dd>{payment.roomNumber || '—'}</dd></div>
        <div><dt>Reservación / estancia</dt><dd>{payment._id}</dd></div>
        <div><dt>Ingreso</dt><dd>{formatStayDateTime(payment.checkInAt, payment.checkIn)}</dd></div>
        <div><dt>Salida</dt><dd>{formatStayDateTime(payment.checkOutAt, payment.checkOut)}</dd></div>
        <div><dt>Noches facturables</dt><dd>{settlement.actualNights ?? '—'}</dd></div>
        <div><dt>Tarifa por noche</dt><dd>{formatCurrency(settlement.nightlyRate)}</dd></div>
        <div><dt>Subtotal de alojamiento</dt><dd>{formatCurrency(settlement.roomSubtotal)}</dd></div>
      </dl>

      <section className="settlement-history-breakdown" aria-labelledby="payment-consumptions-title">
        <h3 id="payment-consumptions-title">Consumos adicionales</h3>
        {consumptions.length ? (
          <div className="settlement-history-breakdown-list">
            {consumptions.map((item, index) => (
              <div className="consumption-history-row" key={`${item.description}-${index}`}>
                <span>
                  <strong>{item.description}</strong>
                  <span>{item.quantity} × {formatCurrency(item.unitPrice)}</span>
                </span>
                <strong>{formatCurrency(item.subtotal ?? item.amount)}</strong>
              </div>
            ))}
          </div>
        ) : (
          <p className="settlement-history-empty-detail">No se registraron consumos en esta liquidación.</p>
        )}
        <div className="settlement-history-subtotal">
          <span>Total de consumos</span>
          <strong>{formatCurrency(settlement.consumptionsTotal)}</strong>
        </div>
      </section>

      <section className="settlement-history-breakdown" aria-labelledby="payment-charges-title">
        <h3 id="payment-charges-title">Cargos adicionales al cierre</h3>
        {additionalCharges.length ? (
          <div className="settlement-history-breakdown-list">
            {additionalCharges.map((item, index) => (
              <div className="consumption-history-row" key={`${item.description}-${index}`}>
                <span>
                  <strong>{item.description}</strong>
                  <span>{item.quantity} × {formatCurrency(item.unitPrice)}</span>
                </span>
                <strong>{formatCurrency(item.subtotal ?? item.amount)}</strong>
              </div>
            ))}
          </div>
        ) : (
          <p className="settlement-history-empty-detail">No se añadieron cargos al cierre.</p>
        )}
        <div className="settlement-history-subtotal">
          <span>Total de cargos adicionales</span>
          <strong>{formatCurrency(settlement.additionalChargesTotal)}</strong>
        </div>
      </section>

      <dl className="settlement-history-payment">
        <div><dt>Total liquidado</dt><dd>{formatCurrency(settlement.totalAmount)}</dd></div>
        <div className="settlement-history-total"><dt>Total pagado</dt><dd>{formatCurrency(settlement.paidAmount)}</dd></div>
      </dl>
    </>
  );
}

export default function PaymentsPage({ token }) {
  const [receiptReservationId, setReceiptReservationId] = useState('');
  const [payments, setPayments] = useState([]);
  const [summary, setSummary] = useState({ totalPayments: 0, totalCollected: 0, todayPayments: 0 });
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, totalPages: 0 });
  const [draftFilters, setDraftFilters] = useState({ ...EMPTY_FILTERS });
  const [appliedFilters, setAppliedFilters] = useState({ ...EMPTY_FILTERS });
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedPaymentId, setSelectedPaymentId] = useState('');
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');

    getPayments(token, { ...appliedFilters, page, limit: 25 })
      .then((response) => {
        if (cancelled) return;
        const data = response.data || {};
        setPayments(Array.isArray(data.payments) ? data.payments : []);
        setSummary(data.summary || { totalPayments: 0, totalCollected: 0, todayPayments: 0 });
        setPagination(data.pagination || { page, limit: 25, total: 0, totalPages: 0 });
      })
      .catch((loadError) => {
        if (cancelled) return;
        setPayments([]);
        setSummary({ totalPayments: 0, totalCollected: 0, todayPayments: 0 });
        setPagination({ page: 1, limit: 25, total: 0, totalPages: 0 });
        setError(getErrorMessage(loadError));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [token, appliedFilters, page, refreshKey]);

  useEffect(() => {
    if (!selectedPaymentId) return undefined;
    let cancelled = false;
    setDetailLoading(true);
    setDetailError('');
    setSelectedPayment(null);

    getPaymentDetails(token, selectedPaymentId)
      .then((response) => {
        if (!cancelled) setSelectedPayment(response.data?.payment || null);
      })
      .catch((loadError) => {
        if (!cancelled) setDetailError(getErrorMessage(loadError));
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });

    return () => { cancelled = true; };
  }, [token, selectedPaymentId]);

  useEffect(() => {
    if (!selectedPaymentId) return undefined;
    function closeOnEscape(event) {
      if (event.key === 'Escape') setSelectedPaymentId('');
    }
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [selectedPaymentId]);

  function updateDraftFilter(name, value) {
    setDraftFilters((current) => ({ ...current, [name]: value }));
  }

  function applyFilters(event) {
    event.preventDefault();
    setAppliedFilters({ ...draftFilters });
    setPage(1);
  }

  function clearFilters() {
    setDraftFilters({ ...EMPTY_FILTERS });
    setAppliedFilters({ ...EMPTY_FILTERS });
    setPage(1);
  }

  function openDetails(paymentId) {
    setSelectedPaymentId(paymentId);
  }

  return (
    <section className="rooms-page settlements-page payments-page" aria-labelledby="payments-title">
      <div className="rooms-heading">
        <div>
          <p className="eyebrow">LIQUIDACIONES · ADMINISTRACIÓN</p>
          <h1 id="payments-title">Pagos realizados</h1>
          <p className="intro">Consulta y supervisa los pagos registrados por las estancias del hotel.</p>
          <p className="payments-reference-note">
            Cada pago está guardado dentro de la liquidación de su reservación. Se muestra el identificador real de esa reservación como referencia.
          </p>
        </div>
        <button
          className="button-secondary"
          type="button"
          onClick={() => setRefreshKey((current) => current + 1)}
          disabled={loading}
        >
          {loading ? 'Actualizando…' : 'Actualizar pagos'}
        </button>
      </div>

      <section className="receptionist-stats payments-summary" aria-label="Resumen de pagos">
        <article className="receptionist-stat-card">
          <span className="card-kicker">PAGOS EN LOS FILTROS</span>
          <strong>{formatCount(summary.totalPayments)}</strong>
          <span>Cantidad de pagos registrados</span>
        </article>
        <article className="receptionist-stat-card">
          <span className="card-kicker">TOTAL RECAUDADO</span>
          <strong>{formatCurrency(summary.totalCollected)}</strong>
          <span>Suma de pagos confirmados</span>
        </article>
        <article className="receptionist-stat-card">
          <span className="card-kicker">PAGOS DE HOY</span>
          <strong>{formatCount(summary.todayPayments)}</strong>
          <span>Pagos confirmados hoy en Colombia</span>
        </article>
      </section>

      <section className="reservation-filter-card payments-filter" aria-label="Filtros de pagos">
        <form className="reservation-filter-form payments-filter-form" onSubmit={applyFilters}>
          <label className="form-field payments-search-field" htmlFor="payments-search">
            <span className="field-label">Buscar pago</span>
            <input
              className="form-input"
              id="payments-search"
              type="search"
              value={draftFilters.q}
              onChange={(event) => updateDraftFilter('q', event.target.value)}
              placeholder="Huésped, habitación o ID de reservación…"
              maxLength={100}
            />
          </label>
          <label className="form-field" htmlFor="payments-start-date">
            <span className="field-label">Fecha inicial</span>
            <input className="form-input" id="payments-start-date" type="date" value={draftFilters.startDate} onChange={(event) => updateDraftFilter('startDate', event.target.value)} />
          </label>
          <label className="form-field" htmlFor="payments-end-date">
            <span className="field-label">Fecha final</span>
            <input className="form-input" id="payments-end-date" type="date" value={draftFilters.endDate} onChange={(event) => updateDraftFilter('endDate', event.target.value)} />
          </label>
          <label className="form-field" htmlFor="payments-method">
            <span className="field-label">Método de pago</span>
            <select className="form-input" id="payments-method" value={draftFilters.paymentMethod} onChange={(event) => updateDraftFilter('paymentMethod', event.target.value)}>
              <option value="">Todos</option>
              <option value="efectivo">Efectivo</option>
              <option value="tarjeta">Tarjeta</option>
              <option value="transferencia">Transferencia</option>
            </select>
          </label>
          <label className="form-field" htmlFor="payments-status">
            <span className="field-label">Estado del pago</span>
            <select className="form-input" id="payments-status" value={draftFilters.status} onChange={(event) => updateDraftFilter('status', event.target.value)}>
              <option value="">Todos</option>
              <option value="pagada">Pagado</option>
            </select>
          </label>
          <div className="reservation-filter-actions">
            <button className="button-secondary" type="button" onClick={clearFilters}>Limpiar filtros</button>
            <button className="button-primary" type="submit">Aplicar filtros</button>
          </div>
        </form>
      </section>

      <section className="receptionist-list-card reservation-list-card" aria-labelledby="payments-list-title">
        <div className="receptionist-list-heading">
          <div>
            <span className="card-kicker">LIQUIDACIONES PAGADAS</span>
            <h2 id="payments-list-title">Listado de pagos</h2>
          </div>
          <span className="reservation-result-count" aria-live="polite">
            {loading ? 'Consultando…' : `${formatCount(pagination.total)} ${pagination.total === 1 ? 'pago' : 'pagos'}`}
          </span>
        </div>

        {error ? (
          <div className="reservation-list-message reservation-list-error" role="alert">{error}</div>
        ) : loading ? (
          <div className="reservation-list-message" role="status" aria-live="polite">
            <span className="button-spinner receptionist-loading-spinner" aria-hidden="true" /> Cargando pagos…
          </div>
        ) : payments.length ? (
          <div className="receptionist-table-wrap">
            <table className="receptionist-table reservations-table payments-table">
              <thead>
                <tr>
                  <th scope="col">Referencia de pago / liquidación</th>
                  <th scope="col">Huésped</th>
                  <th scope="col">Habitación</th>
                  <th scope="col">Fecha y hora</th>
                  <th scope="col">Método</th>
                  <th scope="col">Valor pagado</th>
                  <th scope="col">Estado</th>
                  <th scope="col"><span className="sr-only">Acciones</span></th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment._id}>
                    <td data-label="Referencia de pago / liquidación"><code className="payments-reference">{payment._id}</code></td>
                    <td data-label="Huésped">
                      <div className="reservation-guest-cell">
                        <strong>{payment.guest?.fullName || '—'}</strong>
                        <span>{payment.guest?.identification || '—'}</span>
                      </div>
                    </td>
                    <td data-label="Habitación">{payment.roomNumber || '—'}</td>
                    <td data-label="Fecha y hora">{formatDateTime(payment.settlement?.paidAt)}</td>
                    <td data-label="Método">{PAYMENT_METHOD_LABELS[payment.settlement?.paymentMethod] || '—'}</td>
                    <td data-label="Valor pagado"><strong>{formatCurrency(payment.settlement?.paidAmount)}</strong></td>
                    <td data-label="Estado"><span className="reservation-status-pill reservation-status-finalizada">Pagado</span></td>
                    <td className="receptionist-action-cell" data-label="Acciones">
                      <button className="receptionist-status-action receptionist-edit-action" type="button" onClick={() => openDetails(payment._id)}>Ver detalle</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="receptionist-empty-state reservation-empty-state">
            <span className="receptionist-empty-mark" aria-hidden="true">⌕</span>
            <strong>No se encontraron pagos con los filtros seleccionados</strong>
            <p>Prueba con otro nombre, habitación, periodo o método de pago.</p>
          </div>
        )}

        {!error && pagination.totalPages > 1 && (
          <nav className="payments-pagination" aria-label="Paginación de pagos">
            <button className="button-secondary" type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={loading || page <= 1}>Anterior</button>
            <span>Página {pagination.page} de {pagination.totalPages}</span>
            <button className="button-secondary" type="button" onClick={() => setPage((current) => Math.min(pagination.totalPages, current + 1))} disabled={loading || page >= pagination.totalPages}>Siguiente</button>
          </nav>
        )}
      </section>

      {selectedPaymentId && (
        <div
          className="reservation-detail-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelectedPaymentId('');
          }}
        >
          <section className="reservation-detail-dialog settlement-history-dialog" role="dialog" aria-modal="true" aria-labelledby="payment-detail-title">
            <div className="reservation-detail-heading">
              <div>
                <span className="card-kicker">DETALLE DEL PAGO</span>
                <h2 id="payment-detail-title">{selectedPayment?.guest?.fullName ? `Pago de ${selectedPayment.guest.fullName}` : 'Pago realizado'}</h2>
              </div>
              <div className="receipt-dialog-buttons">
                <button
                  className="button-secondary"
                  type="button"
                  onClick={() => {
                    setReceiptReservationId(selectedPaymentId);
                    setSelectedPaymentId('');
                  }}
                >
                  Comprobante
                </button>
                <button className="reservation-detail-close" type="button" onClick={() => setSelectedPaymentId('')} aria-label="Cerrar detalle del pago">×</button>
              </div>
            </div>
            <PaymentDetails payment={selectedPayment} loading={detailLoading} error={detailError} />
          </section>
        </div>
      )}

      {receiptReservationId && (
        <ReceiptDialog token={token} reservationId={receiptReservationId} onClose={() => setReceiptReservationId('')} />
      )}
    </section>
  );
}
