import { useEffect, useState } from 'react';
import {
  getArrivalsReport,
  getCurrentOccupancyReport,
  getDailyReport,
  getDeparturesReport,
  getIncomeReport,
  getProducts,
  getReceptionists,
  getSalesReport,
} from '../services/api.js';

function todayDateOnly() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(value) {
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'full',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function formatCurrency(value) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function countLabel(value, singular, plural = `${singular}s`) {
  return `${value} ${value === 1 ? singular : plural}`;
}

function responseData(result) {
  return result.status === 'fulfilled' ? result.value?.data || null : null;
}

function StatCard({ label, value, detail, tone = 'neutral', action }) {
  return (
    <article className={`dashboard-stat-card dashboard-stat-${tone}`}>
      <span className="dashboard-stat-label">{label}</span>
      <strong>{value}</strong>
      <p>{detail}</p>
      {action && (
        <button className="dashboard-text-action" type="button" onClick={action.onClick}>
          {action.label}<span aria-hidden="true"> →</span>
        </button>
      )}
    </article>
  );
}

function AgendaCard({ title, kicker, entries, loading, error, emptyMessage, onOpen, actionLabel }) {
  return (
    <section className="dashboard-panel dashboard-agenda-card" aria-label={title}>
      <div className="dashboard-panel-heading">
        <div>
          <span className="card-kicker">{kicker}</span>
          <h2>{title}</h2>
        </div>
        {onOpen && <button className="dashboard-text-action" type="button" onClick={onOpen}>{actionLabel}<span aria-hidden="true"> →</span></button>}
      </div>
      {loading && !entries ? (
        <p className="dashboard-panel-message" role="status">Cargando agenda…</p>
      ) : error && !entries ? (
        <p className="dashboard-panel-message dashboard-panel-error">No fue posible consultar estos datos.</p>
      ) : entries?.length ? (
        <ul className="dashboard-agenda-list">
          {entries.slice(0, 4).map((entry) => (
            <li key={entry.id}>
              <span className="dashboard-agenda-room">{entry.roomNumber}</span>
              <span className="dashboard-agenda-guest">
                <strong>{entry.guestName || 'Huésped sin nombre'}</strong>
                <small>{entry.roomType || 'Habitación'}{entry.nights ? ` · ${countLabel(entry.nights, 'noche')}` : ''}</small>
              </span>
              <span className={`dashboard-agenda-status${entry.isDone ? ' dashboard-agenda-status-done' : ''}`}>
                {entry.isDone ? 'Realizado' : 'Pendiente'}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="dashboard-panel-message">{emptyMessage}</p>
      )}
    </section>
  );
}

export default function DashboardHome({ user, isAdmin, token, onNavigate }) {
  const today = todayDateOnly();
  const firstOfMonth = `${today.slice(0, 7)}-01`;
  const [refreshKey, setRefreshKey] = useState(0);
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const firstName = user?.name?.trim().split(/\s+/)[0] || 'equipo';

  useEffect(() => {
    let isCurrent = true;
    setLoading(true);
    setLoadError(false);

    const requests = [
      getDailyReport(token, today),
      getCurrentOccupancyReport(token),
      getArrivalsReport(token, today),
      getDeparturesReport(token, today),
      getProducts(token),
    ];
    if (isAdmin) {
      requests.push(
        getIncomeReport(token, { startDate: firstOfMonth, endDate: today }),
        getSalesReport(token, { startDate: firstOfMonth, endDate: today }),
        getReceptionists(token),
      );
    }

    Promise.allSettled(requests).then((results) => {
      if (!isCurrent) return;
      const [daily, occupancy, arrivals, departures, products, income, sales, receptionists] = results;
      const nextData = {
        daily: responseData(daily),
        occupancy: responseData(occupancy),
        arrivals: responseData(arrivals),
        departures: responseData(departures),
        products: products.status === 'fulfilled' ? products.value?.data?.products || null : null,
        income: isAdmin ? responseData(income) : null,
        sales: isAdmin ? responseData(sales) : null,
        receptionists: isAdmin && receptionists.status === 'fulfilled'
          ? receptionists.value?.data?.users || null
          : null,
      };
      const coreReports = [nextData.daily, nextData.occupancy, nextData.arrivals, nextData.departures];
      setDashboardData(nextData);
      setLoadError(!coreReports.some(Boolean));
      setLoading(false);
    });

    return () => {
      isCurrent = false;
    };
  }, [token, today, firstOfMonth, isAdmin, refreshKey]);

  const daily = dashboardData?.daily;
  const occupancy = dashboardData?.occupancy;
  const arrivals = dashboardData?.arrivals;
  const departures = dashboardData?.departures;
  const dailySummary = daily?.summary;
  const occupancySummary = occupancy?.summary;
  const roomRate = occupancySummary?.occupancyRate;
  const roomTotal = occupancySummary?.totalRooms;
  const pendingArrivals = arrivals?.summary?.pending;
  const pendingDepartures = departures?.summary?.pending;
  const arrivalRows = arrivals?.arrivals?.map((item) => ({
    id: item.id,
    roomNumber: item.roomNumber,
    roomType: item.roomType,
    guestName: item.guestName,
    nights: item.nights,
    isDone: item.status === 'registrada',
  }));
  const departureRows = departures?.departures?.map((item) => ({
    id: item.id,
    roomNumber: item.roomNumber,
    roomType: item.roomType,
    guestName: item.guestName,
    isDone: item.status === 'realizada',
  }));
  const products = dashboardData?.products;
  const activeProducts = products?.filter((product) => product.isActive !== false) || [];
  const lowStockCount = activeProducts.filter((product) => Number(product.stock) <= 5).length;
  const receptionists = dashboardData?.receptionists;
  const activeReceptionists = receptionists?.filter((person) => person.isActive).length;

  function openModule(itemId) {
    if (onNavigate && itemId) onNavigate(itemId);
  }

  return (
    <section className="dashboard-home" aria-labelledby="dashboard-title">
      <div className="dashboard-heading dashboard-home-heading">
        <div>
          <p className="eyebrow">{isAdmin ? 'RESUMEN DE OPERACIÓN' : 'OPERACIÓN DE RECEPCIÓN'}</p>
          <h1 id="dashboard-title">Hola, {firstName}.</h1>
          <p className="intro">Así va el hotel hoy:</p>
        </div>
        <div className="dashboard-home-tools">
          <span className="dashboard-date-pill">{formatDate(today)}</span>
          <button
            className="dashboard-refresh-button"
            type="button"
            onClick={() => setRefreshKey((value) => value + 1)}
            disabled={loading}
          >
            <span aria-hidden="true">↻</span>{loading ? 'Actualizando…' : 'Actualizar'}
          </button>
        </div>
      </div>

      {loadError && (
        <div className="dashboard-data-notice" role="alert">
          No fue posible cargar los datos del panel. Comprueba la conexión e inténtalo de nuevo.
        </div>
      )}
      {!loadError && !loading && dashboardData && (
        <p className="dashboard-data-caption">Cifras actualizadas</p>
      )}

      <section className="dashboard-stats-grid" aria-label="Indicadores principales">
        <StatCard
          label="OCUPACIÓN ACTUAL"
          value={roomRate == null ? '—' : `${roomRate}%`}
          detail={occupancySummary ? `${occupancySummary.occupied} de ${roomTotal} habitaciones ocupadas` : 'Dato de ocupación no disponible'}
          tone="primary"
          action={occupancySummary ? { label: 'Ver habitaciones', onClick: () => openModule(isAdmin ? 'reports-occupancy' : 'reception-reports-occupancy') } : null}
        />
        <StatCard
          label="LLEGADAS DE HOY"
          value={arrivals?.summary?.expected ?? '—'}
          detail={pendingArrivals == null ? 'Agenda de llegadas no disponible' : `${pendingArrivals} pendientes de check-in`}
          tone="gold"
          action={arrivals && !isAdmin ? { label: 'Gestionar llegadas', onClick: () => openModule('reception-check-in') } : null}
        />
        <StatCard
          label="SALIDAS DE HOY"
          value={departures?.summary?.expected ?? '—'}
          detail={pendingDepartures == null ? 'Agenda de salidas no disponible' : `${pendingDepartures} pendientes de salida`}
          action={departures && !isAdmin ? { label: 'Gestionar salidas', onClick: () => openModule('reception-check-out') } : null}
        />
        <StatCard
          label="RECAUDO DE HOY"
          value={dailySummary ? formatCurrency(dailySummary.collected) : '—'}
          detail={dailySummary ? countLabel(dailySummary.paymentsCount, 'pago registrado', 'pagos registrados') : 'Dato de caja no disponible'}
          tone="green"
          action={dailySummary && !isAdmin ? { label: 'Ver reporte diario', onClick: () => openModule('reception-reports-daily') } : null}
        />
        <StatCard
          label="CONSUMOS DE HOY"
          value={dailySummary ? formatCurrency(dailySummary.consumptionsTotal) : '—'}
          detail={dailySummary ? countLabel(dailySummary.consumptionsCount, 'consumo registrado', 'consumos registrados') : 'Dato de consumos no disponible'}
          action={dailySummary && !isAdmin ? { label: 'Ver consumos', onClick: () => openModule('reception-consumptions-create') } : null}
        />
        <StatCard
          label="RESERVAS CREADAS HOY"
          value={dailySummary?.newReservations ?? '—'}
          detail={dailySummary ? countLabel(dailySummary.cancellations, 'cancelación hoy', 'cancelaciones hoy') : 'Dato de reservas no disponible'}
          tone="blue"
          action={dailySummary ? { label: 'Abrir reservaciones', onClick: () => openModule(isAdmin ? 'reservations-list' : 'reception-reservations-list') } : null}
        />
      </section>

      <section className="dashboard-overview-grid" aria-label="Detalle de la operación">
        <div className="dashboard-panel dashboard-room-overview">
          <div className="dashboard-panel-heading">
            <div>
              <span className="card-kicker">HABITACIONES</span>
              <h2>Estado actual</h2>
            </div>
            <strong className="dashboard-panel-total">{occupancySummary ? `${occupancySummary.occupied}/${roomTotal}` : '—'}</strong>
          </div>
          {occupancySummary ? (
            <>
              <div className="dashboard-occupancy-bar" aria-label={`${roomRate}% de ocupación`}>
                <span style={{ width: `${Math.min(100, Math.max(0, roomRate || 0))}%` }} />
              </div>
              <div className="dashboard-room-legend">
                <span><i className="legend-occupied" />Ocupadas <strong>{occupancySummary.occupied}</strong></span>
                <span><i className="legend-available" />Disponibles <strong>{occupancySummary.available}</strong></span>
                <span><i className="legend-unavailable" />Fuera de operación <strong>{occupancySummary.outOfService}</strong></span>
              </div>
              <p className="dashboard-panel-footnote">{occupancy?.generatedAt ? `Actualizado ${new Intl.DateTimeFormat('es-CO', { hour: '2-digit', minute: '2-digit' }).format(new Date(occupancy.generatedAt))}` : 'Estado reportado por el módulo de ocupación'}</p>
            </>
          ) : (
            <p className="dashboard-panel-message">No hay datos de ocupación disponibles.</p>
          )}
        </div>

        <div className="dashboard-panel dashboard-activity-panel">
          <div className="dashboard-panel-heading">
            <div>
              <span className="card-kicker">MOVIMIENTO DEL DÍA</span>
              <h2>Actividad registrada</h2>
            </div>
            {daily && <button className="dashboard-text-action" type="button" onClick={() => openModule(isAdmin ? 'reports-income' : 'reception-reports-daily')}>{isAdmin ? 'Ver ingresos' : 'Ver reporte'}<span aria-hidden="true"> →</span></button>}
          </div>
          {dailySummary ? (
            <dl className="dashboard-activity-list">
              <div><dt>Check-ins completados</dt><dd>{dailySummary.arrivalsCheckedIn} <small>/ {dailySummary.arrivalsExpected}</small></dd></div>
              <div><dt>Salidas completadas</dt><dd>{dailySummary.departuresCompleted} <small>/ {dailySummary.departuresExpected}</small></dd></div>
              <div><dt>Pagos procesados</dt><dd>{dailySummary.paymentsCount}</dd></div>
              <div><dt>Cancelaciones</dt><dd>{dailySummary.cancellations}</dd></div>
            </dl>
          ) : (
            <p className="dashboard-panel-message">El reporte diario no está disponible.</p>
          )}
        </div>
      </section>

      <section className="dashboard-agenda-grid" aria-label="Agenda de huéspedes de hoy">
        <AgendaCard
          title="Llegadas"
          kicker="CHECK-IN PROGRAMADOS"
          entries={arrivalRows}
          loading={loading}
          error={!arrivals && !loading}
          emptyMessage="No hay llegadas programadas para hoy."
          onOpen={!isAdmin && arrivals ? () => openModule('reception-check-in') : null}
          actionLabel="Registrar"
        />
        <AgendaCard
          title="Salidas"
          kicker="CHECK-OUT PREVISTOS"
          entries={departureRows}
          loading={loading}
          error={!departures && !loading}
          emptyMessage="No hay salidas previstas para hoy."
          onOpen={!isAdmin && departures ? () => openModule('reception-check-out') : null}
          actionLabel="Liquidar"
        />
      </section>

      <section className="dashboard-module-summary" aria-label="Resumen de módulos">
        <div className="dashboard-section-title">
          <div>
            <span className="card-kicker">MÓDULOS</span>
            <h2>Inventario y gestión</h2>
          </div>
        </div>
        <div className="dashboard-module-grid">
          <button className="dashboard-module-card" type="button" onClick={() => openModule(isAdmin ? 'consumptions-catalog' : 'reception-consumptions-catalog')}>
            <span className="dashboard-module-symbol" aria-hidden="true">◇</span>
            <span><small>CATÁLOGO</small><strong>{products ? activeProducts.length : '—'} productos activos</strong><em>{products ? `${lowStockCount} con existencias de 5 o menos` : 'Inventario no disponible'}</em></span>
            <span className="dashboard-module-arrow" aria-hidden="true">→</span>
          </button>
          {isAdmin && (
            <button className="dashboard-module-card" type="button" onClick={() => openModule('users-list')}>
              <span className="dashboard-module-symbol" aria-hidden="true">♙</span>
              <span><small>EQUIPO DE RECEPCIÓN</small><strong>{receptionists ? countLabel(activeReceptionists, 'cuenta activa', 'cuentas activas') : '—'}</strong><em>{receptionists ? `${receptionists.length} cuentas en total` : 'Usuarios no disponibles'}</em></span>
              <span className="dashboard-module-arrow" aria-hidden="true">→</span>
            </button>
          )}
          {isAdmin && (
            <button className="dashboard-module-card" type="button" onClick={() => openModule('reports-income')}>
              <span className="dashboard-module-symbol" aria-hidden="true">$</span>
              <span><small>INGRESOS DEL MES</small><strong>{dashboardData?.income ? formatCurrency(dashboardData.income.totals?.collected) : '—'}</strong><em>{dashboardData?.income ? countLabel(dashboardData.income.settlementCount, 'liquidación pagada', 'liquidaciones pagadas') : 'Reporte de ingresos no disponible'}</em></span>
              <span className="dashboard-module-arrow" aria-hidden="true">→</span>
            </button>
          )}
          {isAdmin && (
            <button className="dashboard-module-card" type="button" onClick={() => openModule('reports-sales')}>
              <span className="dashboard-module-symbol" aria-hidden="true">↗</span>
              <span><small>VENTAS DEL MES</small><strong>{dashboardData?.sales ? formatCurrency(dashboardData.sales.totals?.revenue) : '—'}</strong><em>{dashboardData?.sales ? `${dashboardData.sales.totals?.quantity || 0} unidades · ${dashboardData.sales.totals?.productCount || 0} referencias` : 'Reporte de ventas no disponible'}</em></span>
              <span className="dashboard-module-arrow" aria-hidden="true">→</span>
            </button>
          )}
        </div>
      </section>
    </section>
  );
}
