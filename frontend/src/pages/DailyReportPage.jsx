import { useState } from 'react';
import {
  ReportDateForm,
  ReportHeading,
  ReportMetrics,
  formatCurrency,
  formatLongDate,
  formatTime,
  plural,
  todayDateOnly,
  useReceptionReport,
} from '../components/ReceptionReport.jsx';
import { getDailyReport } from '../services/api.js';

const PAYMENT_METHOD_LABELS = {
  efectivo: 'Efectivo',
  tarjeta: 'Tarjeta',
  transferencia: 'Transferencia',
};

export default function DailyReportPage({ token, onNavigate }) {
  const today = todayDateOnly();
  const [requestedDate, setRequestedDate] = useState(today);
  const { report, loading, error, reload } = useReceptionReport(
    () => getDailyReport(token, requestedDate),
    requestedDate,
    'No fue posible generar el reporte diario.',
  );

  const summary = report?.summary;
  const isToday = report?.date === today;
  const metrics = summary ? [
    {
      label: 'Llegadas',
      value: summary.arrivalsExpected,
      detail: `${summary.arrivalsCheckedIn} con check-in · ${summary.arrivalsPending} pendientes`,
      action: isToday && onNavigate ? { label: 'Ver llegadas', onClick: () => onNavigate('reception-reports-arrivals') } : null,
    },
    {
      label: 'Salidas',
      value: summary.departuresExpected,
      detail: `${summary.departuresCompleted} realizadas · ${summary.departuresPending} pendientes`,
      action: isToday && onNavigate ? { label: 'Ver salidas', onClick: () => onNavigate('reception-reports-departures') } : null,
    },
    {
      label: 'Ocupación',
      value: `${summary.occupancyRate}%`,
      detail: `${summary.occupiedRooms} de ${summary.totalRooms} habitaciones ocupadas en el día`,
      action: isToday && onNavigate ? { label: 'Ver ocupación actual', onClick: () => onNavigate('reception-reports-occupancy') } : null,
    },
    {
      label: 'Recaudado',
      value: formatCurrency(summary.collected),
      detail: `${plural(summary.paymentsCount, 'pago registrado', 'pagos registrados')}`,
    },
    {
      label: 'Consumos',
      value: formatCurrency(summary.consumptionsTotal),
      detail: plural(summary.consumptionsCount, 'consumo cargado', 'consumos cargados'),
    },
    {
      label: 'Reservas nuevas',
      value: summary.newReservations,
      detail: plural(summary.cancellations, 'cancelación', 'cancelaciones'),
    },
  ] : [];

  return (
    <section className="rooms-page occupancy-report-page daily-report-page" aria-labelledby="reception-report-title">
      <ReportHeading title="Reporte diario" intro="Resumen de la jornada: movimiento de huéspedes, ocupación y caja." />

      <ReportDateForm
        id="daily-report-date"
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
            Jornada del {formatLongDate(report.date)}{isToday ? ' (hoy)' : ''}
          </div>

          <ReportMetrics label="Resumen del día" metrics={metrics} />

          <section className="receptionist-list-card reservation-list-card occupancy-report-list" aria-label="Pagos del día">
            <div className="receptionist-list-heading">
              <div>
                <span className="card-kicker">CAJA</span>
                <h2>Pagos recibidos</h2>
              </div>
              <span className="reservation-result-count">Total {formatCurrency(summary.collected)}</span>
            </div>
            <dl className="daily-report-methods">
              {Object.entries(report.payments.byMethod).map(([method, amount]) => (
                <div key={method}>
                  <dt>{PAYMENT_METHOD_LABELS[method] || method}</dt>
                  <dd>{formatCurrency(amount)}</dd>
                </div>
              ))}
            </dl>
            {report.payments.items.length ? (
              <div className="receptionist-table-wrap">
                <table className="receptionist-table reservations-table daily-report-table">
                  <thead>
                    <tr>
                      <th scope="col">Hora</th>
                      <th scope="col">Huésped / habitación</th>
                      <th scope="col">Método</th>
                      <th scope="col">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.payments.items.map((payment) => (
                      <tr key={payment.id}>
                        <td data-label="Hora">{formatTime(payment.paidAt)}</td>
                        <td data-label="Huésped / habitación">{payment.guestName} · Hab. {payment.roomNumber}</td>
                        <td data-label="Método">{PAYMENT_METHOD_LABELS[payment.method] || payment.method}</td>
                        <td data-label="Valor"><strong>{formatCurrency(payment.amount)}</strong></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="occupancy-report-empty">No se registraron pagos este día.</p>
            )}
          </section>

          <section className="receptionist-list-card reservation-list-card occupancy-report-list" aria-label="Cancelaciones del día">
            <div className="receptionist-list-heading">
              <div>
                <span className="card-kicker">RESERVAS</span>
                <h2>Cancelaciones</h2>
              </div>
              <span className="reservation-result-count">{plural(report.cancellations.length, 'cancelación', 'cancelaciones')}</span>
            </div>
            {report.cancellations.length ? (
              <div className="receptionist-table-wrap">
                <table className="receptionist-table reservations-table daily-report-table">
                  <thead>
                    <tr>
                      <th scope="col">Hora</th>
                      <th scope="col">Huésped / habitación</th>
                      <th scope="col">Motivo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.cancellations.map((cancellation) => (
                      <tr key={cancellation.id}>
                        <td data-label="Hora">{formatTime(cancellation.canceledAt)}</td>
                        <td data-label="Huésped / habitación">{cancellation.guestName} · Hab. {cancellation.roomNumber}</td>
                        <td data-label="Motivo" className="daily-report-reason">{cancellation.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="occupancy-report-empty">No hubo cancelaciones este día.</p>
            )}
          </section>

          <p className="occupancy-report-definition">
            La ocupación cuenta las habitaciones con un huésped alojado en algún momento del día. Los consumos anulados no se incluyen.
          </p>
        </>
      )}
    </section>
  );
}
