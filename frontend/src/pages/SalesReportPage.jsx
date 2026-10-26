import { useState } from 'react';
import { getSalesReport } from '../services/api.js';

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
    : error.message || 'No fue posible generar el reporte de ventas.';
}

export default function SalesReportPage({ token }) {
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
      const response = await getSalesReport(token, { startDate, endDate });
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
    { label: 'Ingresos por ventas', value: formatCurrency(totals.revenue), detail: 'Consumos cobrados en liquidaciones pagadas' },
    { label: 'Unidades vendidas', value: totals.quantity, detail: 'Productos registrados en el periodo' },
    { label: 'Productos distintos', value: totals.productCount, detail: 'Referencias agrupadas por nombre registrado' },
  ] : [];

  return (
    <section className="rooms-page occupancy-report-page sales-report-page" aria-labelledby="sales-report-title">
      <div className="rooms-heading">
        <div>
          <p className="eyebrow">REPORTES</p>
          <h1 id="sales-report-title">Ventas de productos</h1>
          <p className="intro">Consulta las cantidades y los ingresos de productos vendidos en las estancias.</p>
        </div>
      </div>

      <form className="reservation-filter-card occupancy-report-filter" onSubmit={generateReport}>
        <label className="form-field" htmlFor="sales-start-date">
          <span className="field-label">Desde</span>
          <input
            className="form-input"
            id="sales-start-date"
            type="date"
            value={startDate}
            onChange={(event) => {
              setStartDate(event.target.value);
              setReport(null);
            }}
            required
          />
        </label>
        <label className="form-field" htmlFor="sales-end-date">
          <span className="field-label">Hasta</span>
          <input
            className="form-input"
            id="sales-end-date"
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

          <section className="occupancy-report-summary sales-report-summary" aria-label="Resumen de ventas">
            {summary.map((item) => (
              <article className="occupancy-report-metric sales-report-metric" key={item.label}>
                <span className="card-kicker">{item.label.toUpperCase()}</span>
                <strong>{item.value}</strong>
                <p>{item.detail}</p>
              </article>
            ))}
          </section>

          <p className="occupancy-report-definition">
            El periodo se determina por la fecha de pago de la liquidación. Los productos se agrupan por el nombre registrado al momento de la venta.
          </p>

          <section className="receptionist-list-card reservation-list-card occupancy-report-list" aria-label="Detalle de productos vendidos">
            <div className="receptionist-list-heading">
              <div>
                <span className="card-kicker">CONSUMOS COBRADOS EN EL PERIODO</span>
                <h2>Detalle por producto</h2>
              </div>
              <span className="reservation-result-count">{report.products.length} {report.products.length === 1 ? 'producto' : 'productos'}</span>
            </div>

            {report.products.length ? (
              <div className="receptionist-table-wrap">
                <table className="receptionist-table reservations-table occupancy-report-table income-report-table">
                  <thead>
                    <tr>
                      <th scope="col">Producto</th>
                      <th scope="col">Unidades vendidas</th>
                      <th scope="col">Ingresos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.products.map((product) => (
                      <tr key={product.description}>
                        <td data-label="Producto"><strong>{product.description}</strong></td>
                        <td data-label="Unidades vendidas">{product.quantity}</td>
                        <td data-label="Ingresos"><strong>{formatCurrency(product.total)}</strong></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="occupancy-report-empty">No se registraron ventas de productos en este periodo.</p>
            )}
          </section>
        </>
      )}
    </section>
  );
}
