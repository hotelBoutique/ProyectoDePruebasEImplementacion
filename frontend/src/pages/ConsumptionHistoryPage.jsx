import { useEffect, useMemo, useState } from 'react';
import { getSettlementHistory } from '../services/api.js';

const EMPTY_FILTERS = { from: '', to: '', search: '' };

function formatCurrency(value) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function formatDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium' }).format(new Date(value));
}

function localDateOnly(value) {
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

// Cada liquidación pagada guarda una copia de los consumos cobrados.
function flattenConsumptions(settlements) {
  return settlements.flatMap((reservation) => {
    const settlement = reservation.settlement || {};
    return (settlement.consumptions || []).map((item, index) => ({
      id: `${reservation._id}-${index}`,
      description: item.description,
      quantity: Number(item.quantity || 0),
      unitPrice: Number(item.unitPrice || 0),
      subtotal: Number(item.subtotal ?? item.amount ?? 0),
      roomNumber: reservation.roomNumber,
      guestName: reservation.guest?.fullName || 'Huésped',
      receiptNumber: settlement.receiptNumber,
      paidAt: settlement.paidAt,
    }));
  });
}

export default function ConsumptionHistoryPage({ token }) {
  const [items, setItems] = useState([]);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [applied, setApplied] = useState(EMPTY_FILTERS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterError, setFilterError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let isCurrent = true;
    setLoading(true);
    setError('');
    getSettlementHistory(token)
      .then((response) => {
        if (isCurrent) setItems(flattenConsumptions(response.data?.settlements || []));
      })
      .catch((loadError) => {
        if (isCurrent) setError(loadError.message || 'No fue posible cargar el historial de consumos.');
      })
      .finally(() => {
        if (isCurrent) setLoading(false);
      });
    return () => {
      isCurrent = false;
    };
  }, [token, reloadKey]);

  const visibleItems = useMemo(() => {
    const search = applied.search.trim().toLowerCase();
    return items.filter((item) => {
      const day = item.paidAt ? localDateOnly(item.paidAt) : '';
      if (applied.from && day < applied.from) return false;
      if (applied.to && day > applied.to) return false;
      if (search && ![item.description, item.guestName, item.roomNumber, item.receiptNumber]
        .some((value) => String(value || '').toLowerCase().includes(search))) return false;
      return true;
    });
  }, [items, applied]);

  const totals = useMemo(() => visibleItems.reduce(
    (acc, item) => ({ units: acc.units + item.quantity, revenue: acc.revenue + item.subtotal }),
    { units: 0, revenue: 0 },
  ), [visibleItems]);

  function updateFilter(event) {
    const { name, value } = event.target;
    setFilters((current) => ({ ...current, [name]: value }));
    setFilterError('');
  }

  function applyFilters(event) {
    event.preventDefault();
    if (filters.from && filters.to && filters.to < filters.from) {
      setFilterError('La fecha final debe ser igual o posterior a la fecha inicial.');
      return;
    }
    setApplied({ ...filters });
  }

  function clearFilters() {
    setFilters(EMPTY_FILTERS);
    setApplied(EMPTY_FILTERS);
    setFilterError('');
  }

  const hasFilters = Object.values(applied).some((value) => value.trim());

  return (
    <section className="rooms-page" aria-labelledby="consumption-history-title">
      <div className="rooms-heading">
        <div>
          <p className="eyebrow">CONSUMOS</p>
          <h1 id="consumption-history-title">Historial de consumos</h1>
          <p className="intro">
            Consumos cobrados en las liquidaciones pagadas. Las cuentas abiertas las gestiona recepción hasta el check-out.
          </p>
        </div>
      </div>

      <section className="receptionist-list-card" aria-label="Historial de consumos">
        <div className="receptionist-list-heading">
          <div>
            <span className="card-kicker">CONSUMOS LIQUIDADOS</span>
            <h2>{loading ? 'Consultando…' : `${visibleItems.length} ${visibleItems.length === 1 ? 'consumo' : 'consumos'} · ${formatCurrency(totals.revenue)}`}</h2>
          </div>
          <button className="button-secondary receptionist-refresh" type="button" onClick={() => setReloadKey((key) => key + 1)} disabled={loading}>
            {loading ? 'Cargando…' : 'Actualizar historial'}
          </button>
        </div>

        <form className="rooms-filters" onSubmit={applyFilters} noValidate aria-label="Filtrar consumos">
          <label className="form-field" htmlFor="consumption-history-from">
            <span className="field-label">Pagado desde</span>
            <input className="form-input" id="consumption-history-from" name="from" type="date" value={filters.from} onChange={updateFilter} />
          </label>
          <label className="form-field" htmlFor="consumption-history-to">
            <span className="field-label">Pagado hasta</span>
            <input className="form-input" id="consumption-history-to" name="to" type="date" value={filters.to} onChange={updateFilter} />
          </label>
          <label className="form-field" htmlFor="consumption-history-search">
            <span className="field-label">Buscar</span>
            <input className="form-input" id="consumption-history-search" name="search" type="search" placeholder="Producto, huésped, habitación o recibo" value={filters.search} onChange={updateFilter} />
          </label>
          <div className="rooms-filters-actions">
            <button className="button-primary" type="submit" disabled={loading}>Filtrar</button>
            <button className="button-secondary" type="button" onClick={clearFilters} disabled={loading || (!hasFilters && !Object.values(filters).some((value) => value.trim()))}>Limpiar</button>
          </div>
          {filterError && <p className="rooms-filters-error" role="alert">{filterError}</p>}
        </form>

        {loading ? (
          <div className="receptionist-empty-state" role="status">Cargando historial…</div>
        ) : error ? (
          <div className="receptionist-empty-state"><strong>No fue posible cargar el historial</strong><p>{error}</p></div>
        ) : visibleItems.length === 0 ? (
          <div className="receptionist-empty-state">
            <strong>{hasFilters ? 'Ningún consumo coincide' : 'Aún no hay consumos liquidados'}</strong>
            <p>{hasFilters ? 'Prueba con otro rango o limpia los filtros.' : 'Los consumos aparecerán aquí cuando recepción liquide las estancias.'}</p>
          </div>
        ) : (
          <div className="receptionist-table-wrap">
            <table className="receptionist-table rooms-table">
              <thead>
                <tr>
                  <th scope="col">Fecha de pago</th>
                  <th scope="col">Producto o servicio</th>
                  <th scope="col">Habitación y huésped</th>
                  <th scope="col">Cantidad</th>
                  <th scope="col">Precio unitario</th>
                  <th scope="col">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {visibleItems.map((item) => (
                  <tr key={item.id}>
                    <td>{formatDate(item.paidAt)}{item.receiptNumber && <span className="room-description">{item.receiptNumber}</span>}</td>
                    <td><strong>{item.description}</strong></td>
                    <td>{item.roomNumber}<span className="room-description">{item.guestName}</span></td>
                    <td>{item.quantity}</td>
                    <td>{formatCurrency(item.unitPrice)}</td>
                    <td><strong>{formatCurrency(item.subtotal)}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  );
}
