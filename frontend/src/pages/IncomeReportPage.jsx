import { useState } from 'react';
import { getIncomeReport } from '../services/api.js';

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
  if (!value) return '—';
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function formatCurrency(value) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function getErrorMessage(error) {
  return Array.isArray(error.details) && error.details.length
    ? error.details.join('. ')
    : error.message || 'No fue posible generar el reporte de ingresos.';
}

export default function IncomeReportPage({ token }) {
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
      const response = await getIncomeReport(token, { startDate, endDate });
      setReport(response.data || null);
    } catch (loadError) {
      setReport(null);
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }

  const totals = report?.totals || {};
  const summary = report ? [
    { label: 'Alojamiento', value: totals.accommodation, detail: 'Ingresos por estancias finalizadas' },
    { label: 'Consumos', value: totals.products, detail: 'Productos registrados en las estancias' },
    { label: 'Cargos adicionales', value: totals.additionalCharges, detail: 'Otros cargos incluidos al cierre' },
    { label: 'Total recaudado', value: totals.collected, detail: `${report.settlementCount} ${report.settlementCount === 1 ? 'liquidación pagada' : 'liquidaciones pagadas'}` },
  ] : [];

  return (
    <section className="rooms-page occupancy-report-page income-report-page" aria-labelledby="income-report-title">
      <div className="rooms-heading">
        <div>
          <p className="eyebrow">REPORTES</p>
          <h1 id="income-report-title">Reporte de ingresos y consumos</h1>
          <p className="intro">Consolida los ingresos por alojamiento, venta de productos y otros cargos del periodo.</p>
        </div>
      </div>

      <form className="reservation-filter-card occupancy-report-filter" onSubmit={generateReport}>
        <label className="form-field" htmlFor="income-start-date">
          <span className="field-label">Desde</span>
          <input
            className="form-input"
            id="income-start-date"
            type="date"
            value={startDate}
            onChange={(event) => {
              setStartDate(event.target.value);
              setReport(null);
            }}
            required
          />
        </label>
        <label className="form-field" htmlFor="income-end-date">
          <span className="field-label">Hasta</span>
          <input
            className="form-input"
            id="income-end-date"
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
            Periodo del {formatDate(report.startDate)} al {formatDate(report.endDate)} · {report.settlementCount} {report.settlementCount === 1 ? 'liquidación pagada' : 'liquidaciones pagadas'}
          </div>

      <section className="occupancy-report-summary income-report-summary" aria-label="Resumen de ingresos">
            {summary.map((item) => (
              <article className="occupancy-report-metric income-report-metric" key={item.label}>
                <span className="card-kicker">{item.label.toUpperCase()}</span>
                <strong>{formatCurrency(item.value)}</strong>
                <p>{item.detail}</p>
              </article>
            ))}
          </section>

          <p className="occupancy-report-definition">
            El periodo se determina por la fecha de pago. Las reservaciones pendientes o canceladas no se incluyen; el total recaudado refleja las liquidaciones pagadas.
          </p>

          <section className="receptionist-list-card reservation-list-card occupancy-report-list" aria-label="Detalle de pagos">
            <div className="receptionist-list-heading">
              <div>
                <span className="card-kicker">LIQUIDACIONES PAGADAS EN EL PERIODO</span>
                <h2>Detalle de ingresos</h2>
              </div>
              <span className="reservation-result-count">{report.settlements.length} {report.settlements.length === 1 ? 'pago' : 'pagos'}</span>
            </div>

            {report.settlements.length ? (
              <div className="receptionist-table-wrap">
                <table className="receptionist-table reservations-table occupancy-report-table income-report-table">
                  <thead>
                    <tr>
                      <th scope="col">Fecha de pago</th>
                      <th scope="col">Huésped / habitación</th>
                      <th scope="col">Alojamiento</th>
                      <th scope="col">Productos</th>
                      <th scope="col">Otros cargos</th>
                      <th scope="col">Recaudado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.settlements.map((settlement) => (
                      <tr key={settlement.id}>
                        <td data-label="Fecha de pago">{formatDateTime(settlement.paidAt)}</td>
                        <td data-label="Huésped / habitación">
                          <span className="reservation-guest-cell">
                            <strong>{settlement.guestName}</strong>
                            <span>Habitación {settlement.roomNumber} · {settlement.roomType}</span>
                          </span>
                        </td>
                        <td data-label="Alojamiento">{formatCurrency(settlement.accommodation)}</td>
                        <td data-label="Productos">{formatCurrency(settlement.products)}</td>
                        <td data-label="Otros cargos">{formatCurrency(settlement.additionalCharges)}</td>
                        <td data-label="Recaudado"><strong>{formatCurrency(settlement.collected)}</strong></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="occupancy-report-empty">No hay pagos registrados en este periodo.</p>
            )}
          </section>

        </>
      )}
    </section>
  );
}
