import { useState } from 'react';
import {
  ReportDateForm,
  ReportHeading,
  ReportMetrics,
  StatusPill,
  formatCurrency,
  formatLongDate,
  formatShortDate,
  formatTime,
  plural,
  todayDateOnly,
  useReceptionReport,
} from '../components/ReceptionReport.jsx';
import { getDeparturesReport } from '../services/api.js';

export default function DeparturesReportPage({ token, onNavigate }) {
  const today = todayDateOnly();
  const [requestedDate, setRequestedDate] = useState(today);
  const { report, loading, error, reload } = useReceptionReport(
    () => getDeparturesReport(token, requestedDate),
    requestedDate,
    'No fue posible generar el reporte de salidas.',
  );

  const summary = report?.summary;
  const isToday = report?.date === today;
  const metrics = summary ? [
    { label: 'Salidas previstas', value: summary.expected, detail: plural(summary.expected, 'estancia que termina en la fecha', 'estancias que terminan en la fecha') },
    { label: 'Check-out realizados', value: summary.completed, detail: 'Estancias pagadas y cerradas' },
    {
      label: 'Pendientes',
      value: summary.pending,
      detail: 'Huéspedes que aún no han salido',
      action: isToday && summary.pending > 0 && onNavigate
        ? { label: 'Registrar check-out', onClick: () => onNavigate('reception-check-out') }
        : null,
    },
  ] : [];

  return (
    <section className="rooms-page occupancy-report-page daily-report-page" aria-labelledby="reception-report-title">
      <ReportHeading title="Salidas previstas" intro="Huéspedes con check-out en la fecha y si ya pagaron y salieron." />

      <ReportDateForm
        id="departures-report-date"
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
            Salidas del {formatLongDate(report.date)}{isToday ? ' (hoy)' : ''}
          </div>

          <ReportMetrics label="Resumen de salidas" metrics={metrics} />

          <section className="receptionist-list-card reservation-list-card occupancy-report-list" aria-label="Detalle de salidas">
            <div className="receptionist-list-heading">
              <div>
                <span className="card-kicker">CHECK-OUT DEL DÍA</span>
                <h2>Salidas</h2>
              </div>
              <span className="reservation-result-count">{plural(report.departures.length, 'salida', 'salidas')}</span>
            </div>
            {report.departures.length ? (
              <div className="receptionist-table-wrap">
                <table className="receptionist-table reservations-table daily-report-table">
                  <thead>
                    <tr>
                      <th scope="col">Habitación</th>
                      <th scope="col">Huésped</th>
                      <th scope="col">Estadía</th>
                      <th scope="col">Hora de salida</th>
                      <th scope="col">Pagado</th>
                      <th scope="col">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.departures.map((departure) => (
                      <tr key={departure.id}>
                        <td data-label="Habitación">{departure.roomNumber} · {departure.roomType}</td>
                        <td data-label="Huésped">
                          <span className="reservation-guest-cell">
                            <strong>{departure.guestName}</strong>
                            {departure.guestPhone && <span>{departure.guestPhone}</span>}
                          </span>
                        </td>
                        <td data-label="Estadía">{formatShortDate(departure.checkIn)} – {formatShortDate(departure.plannedCheckOut)}</td>
                        <td data-label="Hora de salida">{formatTime(departure.checkOutAt)}</td>
                        <td data-label="Pagado">{departure.paidAmount == null ? '—' : formatCurrency(departure.paidAmount)}</td>
                        <td data-label="Estado">
                          {departure.status === 'realizada'
                            ? <StatusPill tone="active">Check-out hecho</StatusPill>
                            : <StatusPill tone="warning">Pendiente</StatusPill>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="occupancy-report-empty">No hay salidas previstas para este día.</p>
            )}
          </section>

          <p className="occupancy-report-definition">
            Incluye las estancias con salida prevista en la fecha y las que hicieron check-out ese día, aunque estuviera previsto para otra fecha.
          </p>
        </>
      )}
    </section>
  );
}
