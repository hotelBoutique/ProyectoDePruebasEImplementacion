import { useCallback, useEffect, useMemo, useState } from 'react';
import { getPendingCheckOuts } from '../services/api.js';

const EMPTY_FILTERS = {
  search: '',
  checkInFrom: '',
  checkInTo: '',
  checkOutFrom: '',
  checkOutTo: '',
};

function formatCurrency(value) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

function dateOnly(value) {
  if (!value) return '';
  return String(value).slice(0, 10);
}

function formatDate(value) {
  const normalized = dateOnly(value);
  if (!normalized) return '—';
  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${normalized}T00:00:00.000Z`));
}

function getConsumptions(reservation) {
  return (reservation.consumptions || []).filter((item) => item.status !== 'anulado');
}

function getConsumptionSubtotal(item) {
  if (item.subtotal != null && Number.isFinite(Number(item.subtotal))) return Number(item.subtotal);
  if (item.amount != null && Number.isFinite(Number(item.amount))) return Number(item.amount);
  return Number(item.quantity || 0) * Number(item.unitPrice || 0);
}

function getErrorMessage(error) {
  return Array.isArray(error.details) && error.details.length
    ? error.details.join('. ')
    : error.message || 'No fue posible cargar las cuentas abiertas.';
}

function AccountStat({ label, value, detail }) {
  return (
    <article className="receptionist-stat-card open-account-stat-card">
      <span className="card-kicker">{label}</span>
      <strong>{value}</strong>
      <span>{detail}</span>
    </article>
  );
}

function AccountDetails({ reservation, onClose, onCheckout }) {
  const estimate = reservation.settlementEstimate;
  const consumptions = getConsumptions(reservation);
  const consumptionTotal = estimate?.consumptionsTotal != null
    ? Number(estimate.consumptionsTotal)
    : consumptions.reduce((total, item) => total + getConsumptionSubtotal(item), 0);
  const totalDue = estimate?.totalDue;
  const reservationId = String(reservation._id || '');

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="reservation-detail-backdrop open-account-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="reservation-detail-dialog open-account-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="open-account-detail-title"
      >
        <div className="reservation-detail-heading">
          <div>
            <span className="card-kicker">CUENTA ABIERTA · {reservationId}</span>
            <h2 id="open-account-detail-title">Cuenta de {reservation.guest?.fullName || 'huésped'}</h2>
          </div>
          <button className="reservation-detail-close" type="button" onClick={onClose} aria-label="Cerrar detalle">×</button>
        </div>

        <section className="open-account-detail-section" aria-labelledby="open-account-stay-heading">
          <div className="open-account-section-heading">
            <span className="card-kicker">SECCIÓN A</span>
            <h3 id="open-account-stay-heading">Huésped y estancia</h3>
          </div>
          <dl className="reservation-detail-grid open-account-detail-grid">
            <div><dt>Huésped</dt><dd>{reservation.guest?.fullName || '—'}</dd></div>
            <div><dt>Habitación</dt><dd>{reservation.roomNumber || '—'} · {reservation.roomType || 'Tipo no disponible'}</dd></div>
            <div><dt>Código de reservación</dt><dd className="open-account-id">{reservationId || '—'}</dd></div>
            <div><dt>Check-in</dt><dd>{formatDate(reservation.checkInAt || reservation.checkIn)}</dd></div>
            <div><dt>Salida prevista</dt><dd>{formatDate(reservation.checkOut)}</dd></div>
            <div><dt>Noches facturables al día de hoy</dt><dd>{estimate?.actualNights ?? '—'}</dd></div>
            <div><dt>Tarifa aplicada por noche</dt><dd>{estimate ? formatCurrency(estimate.nightlyRate) : '—'}</dd></div>
          </dl>
        </section>

        <section className="open-account-detail-section" aria-labelledby="open-account-room-heading">
          <div className="open-account-section-heading">
            <span className="card-kicker">SECCIÓN B</span>
            <h3 id="open-account-room-heading">Detalle del alojamiento</h3>
          </div>
          <dl className="open-account-accommodation-summary">
            <div><dt>Noches facturables</dt><dd>{estimate?.actualNights ?? '—'}</dd></div>
            <div><dt>Tarifa aplicada por noche</dt><dd>{estimate ? formatCurrency(estimate.nightlyRate) : '—'}</dd></div>
            <div className="open-account-subtotal"><dt>Subtotal del alojamiento</dt><dd>{estimate ? formatCurrency(estimate.roomSubtotal) : '—'}</dd></div>
          </dl>
        </section>

        <section className="open-account-detail-section" aria-labelledby="open-account-consumptions-heading">
          <div className="open-account-section-heading">
            <span className="card-kicker">SECCIÓN C</span>
            <h3 id="open-account-consumptions-heading">Consumos registrados</h3>
          </div>
          {consumptions.length ? (
            <div className="receptionist-table-wrap open-account-consumptions-wrap">
              <table className="receptionist-table open-account-consumptions-table">
                <thead>
                  <tr>
                    <th scope="col">Producto</th>
                    <th scope="col">Fecha</th>
                    <th scope="col">Cantidad</th>
                    <th scope="col">Precio unitario</th>
                    <th scope="col">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {consumptions.map((item, index) => (
                    <tr key={item._id || `${item.description}-${index}`}>
                      <td data-label="Producto">{item.description || 'Producto'}</td>
                      <td data-label="Fecha">{formatDate(item.createdAt)}</td>
                      <td data-label="Cantidad">{item.quantity ?? 1}</td>
                      <td data-label="Precio unitario">{formatCurrency(item.unitPrice)}</td>
                      <td data-label="Subtotal">{formatCurrency(getConsumptionSubtotal(item))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="open-account-no-consumptions">Esta habitación no tiene consumos registrados</p>
          )}
          <div className="open-account-consumptions-total">
            <span>Total acumulado de consumos</span>
            <strong>{formatCurrency(consumptionTotal)}</strong>
          </div>
        </section>

        <section className="open-account-detail-section open-account-balance" aria-labelledby="open-account-balance-heading">
          <div className="open-account-section-heading">
            <span className="card-kicker">SECCIÓN D</span>
            <h3 id="open-account-balance-heading">Resumen de la cuenta</h3>
          </div>
          <dl className="open-account-balance-list">
            <div><dt>Subtotal del alojamiento</dt><dd>{estimate ? formatCurrency(estimate.roomSubtotal) : '—'}</dd></div>
            <div><dt>Subtotal de consumos adicionales</dt><dd>{formatCurrency(consumptionTotal)}</dd></div>
            <div className="open-account-balance-total"><dt>Total general pendiente</dt><dd>{totalDue == null ? 'No disponible' : formatCurrency(totalDue)}</dd></div>
          </dl>
        </section>

        <div className="open-account-detail-actions">
          <p>Los valores estimados se calculan en el servidor. El registro del pago y el cierre de la estancia se confirman desde el flujo de check-out.</p>
          <button className="button-primary" type="button" onClick={() => onCheckout(reservationId)}>
            Registrar pago y realizar check-out <span aria-hidden="true">→</span>
          </button>
        </div>
      </section>
    </div>
  );
}

export default function OpenAccountsPage({ token, onNavigate }) {
  const [reservations, setReservations] = useState([]);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadAccounts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await getPendingCheckOuts(token);
      const activeStays = (response.data?.reservations || [])
        .filter((reservation) => reservation.status === 'ocupada');
      setReservations(activeStays);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  const filteredReservations = useMemo(() => {
    const query = filters.search.trim().toLocaleLowerCase('es-CO');
    return reservations.filter((reservation) => {
      const searchable = [
        reservation._id,
        reservation.guest?.fullName,
        reservation.roomNumber,
      ].some((value) => String(value || '').toLocaleLowerCase('es-CO').includes(query));
      if (query && !searchable) return false;

      const checkIn = dateOnly(reservation.checkInAt || reservation.checkIn);
      const checkOut = dateOnly(reservation.checkOut);
      if (filters.checkInFrom && checkIn < filters.checkInFrom) return false;
      if (filters.checkInTo && checkIn > filters.checkInTo) return false;
      if (filters.checkOutFrom && checkOut < filters.checkOutFrom) return false;
      if (filters.checkOutTo && checkOut > filters.checkOutTo) return false;
      return true;
    });
  }, [filters, reservations]);

  const totalPending = reservations.reduce(
    (total, reservation) => total + Number(reservation.settlementEstimate?.totalDue || 0),
    0,
  );
  const hasIncompleteEstimate = reservations.some((reservation) => !reservation.settlementEstimate);
  const hasFilters = Object.values(filters).some(Boolean);
  const selectedReservation = reservations.find((reservation) => String(reservation._id) === selectedId);

  function updateFilter(field, value) {
    setFilters((current) => ({ ...current, [field]: value }));
  }

  function openCheckout(reservationId) {
    setSelectedId('');
    onNavigate('reception-check-out', { reservationId });
  }

  return (
    <section className="rooms-page open-accounts-page" aria-labelledby="open-accounts-title">
      <div className="rooms-heading">
        <div>
          <p className="eyebrow">LIQUIDACIONES · RECEPCIÓN</p>
          <h1 id="open-accounts-title">Cuentas abiertas</h1>
          <p className="intro">Consulta y administra las cuentas pendientes de las estancias activas</p>
        </div>
        <button className="button-secondary" type="button" onClick={loadAccounts} disabled={loading}>
          {loading ? 'Actualizando…' : 'Actualizar cuentas'}
        </button>
      </div>

      <section className="receptionist-stats open-account-stats" aria-label="Resumen de cuentas abiertas">
        <AccountStat
          label="CUENTAS ABIERTAS"
          value={loading && !reservations.length ? '…' : error ? 'No disponible' : reservations.length}
          detail={error ? 'No se pudo consultar el servidor' : 'Estancias activas en recepción'}
        />
        <AccountStat
          label="TOTAL PENDIENTE ESTIMADO"
          value={loading && !reservations.length ? '…' : error || hasIncompleteEstimate ? 'No disponible' : formatCurrency(totalPending)}
          detail={error || hasIncompleteEstimate ? 'No se pudo obtener la estimación completa del servidor' : 'Cálculo vigente del servidor'}
        />
      </section>

      {error && <div className="rooms-notice feedback-error" role="alert">{error}</div>}

      <section className="reservation-filter-card open-account-filters" aria-label="Buscar y filtrar cuentas abiertas">
        <label className="form-field open-account-search" htmlFor="open-account-search">
          <span className="field-label">Buscar por habitación, huésped o código de cuenta</span>
          <input
            id="open-account-search"
            className="form-input"
            type="search"
            value={filters.search}
            onChange={(event) => updateFilter('search', event.target.value)}
            placeholder="Habitación, nombre o identificador…"
          />
        </label>
        <div className="open-account-date-filters">
          <label className="form-field">
            <span className="field-label">Ingreso desde</span>
            <input className="form-input" type="date" value={filters.checkInFrom} onChange={(event) => updateFilter('checkInFrom', event.target.value)} />
          </label>
          <label className="form-field">
            <span className="field-label">Ingreso hasta</span>
            <input className="form-input" type="date" value={filters.checkInTo} onChange={(event) => updateFilter('checkInTo', event.target.value)} />
          </label>
          <label className="form-field">
            <span className="field-label">Salida desde</span>
            <input className="form-input" type="date" value={filters.checkOutFrom} onChange={(event) => updateFilter('checkOutFrom', event.target.value)} />
          </label>
          <label className="form-field">
            <span className="field-label">Salida hasta</span>
            <input className="form-input" type="date" value={filters.checkOutTo} onChange={(event) => updateFilter('checkOutTo', event.target.value)} />
          </label>
        </div>
        <div className="open-account-filter-footer">
          <span className="reservation-result-count" aria-live="polite">
            {loading ? 'Consultando estancias…' : `${filteredReservations.length} ${filteredReservations.length === 1 ? 'cuenta' : 'cuentas'}`}
          </span>
          {hasFilters && <button className="button-secondary" type="button" onClick={() => setFilters(EMPTY_FILTERS)}>Limpiar filtros</button>}
        </div>
      </section>

      <section className="receptionist-list-card open-account-list" aria-labelledby="open-account-list-title">
        <div className="receptionist-list-heading">
          <div>
            <span className="card-kicker">ESTANCIAS ACTIVAS · DATOS DEL SISTEMA</span>
            <h2 id="open-account-list-title">Cuentas pendientes</h2>
          </div>
        </div>

        {loading ? (
          <div className="reservation-list-message" role="status" aria-live="polite">
            <span className="button-spinner receptionist-loading-spinner" aria-hidden="true" /> Cargando cuentas abiertas…
          </div>
        ) : error ? (
          <div className="reservation-list-message reservation-list-error" role="alert">No fue posible obtener las estancias del sistema.</div>
        ) : filteredReservations.length ? (
          <div className="receptionist-table-wrap">
            <table className="receptionist-table open-accounts-table">
              <thead>
                <tr>
                  <th scope="col">Código de cuenta / estancia</th>
                  <th scope="col">Habitación</th>
                  <th scope="col">Huésped</th>
                  <th scope="col">Ingreso</th>
                  <th scope="col">Salida prevista</th>
                  <th scope="col">Noches</th>
                  <th scope="col">Alojamiento</th>
                  <th scope="col">Consumos</th>
                  <th scope="col">Total pendiente</th>
                  <th scope="col">Estado</th>
                  <th scope="col"><span className="sr-only">Acciones</span></th>
                </tr>
              </thead>
              <tbody>
                {filteredReservations.map((reservation) => {
                  const estimate = reservation.settlementEstimate;
                  const id = String(reservation._id);
                  return (
                    <tr key={id}>
                      <td data-label="Código de cuenta / estancia"><span className="open-account-id">{id}</span></td>
                      <td data-label="Habitación">{reservation.roomNumber || '—'}</td>
                      <td data-label="Huésped"><strong>{reservation.guest?.fullName || '—'}</strong></td>
                      <td data-label="Ingreso">{formatDate(reservation.checkInAt || reservation.checkIn)}</td>
                      <td data-label="Salida prevista">{formatDate(reservation.checkOut)}</td>
                      <td data-label="Noches">{estimate?.actualNights ?? '—'}</td>
                      <td data-label="Alojamiento">{estimate ? formatCurrency(estimate.roomSubtotal) : '—'}</td>
                      <td data-label="Consumos">{estimate ? formatCurrency(estimate.consumptionsTotal) : '—'}</td>
                      <td data-label="Total pendiente"><strong>{estimate ? formatCurrency(estimate.totalDue) : 'No disponible'}</strong></td>
                      <td data-label="Estado"><span className="open-account-status">Abierta</span></td>
                      <td className="receptionist-action-cell" data-label="Acción">
                        <button className="receptionist-status-action receptionist-edit-action" type="button" onClick={() => setSelectedId(id)}>
                          Ver detalle <span aria-hidden="true">→</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="receptionist-empty-state reservation-empty-state">
            <span className="receptionist-empty-mark" aria-hidden="true">⌕</span>
            <strong>{hasFilters ? 'No hay cuentas que coincidan con los filtros' : 'No hay cuentas abiertas'}</strong>
            <p>{hasFilters ? 'Cambia el texto de búsqueda o ajusta las fechas para ver otras estancias.' : 'Las estancias con check-in activo aparecerán aquí.'}</p>
          </div>
        )}
      </section>

      {selectedReservation && (
        <AccountDetails
          reservation={selectedReservation}
          onClose={() => setSelectedId('')}
          onCheckout={openCheckout}
        />
      )}
    </section>
  );
}
