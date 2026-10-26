import { useEffect, useState } from 'react';

// Piezas compartidas por los reportes de recepción (diario, llegadas, salidas y ocupación actual).

export function todayDateOnly() {
  return new Date().toISOString().slice(0, 10);
}

export function formatLongDate(value) {
  return new Intl.DateTimeFormat('es-CO', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(value.length === 10 ? `${value}T00:00:00.000Z` : value));
}

export function formatShortDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(value));
}

export function formatTime(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('es-CO', { timeStyle: 'short' }).format(new Date(value));
}

export function formatCurrency(value) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function getErrorMessage(error, fallback) {
  return Array.isArray(error.details) && error.details.length
    ? error.details.join('. ')
    : error.message || fallback;
}

// Carga un reporte y lo vuelve a pedir cuando cambia la fecha o se fuerza una recarga.
export function useReceptionReport(load, date, errorFallback) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let isCurrent = true;
    setLoading(true);
    setError('');

    load()
      .then((response) => {
        if (isCurrent) setReport(response.data || null);
      })
      .catch((loadError) => {
        if (isCurrent) {
          setReport(null);
          setError(getErrorMessage(loadError, errorFallback));
        }
      })
      .finally(() => {
        if (isCurrent) setLoading(false);
      });

    return () => {
      isCurrent = false;
    };
    // `load` cambia en cada render; la fecha y la recarga son lo que define una nueva consulta.
  }, [date, reloadKey]);

  return { report, loading, error, reload: () => setReloadKey((current) => current + 1) };
}

export function ReportDateForm({ id, requestedDate, onChange, onReload, loading, error }) {
  const today = todayDateOnly();
  const [date, setDate] = useState(requestedDate);

  function apply(nextDate) {
    if (nextDate === requestedDate) onReload();
    else onChange(nextDate);
  }

  return (
    <form
      className="reservation-filter-card occupancy-report-filter daily-report-filter"
      onSubmit={(event) => {
        event.preventDefault();
        if (date) apply(date);
      }}
    >
      <label className="form-field" htmlFor={id}>
        <span className="field-label">Fecha</span>
        <input
          className="form-input"
          id={id}
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
          required
        />
      </label>
      <button
        className="button-secondary occupancy-report-submit"
        type="button"
        onClick={() => {
          setDate(today);
          apply(today);
        }}
        disabled={loading}
      >
        Hoy
      </button>
      <button className="button-primary occupancy-report-submit" type="submit" disabled={loading || !date}>
        {loading ? 'Generando…' : 'Generar reporte'}
      </button>
      {error && <p className="rooms-filters-error" role="alert">{error}</p>}
    </form>
  );
}

export function ReportHeading({ title, intro }) {
  return (
    <div className="rooms-heading">
      <div>
        <p className="eyebrow">REPORTES DE RECEPCIÓN</p>
        <h1 id="reception-report-title">{title}</h1>
        <p className="intro">{intro}</p>
      </div>
    </div>
  );
}

export function ReportMetrics({ label, metrics }) {
  return (
    <section className="occupancy-report-summary daily-report-summary" aria-label={label}>
      {metrics.map((item) => (
        <article className="occupancy-report-metric daily-report-metric" key={item.label}>
          <span className="card-kicker">{item.label.toUpperCase()}</span>
          <strong>{item.value}</strong>
          <p>{item.detail}</p>
          {item.action && (
            <button className="daily-report-metric-link" type="button" onClick={item.action.onClick}>
              {item.action.label} →
            </button>
          )}
        </article>
      ))}
    </section>
  );
}

export function StatusPill({ tone, children }) {
  return (
    <span className={`receptionist-status receptionist-status-${tone}`}>
      <span aria-hidden="true" />
      {children}
    </span>
  );
}

export function plural(count, singular, pluralForm) {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}
