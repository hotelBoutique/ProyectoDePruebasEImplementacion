import { useState } from 'react';
import {
  ReportHeading,
  ReportMetrics,
  StatusPill,
  formatShortDate,
  plural,
  useReceptionReport,
} from '../components/ReceptionReport.jsx';
import { getCurrentOccupancyReport } from '../services/api.js';

const STATE_FILTERS = [
  { value: '', label: 'Todas' },
  { value: 'ocupada', label: 'Ocupadas' },
  { value: 'disponible', label: 'Disponibles' },
  { value: 'fuera de operación', label: 'Fuera de operación' },
];

const ROOM_STATUS_LABELS = {
  mantenimiento: 'Mantenimiento',
  'fuera de servicio': 'Fuera de servicio',
  limpieza: 'En limpieza',
  desinfeccion: 'En desinfección',
};

function formatGeneratedAt(value) {
  return new Intl.DateTimeFormat('es-CO', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(value));
}

function RoomState({ room }) {
  if (room.state === 'ocupada') {
    return room.overdue
      ? <StatusPill tone="inactive">Ocupada · salida vencida</StatusPill>
      : <StatusPill tone="warning">Ocupada</StatusPill>;
  }
  if (room.state === 'disponible') {
    return <StatusPill tone="active">{room.arrivingToday ? 'Disponible · llega hoy' : 'Disponible'}</StatusPill>;
  }
  return <StatusPill tone="inactive">{ROOM_STATUS_LABELS[room.roomStatus] || room.roomStatus}</StatusPill>;
}

function RoomDetail({ room }) {
  if (room.state === 'ocupada') {
    if (!room.guestName) return 'Sin estancia activa registrada';
    return `${room.guestName} · sale ${formatShortDate(room.plannedCheckOut)}`;
  }
  if (room.arrivingToday) return `Reserva de ${room.arrivingToday} con llegada hoy`;
  return '—';
}

export default function CurrentOccupancyPage({ token }) {
  const [refreshKey, setRefreshKey] = useState(0);
  const [stateFilter, setStateFilter] = useState('');
  const { report, loading, error } = useReceptionReport(
    () => getCurrentOccupancyReport(token),
    refreshKey,
    'No fue posible consultar la ocupación actual.',
  );

  const summary = report?.summary;
  const metrics = summary ? [
    { label: 'Ocupación', value: `${summary.occupancyRate}%`, detail: `${summary.occupied} de ${summary.totalRooms} habitaciones` },
    { label: 'Disponibles', value: summary.available, detail: plural(summary.arrivingToday, 'con llegada hoy', 'con llegada hoy') },
    {
      label: 'Fuera de operación',
      value: summary.outOfService,
      detail: summary.overdue
        ? `${plural(summary.overdue, 'habitación', 'habitaciones')} con salida vencida`
        : 'Mantenimiento, limpieza o fuera de servicio',
    },
  ] : [];
  const rooms = (report?.rooms || []).filter((room) => !stateFilter || room.state === stateFilter);

  return (
    <section className="rooms-page occupancy-report-page daily-report-page" aria-labelledby="reception-report-title">
      <ReportHeading title="Ocupación actual" intro="Estado de cada habitación en este momento." />

      <div className="reservation-filter-card occupancy-report-filter current-occupancy-toolbar">
        <label className="form-field" htmlFor="current-occupancy-filter">
          <span className="field-label">Mostrar</span>
          <select
            className="form-input"
            id="current-occupancy-filter"
            value={stateFilter}
            onChange={(event) => setStateFilter(event.target.value)}
          >
            {STATE_FILTERS.map((filter) => (
              <option value={filter.value} key={filter.value}>{filter.label}</option>
            ))}
          </select>
        </label>
        <button
          className="button-primary occupancy-report-submit"
          type="button"
          onClick={() => setRefreshKey((current) => current + 1)}
          disabled={loading}
        >
          {loading ? 'Actualizando…' : 'Actualizar'}
        </button>
        {error && <p className="rooms-filters-error" role="alert">{error}</p>}
      </div>

      {loading && !report ? (
        <div className="receptionist-empty-state" role="status">Consultando ocupación…</div>
      ) : report && (
        <>
          <div className="occupancy-report-range" role="status" aria-live="polite">
            Actualizado el {formatGeneratedAt(report.generatedAt)}
          </div>

          <ReportMetrics label="Resumen de ocupación" metrics={metrics} />

          <section className="receptionist-list-card reservation-list-card occupancy-report-list" aria-label="Estado de las habitaciones">
            <div className="receptionist-list-heading">
              <div>
                <span className="card-kicker">HABITACIONES</span>
                <h2>Estado actual</h2>
              </div>
              <span className="reservation-result-count">{plural(rooms.length, 'habitación', 'habitaciones')}</span>
            </div>
            {rooms.length ? (
              <div className="receptionist-table-wrap">
                <table className="receptionist-table reservations-table daily-report-table">
                  <thead>
                    <tr>
                      <th scope="col">Habitación</th>
                      <th scope="col">Estado</th>
                      <th scope="col">Detalle</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rooms.map((room) => (
                      <tr key={room.id}>
                        <td data-label="Habitación">
                          {room.roomNumber} · {room.roomType}
                          {room.capacity ? <span className="room-description">{room.capacity} personas</span> : null}
                        </td>
                        <td data-label="Estado"><RoomState room={room} /></td>
                        <td data-label="Detalle" className="daily-report-reason"><RoomDetail room={room} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="occupancy-report-empty">
                {report.rooms.length ? 'Ninguna habitación está en ese estado ahora.' : 'Aún no hay habitaciones registradas.'}
              </p>
            )}
          </section>
        </>
      )}
    </section>
  );
}
