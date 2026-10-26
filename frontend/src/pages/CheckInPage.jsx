import { useCallback, useEffect, useState } from 'react';
import { checkInReservation, getPendingCheckIns } from '../services/api.js';

function formatDate(value) {
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
    timeZone: 'UTC',
  }).format(new Date(value));
}

function getErrorMessage(error) {
  return Array.isArray(error.details) && error.details.length
    ? error.details.join('. ')
    : error.message || 'No fue posible completar la operación.';
}

export default function CheckInPage({ token }) {
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [notice, setNotice] = useState(null);
  const [processingId, setProcessingId] = useState('');

  const loadPendingCheckIns = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const response = await getPendingCheckIns(token);
      setReservations(response.data?.reservations || []);
    } catch (error) {
      setLoadError(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadPendingCheckIns();
  }, [loadPendingCheckIns]);

  async function handleCheckIn(reservation) {
    setProcessingId(reservation._id);
    setNotice(null);
    try {
      const response = await checkInReservation(token, reservation._id);
      setNotice({
        tone: 'success',
        text: response.message || `Check-in registrado para ${reservation.guest.fullName}.`,
      });
      await loadPendingCheckIns();
    } catch (error) {
      setNotice({ tone: 'error', text: getErrorMessage(error) });
    } finally {
      setProcessingId('');
    }
  }

  return (
    <section className="rooms-page check-in-page" aria-labelledby="check-in-title">
      <div className="rooms-heading">
        <div>
          <p className="eyebrow">OPERACIÓN DE RECEPCIÓN</p>
          <h1 id="check-in-title">Registrar check-in</h1>
          <p className="intro">
            Confirma la identidad del huésped y registra su ingreso para marcar la habitación como ocupada.
          </p>
        </div>
        <button
          className="button-secondary"
          type="button"
          onClick={loadPendingCheckIns}
          disabled={loading || Boolean(processingId)}
        >
          {loading ? 'Actualizando…' : 'Actualizar lista'}
        </button>
      </div>

      {notice && (
        <div className={`rooms-notice feedback-${notice.tone}`} role="status" aria-live="polite">
          {notice.text}
        </div>
      )}
      {loadError && (
        <div className="rooms-notice feedback-error" role="alert">
          {loadError}
        </div>
      )}

      {loading ? (
        <div className="module-placeholder" role="status">Cargando ingresos programados…</div>
      ) : reservations.length ? (
        <div className="check-in-list">
          {reservations.map((reservation) => (
            <article className="check-in-card" key={reservation._id}>
              <div className="check-in-card-heading">
                <div>
                  <p className="eyebrow">INGRESO PROGRAMADO</p>
                  <h2>{reservation.guest.fullName}</h2>
                  <p>{reservation.guest.identification} · {reservation.guest.phone}</p>
                </div>
                <span className="status-badge">Reservación confirmada</span>
              </div>
              <dl className="check-in-details">
                <div><dt>Habitación</dt><dd>{reservation.roomNumber} · {reservation.roomType}</dd></div>
                <div><dt>Check-in programado</dt><dd>{formatDate(reservation.checkIn)}</dd></div>
                <div><dt>Check-out</dt><dd>{formatDate(reservation.checkOut)}</dd></div>
                <div><dt>Correo</dt><dd>{reservation.guest.email}</dd></div>
              </dl>
              <div className="check-in-card-footer">
                <p>Al confirmar, la reservación y la habitación cambiarán a estado ocupado.</p>
                <button
                  className="button-primary"
                  type="button"
                  onClick={() => handleCheckIn(reservation)}
                  disabled={Boolean(processingId)}
                >
                  {processingId === reservation._id ? 'Registrando ingreso…' : 'Confirmar check-in'}
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : !loadError ? (
        <div className="reservation-empty-state check-in-empty-state">
          No hay reservaciones programadas para ingresar hoy.
        </div>
      ) : null}
    </section>
  );
}
