import { useCallback, useEffect, useMemo, useState } from 'react';
import { getSettlementHistory } from '../services/api.js';

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

function formatDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(value));
}

function formatDateTime(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function formatStayDateTime(timestamp, scheduledDate) {
  return timestamp ? formatDateTime(timestamp) : formatDate(scheduledDate);
}

function getErrorMessage(error) {
  return Array.isArray(error.details) && error.details.length
    ? error.details.join('. ')
    : error.message || 'No fue posible cargar el historial de liquidaciones.';
}

function getSettlementItems(settlement, reservation) {
  return settlement.consumptions?.length
    ? settlement.consumptions
    : reservation.consumptions || [];
}

export default function SettlementHistoryPage({ token }) {
  const [settlements, setSettlements] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedSettlement, setSelectedSettlement] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadSettlements = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await getSettlementHistory(token);
      setSettlements(response.data?.settlements || []);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadSettlements();
  }, [loadSettlements]);

  const filteredSettlements = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase('es-CO');
    if (!normalizedSearch) return settlements;

    return settlements.filter((reservation) => {
      const searchableFields = [
        reservation.guest?.fullName,
        reservation.guest?.identification,
        reservation.guest?.email,
        reservation.roomNumber,
        reservation.roomType,
        reservation.settlement?.paymentMethod,
      ];
      return searchableFields.some((value) => (
        String(value || '').toLocaleLowerCase('es-CO').includes(normalizedSearch)
      ));
    });
  }, [search, settlements]);

  return (
    <section className="rooms-page settlements-page" aria-labelledby="settlement-history-title">
      <div className="rooms-heading">
        <div>
          <p className="eyebrow">CUENTAS CERRADAS</p>
          <h1 id="settlement-history-title">Historial de liquidaciones</h1>
          <p className="intro">Consulta las estancias finalizadas, su detalle de alojamiento, consumos y pago.</p>
        </div>
        <button
          className="button-secondary"
          type="button"
          onClick={loadSettlements}
          disabled={loading}
        >
          {loading ? 'Actualizando…' : 'Actualizar historial'}
        </button>
      </div>

      <section className="reservation-filter-card settlement-history-filter" aria-label="Buscar liquidaciones">
        <label className="form-field" htmlFor="settlement-history-search">
          <span className="field-label">Buscar por huésped, identificación, habitación o pago</span>
          <input
            className="form-input"
            id="settlement-history-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Nombre, documento, habitación…"
            disabled={loading && !settlements.length}
          />
        </label>
        <span className="reservation-result-count" aria-live="polite">
          {loading ? 'Consultando…' : `${filteredSettlements.length} ${filteredSettlements.length === 1 ? 'cuenta' : 'cuentas'}`}
        </span>
      </section>

      <section className="receptionist-list-card reservation-list-card" aria-labelledby="settlement-history-list-title">
        <div className="receptionist-list-heading">
          <div>
            <span className="card-kicker">ESTANCIAS FINALIZADAS Y PAGADAS</span>
            <h2 id="settlement-history-list-title">Cuentas finalizadas</h2>
          </div>
        </div>

        {error ? (
          <div className="reservation-list-message reservation-list-error" role="alert">{error}</div>
        ) : loading ? (
          <div className="reservation-list-message" role="status" aria-live="polite">
            <span className="button-spinner receptionist-loading-spinner" aria-hidden="true" /> Cargando liquidaciones…
          </div>
        ) : filteredSettlements.length ? (
          <div className="receptionist-table-wrap">
            <table className="receptionist-table reservations-table settlement-history-table">
              <thead>
                <tr>
                  <th scope="col">Huésped</th>
                  <th scope="col">Habitación</th>
                  <th scope="col">Salida</th>
                  <th scope="col">Método de pago</th>
                  <th scope="col">Total pagado</th>
                  <th scope="col"><span className="sr-only">Acciones</span></th>
                </tr>
              </thead>
              <tbody>
                {filteredSettlements.map((reservation) => (
                  <tr key={reservation._id}>
                    <td data-label="Huésped">
                      <div className="reservation-guest-cell">
                        <strong>{reservation.guest?.fullName || 'Huésped'}</strong>
                        <span>{reservation.guest?.identification || reservation._id}</span>
                      </div>
                    </td>
                    <td data-label="Habitación">{reservation.roomNumber} · {reservation.roomType}</td>
                    <td data-label="Salida">{formatStayDateTime(reservation.checkOutAt, reservation.checkOut)}</td>
                    <td data-label="Método de pago">{PAYMENT_METHOD_LABELS[reservation.settlement?.paymentMethod] || '—'}</td>
                    <td data-label="Total pagado">{formatCurrency(reservation.settlement?.paidAmount ?? reservation.settlement?.totalAmount)}</td>
                    <td className="receptionist-action-cell" data-label="Acciones">
                      <button
                        className="receptionist-status-action receptionist-edit-action"
                        type="button"
                        onClick={() => setSelectedSettlement(reservation)}
                      >
                        Ver liquidación
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="receptionist-empty-state reservation-empty-state">
            <span className="receptionist-empty-mark" aria-hidden="true">⌕</span>
            <strong>{search ? 'No hay cuentas que coincidan con la búsqueda' : 'Aún no hay liquidaciones finalizadas'}</strong>
            <p>{search ? 'Prueba con otro nombre, documento, habitación o método de pago.' : 'Cuando se cierre y pague una estancia, su cuenta aparecerá aquí.'}</p>
          </div>
        )}
      </section>

      {selectedSettlement && (
        <div
          className="reservation-detail-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelectedSettlement(null);
          }}
        >
          <section className="reservation-detail-dialog settlement-history-dialog" role="dialog" aria-modal="true" aria-labelledby="settlement-detail-title">
            <div className="reservation-detail-heading">
              <div>
                <span className="card-kicker">LIQUIDACIÓN PAGADA · {formatDateTime(selectedSettlement.settlement?.paidAt)}</span>
                <h2 id="settlement-detail-title">Cuenta de {selectedSettlement.guest?.fullName || 'huésped'}</h2>
              </div>
              <button className="reservation-detail-close" type="button" onClick={() => setSelectedSettlement(null)} aria-label="Cerrar liquidación">×</button>
            </div>

            <dl className="reservation-detail-grid settlement-history-detail-grid">
              <div><dt>Estado</dt><dd>Finalizada y pagada</dd></div>
              <div><dt>Habitación</dt><dd>{selectedSettlement.roomNumber} · {selectedSettlement.roomType}</dd></div>
              <div><dt>Identificación</dt><dd>{selectedSettlement.guest?.identification || '—'}</dd></div>
              <div><dt>Correo</dt><dd>{selectedSettlement.guest?.email || '—'}</dd></div>
              <div><dt>Teléfono</dt><dd>{selectedSettlement.guest?.phone || '—'}</dd></div>
              <div><dt>Check-in</dt><dd>{formatStayDateTime(selectedSettlement.checkInAt, selectedSettlement.checkIn)}</dd></div>
              <div><dt>Check-out</dt><dd>{formatStayDateTime(selectedSettlement.checkOutAt, selectedSettlement.checkOut)}</dd></div>
              <div><dt>Noches cobradas</dt><dd>{selectedSettlement.settlement?.actualNights ?? '—'}</dd></div>
              <div><dt>Tarifa por noche</dt><dd>{formatCurrency(selectedSettlement.settlement?.nightlyRate)}</dd></div>
              <div><dt>Alojamiento</dt><dd>{formatCurrency(selectedSettlement.settlement?.roomSubtotal)}</dd></div>
            </dl>

            <section className="settlement-history-breakdown" aria-labelledby="settlement-consumptions-title">
              <h3 id="settlement-consumptions-title">Consumos</h3>
              {getSettlementItems(selectedSettlement.settlement || {}, selectedSettlement).length ? (
                <div className="settlement-history-breakdown-list">
                  {getSettlementItems(selectedSettlement.settlement || {}, selectedSettlement).map((item, index) => (
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
                <p className="settlement-history-empty-detail">No se registraron consumos en esta estancia.</p>
              )}
              <div className="settlement-history-subtotal">
                <span>Total de consumos</span>
                <strong>{formatCurrency(selectedSettlement.settlement?.consumptionsTotal)}</strong>
              </div>
            </section>

            <section className="settlement-history-breakdown" aria-labelledby="settlement-charges-title">
              <h3 id="settlement-charges-title">Cargos adicionales al cierre</h3>
              {selectedSettlement.settlement?.additionalCharges?.length ? (
                <div className="settlement-history-breakdown-list">
                  {selectedSettlement.settlement.additionalCharges.map((item, index) => (
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
                <strong>{formatCurrency(selectedSettlement.settlement?.additionalChargesTotal)}</strong>
              </div>
            </section>

            <dl className="settlement-history-payment">
              <div><dt>Método de pago</dt><dd>{PAYMENT_METHOD_LABELS[selectedSettlement.settlement?.paymentMethod] || '—'}</dd></div>
              <div><dt>Fecha del pago</dt><dd>{formatDateTime(selectedSettlement.settlement?.paidAt)}</dd></div>
              <div className="settlement-history-total"><dt>Total pagado</dt><dd>{formatCurrency(selectedSettlement.settlement?.paidAmount ?? selectedSettlement.settlement?.totalAmount)}</dd></div>
            </dl>
          </section>
        </div>
      )}
    </section>
  );
}
