import { useState } from 'react';
import { getOccupancyReport } from '../services/api.js';

function todayDateOnly() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(value) {
  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function formatDateTime(value) {
  if (!value) return 'Estancia en curso';
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function getErrorMessage(error) {
  return Array.isArray(error.details) && error.details.length
    ? error.details.join('. ')
    : error.message || 'No fue posible generar el reporte de ocupación.';
}

function RoomReportTable({ title, kicker, rooms, emptyMessage, occupied = false }) {
  return (
    <section className="receptionist-list-card reservation-list-card occupancy-report-list" aria-label={title}>
      <div className="receptionist-list-heading">
        <div>
          <span className="card-kicker">{kicker}</span>
          <h2>{title}</h2>
        </div>
        <span className="reservation-result-count">{rooms.length} {rooms.length === 1 ? 'habitación' : 'habitaciones'}</span>
      </div>

      {rooms.length ? (
        <div className="receptionist-table-wrap">
          <table className="receptionist-table reservations-table occupancy-report-table">
            <thead>
              <tr>
                <th scope="col">Habitación</th>
                <th scope="col">Tipo</th>
                {occupied && <th scope="col">Check-in</th>}
                {occupied && <th scope="col">Salida</th>}
                {!occupied && <th scope="col">Capacidad</th>}
              </tr>
            </thead>
            <tbody>
              {rooms.map((room) => (
                <tr key={room.id}>
                  <td data-label="Habitación"><strong>{room.number}</strong></td>
                  <td data-label="Tipo">{room.type}</td>
                  {occupied && (
                    <>
                      <td data-label="Check-in">
                        {room.stays.map((stay) => formatDateTime(stay.checkInAt)).join(' · ')}
                      </td>
                      <td data-label="Salida">
                        {room.stays.map((stay) => formatDateTime(stay.checkOutAt)).join(' · ')}
                      </td>
                    </>
                  )}
                  {!occupied && <td data-label="Capacidad">{room.capacity ? `${room.capacity} personas` : '—'}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="occupancy-report-empty">{emptyMessage}</p>
      )}
    </section>
  );
}

export default function OccupancyReportPage({ token }) {
  const today = todayDateOnly();
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function generateReport(event) {
    event.preventDefault();
    setError('');

    if (!startDate || !endDate) {
      setError('Selecciona las fechas inicial y final del reporte.');
      return;
    }
    if (endDate < startDate) {
      setError('La fecha final debe ser igual o posterior a la fecha inicial.');
      return;
    }

    setLoading(true);
    try {
      const response = await getOccupancyReport(token, { startDate, endDate });
      setReport(response.data || null);
    } catch (loadError) {
      setReport(null);
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }

  const summary = report ? [
    { label: 'Ocupadas', count: report.occupiedRooms.length, detail: 'Con check-in registrado' },
    { label: 'Disponibles', count: report.availableRooms.length, detail: 'Libres durante el intervalo' },
    { label: 'Reservadas', count: report.reservedRooms.length, detail: 'Sin check-in registrado' },
    { label: 'No disponibles', count: report.unavailableRooms.length, detail: 'Estado actual impide asignación' },
  ] : [];

  return (
    <section className="rooms-page occupancy-report-page" aria-labelledby="occupancy-report-title">
      <div className="rooms-heading">
        <div>
          <p className="eyebrow">REPORTES</p>
          <h1 id="occupancy-report-title">Reporte de ocupación</h1>
          <p className="intro">Consulta las habitaciones ocupadas y disponibles en un intervalo de fechas.</p>
        </div>
      </div>

      <form className="reservation-filter-card occupancy-report-filter" onSubmit={generateReport}>
        <label className="form-field" htmlFor="occupancy-start-date">
          <span className="field-label">Desde</span>
          <input
            className="form-input"
            id="occupancy-start-date"
            type="date"
            value={startDate}
            onChange={(event) => {
              setStartDate(event.target.value);
              setReport(null);
            }}
            required
          />
        </label>
        <label className="form-field" htmlFor="occupancy-end-date">
          <span className="field-label">Hasta</span>
          <input
            className="form-input"
            id="occupancy-end-date"
            type="date"
            value={endDate}
            onChange={(event) => {
              setEndDate(event.target.value);
              setReport(null);
            }}
            min={startDate || undefined}
            required
          />
        </label>
        <button className="button-primary occupancy-report-submit" type="submit" disabled={loading}>
          {loading ? 'Generando…' : 'Generar reporte'}
        </button>
        {error && <p className="rooms-filters-error" role="alert">{error}</p>}
      </form>

      {report && (
        <>
          <div className="occupancy-report-range" role="status" aria-live="polite">
            Periodo del {formatDate(report.startDate)} al {formatDate(report.endDate)} · {report.totalRooms} {report.totalRooms === 1 ? 'habitación en el inventario' : 'habitaciones en el inventario'}
          </div>

          <section className="occupancy-report-summary" aria-label="Resumen del reporte">
            {summary.map((item) => (
              <article className="occupancy-report-metric" key={item.label}>
                <span className="card-kicker">{item.label.toUpperCase()}</span>
                <strong>{item.count}</strong>
                <p>{item.detail}</p>
              </article>
            ))}
          </section>

          <p className="occupancy-report-definition">
            Las habitaciones reservadas sin check-in se muestran aparte y no se cuentan como ocupadas ni disponibles.
          </p>

          <RoomReportTable
            title="Habitaciones ocupadas"
            kicker="ESTANCIAS CON CHECK-IN QUE SE CRUZAN CON EL PERIODO"
            rooms={report.occupiedRooms}
            emptyMessage="No hay estancias con check-in registrado que se crucen con este intervalo."
            occupied
          />
          <RoomReportTable
            title="Habitaciones disponibles"
            kicker="LIBRES PARA EL INTERVALO"
            rooms={report.availableRooms}
            emptyMessage="No hay habitaciones disponibles durante este intervalo."
          />
        </>
      )}
    </section>
  );
}
