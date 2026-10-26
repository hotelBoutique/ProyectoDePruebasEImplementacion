import { useEffect, useState } from 'react';
import { ReceiptDialog } from '../components/PaymentReceipt.jsx';
import { getReceipts } from '../services/api.js';

const EMPTY_FILTERS = {
  q: '',
  startDate: '',
  endDate: '',
  paymentMethod: '',
};

const PAYMENT_METHOD_LABELS = {
  efectivo: 'Efectivo',
  tarjeta: 'Tarjeta',
  transferencia: 'Transferencia',
};

const PAGE_SIZE = 20;

function formatDateTime(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function formatCurrency(value) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function getErrorMessage(error) {
  return Array.isArray(error.details) && error.details.length
    ? error.details.join('. ')
    : error.message || 'No fue posible consultar los comprobantes.';
}

export default function ReceiptsPage({ token }) {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [payments, setPayments] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterError, setFilterError] = useState('');
  const [selectedReservationId, setSelectedReservationId] = useState('');

  const hasAppliedFilters = Object.values(appliedFilters).some((value) => value.trim());

  useEffect(() => {
    let isCurrent = true;
    setLoading(true);
    setError('');

    getReceipts(token, { ...appliedFilters, page, limit: PAGE_SIZE })
      .then((response) => {
        if (!isCurrent) return;
        setPayments(response.data?.payments || []);
        setPagination(response.data?.pagination || { page: 1, totalPages: 0, total: 0 });
      })
      .catch((loadError) => {
        if (isCurrent) {
          setPayments([]);
          setError(getErrorMessage(loadError));
        }
      })
      .finally(() => {
        if (isCurrent) setLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [token, appliedFilters, page]);

  function updateFilter(event) {
    const { name, value } = event.target;
    setFilters((current) => ({ ...current, [name]: value }));
  }

  function applyFilters(event) {
    event.preventDefault();
    if (filters.startDate && filters.endDate && filters.endDate < filters.startDate) {
      setFilterError('La fecha final debe ser igual o posterior a la fecha inicial.');
      return;
    }
    setFilterError('');
    setPage(1);
    setAppliedFilters({ ...filters });
  }

  function clearFilters() {
    setFilters(EMPTY_FILTERS);
    setFilterError('');
    setPage(1);
    setAppliedFilters(EMPTY_FILTERS);
  }

  return (
    <section className="rooms-page" aria-labelledby="receipts-title">
      <div className="rooms-heading">
        <div>
          <p className="eyebrow">LIQUIDACIONES</p>
          <h1 id="receipts-title">Comprobantes de pago</h1>
          <p className="intro">Busca el pago de una estadía para ver, imprimir o guardar su comprobante.</p>
        </div>
      </div>

      <section className="receptionist-list-card" aria-label="Comprobantes emitidos">
        <form className="rooms-filters catalog-filters" onSubmit={applyFilters} noValidate aria-label="Buscar comprobantes">
          <label className="form-field" htmlFor="receipts-search">
            <span className="field-label">Huésped, habitación o número</span>
            <input
              className="form-input"
              id="receipts-search"
              name="q"
              type="search"
              maxLength={100}
              placeholder="Ej. CP-000012 o 101"
              value={filters.q}
              onChange={updateFilter}
            />
          </label>
          <label className="form-field" htmlFor="receipts-start-date">
            <span className="field-label">Pagado desde</span>
            <input className="form-input" id="receipts-start-date" name="startDate" type="date" value={filters.startDate} onChange={updateFilter} />
          </label>
          <label className="form-field" htmlFor="receipts-end-date">
            <span className="field-label">Hasta</span>
            <input className="form-input" id="receipts-end-date" name="endDate" type="date" min={filters.startDate || undefined} value={filters.endDate} onChange={updateFilter} />
          </label>
          <label className="form-field" htmlFor="receipts-method">
            <span className="field-label">Método</span>
            <select className="form-input" id="receipts-method" name="paymentMethod" value={filters.paymentMethod} onChange={updateFilter}>
              <option value="">Todos</option>
              {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
                <option value={value} key={value}>{label}</option>
              ))}
            </select>
          </label>
          <div className="rooms-filters-actions">
            <button className="button-primary" type="submit" disabled={loading}>Buscar</button>
            <button
              className="button-secondary"
              type="button"
              onClick={clearFilters}
              disabled={loading || (!hasAppliedFilters && !Object.values(filters).some((value) => value.trim()))}
            >
              Limpiar
            </button>
          </div>
          {filterError && <p className="rooms-filters-error" role="alert">{filterError}</p>}
        </form>

        {!loading && !error && pagination.total > 0 && (
          <p className="rooms-filters-summary" role="status">
            {pagination.total === 1 ? '1 comprobante' : `${pagination.total} comprobantes`}
            {hasAppliedFilters ? ' coinciden con la búsqueda.' : ' emitidos.'}
          </p>
        )}

        {loading ? (
          <div className="receptionist-empty-state" role="status">Buscando comprobantes…</div>
        ) : error ? (
          <div className="receptionist-empty-state">
            <strong>No fue posible consultar los comprobantes</strong>
            <p>{error}</p>
          </div>
        ) : payments.length === 0 ? (
          <div className="receptionist-empty-state">
            <strong>{hasAppliedFilters ? 'Ningún comprobante coincide' : 'Aún no hay pagos registrados'}</strong>
            <p>
              {hasAppliedFilters
                ? 'Prueba con otro nombre, habitación, número o periodo.'
                : 'Los comprobantes aparecen aquí cuando se registra el pago y check-out de una estadía.'}
            </p>
          </div>
        ) : (
          <div className="receptionist-table-wrap">
            <table className="receptionist-table reservations-table receipts-table">
              <thead>
                <tr>
                  <th scope="col">Comprobante</th>
                  <th scope="col">Fecha de pago</th>
                  <th scope="col">Huésped</th>
                  <th scope="col">Habitación</th>
                  <th scope="col">Método</th>
                  <th scope="col">Valor</th>
                  <th scope="col"><span className="sr-only">Acciones</span></th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment._id}>
                    <td data-label="Comprobante">
                      {payment.settlement?.receiptNumber
                        ? <strong>{payment.settlement.receiptNumber}</strong>
                        : <span className="receipts-pending-number">Se numera al abrirlo</span>}
                    </td>
                    <td data-label="Fecha de pago">{formatDateTime(payment.settlement?.paidAt)}</td>
                    <td data-label="Huésped">
                      <span className="reservation-guest-cell">
                        <strong>{payment.guest?.fullName || '—'}</strong>
                        <span>{payment.guest?.identification || ''}</span>
                      </span>
                    </td>
                    <td data-label="Habitación">{payment.roomNumber}</td>
                    <td data-label="Método">{PAYMENT_METHOD_LABELS[payment.settlement?.paymentMethod] || '—'}</td>
                    <td data-label="Valor"><strong>{formatCurrency(payment.settlement?.paidAmount)}</strong></td>
                    <td className="receptionist-action-cell" data-label="Acciones">
                      <button
                        className="receptionist-status-action receptionist-edit-action"
                        type="button"
                        onClick={() => setSelectedReservationId(payment._id)}
                      >
                        Ver comprobante
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!error && pagination.totalPages > 1 && (
          <nav className="payments-pagination" aria-label="Paginación de comprobantes">
            <button className="button-secondary" type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={loading || page <= 1}>Anterior</button>
            <span>Página {pagination.page} de {pagination.totalPages}</span>
            <button className="button-secondary" type="button" onClick={() => setPage((current) => Math.min(pagination.totalPages, current + 1))} disabled={loading || page >= pagination.totalPages}>Siguiente</button>
          </nav>
        )}
      </section>

      {selectedReservationId && (
        <ReceiptDialog
          token={token}
          reservationId={selectedReservationId}
          onClose={() => {
            setSelectedReservationId('');
            // Al abrir un pago antiguo se le asigna número: se refresca la lista para mostrarlo.
            setAppliedFilters((current) => ({ ...current }));
          }}
        />
      )}
    </section>
  );
}
