import { useState } from 'react';
import {
  ReportDateForm,
  ReportHeading,
  ReportMetrics,
  StatusPill,
  formatLongDate,
  formatShortDate,
  formatTime,
  plural,
  todayDateOnly,
  useReceptionReport,
} from '../components/ReceptionReport.jsx';
import { getArrivalsReport } from '../services/api.js';

export default function ArrivalsReportPage({ token, onNavigate }) {
  const today = todayDateOnly();
  const [requestedDate, setRequestedDate] = useState(today);
  const { report, loading, error, reload } = useReceptionReport(
    () => getArrivalsReport(token, requestedDate),
    requestedDate,
    'No fue posible generar el reporte de llegadas.',
  );

  const summary = report?.summary;
  const isToday = report?.date === today;
  const metrics = summary ? [
    { label: 'Llegadas programadas', value: summary.expected, detail: plural(summary.expected, 'reserva con check-in en la fecha', 'reservas con check-in en la fecha') },
    { label: 'Check-in realizados', value: summary.checkedIn, detail: 'Huéspedes que ya ingresaron' },
    {
      label: 'Pendientes',
      value: summary.pending,
      detail: 'Huéspedes por llegar',
      action: isToday && summary.pending > 0 && onNavigate
        ? { label: 'Registrar check-in', onClick: () => onNavigate('reception-check-in') }
        : null,
    },
  ] : [];

  return (
    <section className="rooms-page occupancy-report-page daily-report-page" aria-labelledby="reception-report-title">
      <ReportHeading title="Llegadas programadas" intro="Huéspedes con check-in previsto en la fecha y si ya ingresaron." />

      <ReportDateForm
        id="arrivals-report-date"
        requestedDate={requestedDate}
        onChange={setRequestedDate}
        onReload={reload}
        loading={loading}
        error={error}
      />

      {loading && !report ? (
        <div className="receptionist-empty-state" role="status">Generando reporte…</div>
      ) : report && (
        <>
          <div className="occupancy-report-range" role="status" aria-live="polite">
            Llegadas del {formatLongDate(report.date)}{isToday ? ' (hoy)' : ''}
          </div>

          <ReportMetrics label="Resumen de llegadas" metrics={metrics} />

          <section className="receptionist-list-card reservation-list-card occupancy-report-list" aria-label="Detalle de llegadas">
            <div className="receptionist-list-heading">
              <div>
                <span className="card-kicker">CHECK-IN PROGRAMADOS</span>
                <h2>Llegadas</h2>
              </div>
              <span className="reservation-result-count">{plural(report.arrivals.length, 'llegada', 'llegadas')}</span>
            </div>
            {report.arrivals.length ? (
              <div className="receptionist-table-wrap">
                <table className="receptionist-table reservations-table daily-report-table">
                  <thead>
                    <tr>
                      <th scope="col">Habitación</th>
                      <th scope="col">Huésped</th>
                      <th scope="col">Estadía</th>
                      <th scope="col">Hora de ingreso</th>
                      <th scope="col">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.arrivals.map((arrival) => (
                      <tr key={arrival.id}>
                        <td data-label="Habitación">{arrival.roomNumber} · {arrival.roomType}</td>
                        <td data-label="Huésped">
                          <span className="reservation-guest-cell">
                            <strong>{arrival.guestName}</strong>
                            {arrival.guestPhone && <span>{arrival.guestPhone}</span>}
                          </span>
                        </td>
                        <td data-label="Estadía">{plural(arrival.nights, 'noche', 'noches')} · sale {formatShortDate(arrival.plannedCheckOut)}</td>
                        <td data-label="Hora de ingreso">{formatTime(arrival.checkInAt)}</td>
                        <td data-label="Estado">
                          {arrival.status === 'registrada'
                            ? <StatusPill tone="active">Check-in hecho</StatusPill>
                            : <StatusPill tone="warning">Pendiente</StatusPill>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="occupancy-report-empty">No hay llegadas programadas para este día.</p>
            )}
          </section>

          <p className="occupancy-report-definition">Las reservaciones canceladas no se incluyen.</p>
        </>
      )}
    </section>
  );
}
