import { useEffect, useState } from 'react';
import { createReservation, getAvailableRooms } from '../services/api.js';

const EMPTY_FORM = {
  fullName: '',
  email: '',
  phone: '',
  identification: '',
  roomId: '',
  checkIn: '',
  checkOut: '',
  nightlyRate: '',
};

function formatDate(dateValue) {
  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(dateValue));
}

function formatCurrency(value) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 2,
  }).format(value);
}

export default function ReservationsPage({ token }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [rooms, setRooms] = useState([]);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [availabilityError, setAvailabilityError] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);
  const [receipt, setReceipt] = useState(null);

  useEffect(() => {
    if (!form.checkIn || !form.checkOut || form.checkOut <= form.checkIn) {
      setRooms([]);
      setAvailabilityError('');
      setLoadingRooms(false);
      return undefined;
    }

    let isCurrent = true;
    setLoadingRooms(true);
    setAvailabilityError('');
    setRooms([]);

    getAvailableRooms(token, form.checkIn, form.checkOut)
      .then((response) => {
        if (isCurrent) setRooms(response.data?.rooms || []);
      })
      .catch((error) => {
        if (isCurrent) setAvailabilityError(error.message || 'No fue posible consultar la disponibilidad.');
      })
      .finally(() => {
        if (isCurrent) setLoadingRooms(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [form.checkIn, form.checkOut, token]);

  function updateField(event) {
    const { name, value } = event.target;
    setNotice(null);
    if (name === 'roomId') {
      const room = rooms.find((item) => item._id === value);
      setForm((current) => ({
        ...current,
        roomId: value,
        nightlyRate: room ? String(room.price) : '',
      }));
      return;
    }

    setForm((current) => ({
      ...current,
      [name]: value,
      ...(name === 'checkIn' || name === 'checkOut' ? { roomId: '', nightlyRate: '' } : {}),
    }));
  }

  function clearDates() {
    setForm(EMPTY_FORM);
    setRooms([]);
    setReceipt(null);
    setNotice(null);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setNotice(null);

    const requiredFields = [
      ['fullName', 'nombre completo del huésped'],
      ['email', 'correo electrónico del huésped'],
      ['phone', 'teléfono del huésped'],
      ['identification', 'identificación del huésped'],
      ['roomId', 'habitación disponible'],
      ['checkIn', 'fecha de check-in'],
      ['checkOut', 'fecha de check-out'],
      ['nightlyRate', 'tarifa aplicada'],
    ];
    const missingFields = requiredFields
      .filter(([name]) => !String(form[name]).trim())
      .map(([, label]) => label);

    if (missingFields.length) {
      setNotice({
        tone: 'error',
        text: `Completa los siguientes datos obligatorios: ${missingFields.join(', ')}.`,
      });
      return;
    }

    if (form.checkOut <= form.checkIn) {
      setNotice({ tone: 'error', text: 'El check-out debe ser posterior al check-in.' });
      return;
    }

    const nightlyRate = Number(form.nightlyRate);
    if (!Number.isFinite(nightlyRate) || nightlyRate < 0) {
      setNotice({ tone: 'error', text: 'La tarifa debe ser un número mayor o igual a cero.' });
      return;
    }

    const selectedRoom = rooms.find((room) => room._id === form.roomId);
    if (!selectedRoom) {
      setNotice({
        tone: 'error',
        text: 'La habitación ya no está disponible para esas fechas. Consulta nuevamente la disponibilidad.',
      });
      return;
    }

    setSaving(true);
    try {
      const response = await createReservation(token, {
        guest: {
          fullName: form.fullName.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          identification: form.identification.trim(),
        },
        roomId: form.roomId,
        checkIn: form.checkIn,
        checkOut: form.checkOut,
        nightlyRate,
      });
      setReceipt(response.data?.receipt || null);
      setForm(EMPTY_FORM);
      setRooms([]);
      setNotice({
        tone: 'success',
        text: response.message || 'La reservación se confirmó correctamente.',
      });
    } catch (error) {
      const details = Array.isArray(error.details) ? error.details : [];
      setNotice({
        tone: 'error',
        text: details.length
          ? details.join('. ')
          : error.message || 'No fue posible confirmar la reservación.',
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="reservations-page" aria-labelledby="reservation-title">
      <div className="reservations-heading">
        <div>
          <p className="eyebrow">GESTIÓN DE ESTADÍAS</p>
          <h1 id="reservation-title">Nueva reservación</h1>
          <p className="intro">Registra los datos del huésped, las fechas y la tarifa confirmada.</p>
        </div>
      </div>

      {notice && (
        <div className={`reservation-notice feedback-${notice.tone}`} role="status" aria-live="polite">
          {notice.text}
        </div>
      )}

      {receipt ? (
        <article className="reservation-receipt" aria-labelledby="receipt-title">
          <div className="reservation-receipt-heading">
            <span className="reservation-receipt-mark" aria-hidden="true">✓</span>
            <div>
              <span className="card-kicker">RESERVACIÓN CONFIRMADA</span>
              <h2 id="receipt-title">Comprobante de reservación</h2>
              <p>Guarda el número de confirmación para futuras consultas.</p>
            </div>
          </div>
          <dl className="reservation-receipt-grid">
            <div><dt>Confirmación</dt><dd>{receipt.reservationId}</dd></div>
            <div><dt>Huésped</dt><dd>{receipt.guest.fullName}</dd></div>
            <div><dt>Habitación</dt><dd>{receipt.roomNumber} · {receipt.roomType}</dd></div>
            <div><dt>Estadía</dt><dd>{formatDate(receipt.checkIn)} — {formatDate(receipt.checkOut)}</dd></div>
            <div><dt>Noches</dt><dd>{receipt.nights}</dd></div>
            <div><dt>Tarifa por noche</dt><dd>{formatCurrency(receipt.nightlyRate)}</dd></div>
            <div className="reservation-receipt-total"><dt>Total</dt><dd>{formatCurrency(receipt.totalAmount)}</dd></div>
          </dl>
          <button className="button-primary" type="button" onClick={clearDates}>
            Registrar otra reservación
          </button>
        </article>
      ) : (
        <form className="receptionist-form-card" onSubmit={handleSubmit} noValidate>
          <div className="receptionist-form-heading">
            <div>
              <span className="card-kicker">DATOS DE LA ESTADÍA</span>
              <h2>Información del huésped y la habitación</h2>
              <p>Completa la información del huésped y selecciona fechas para consultar habitaciones disponibles.</p>
            </div>
            <span className="account-role-pill">NUEVA RESERVA</span>
          </div>

          <div className="reservation-form-section">
            <span className="card-kicker">HUÉSPED</span>
            <div className="receptionist-form-grid">
              <label className="form-field" htmlFor="reservation-guest-name">
                <span className="field-label">Nombre completo *</span>
                <input
                  className="form-input"
                  id="reservation-guest-name"
                  name="fullName"
                  autoComplete="name"
                  minLength={2}
                  maxLength={100}
                  value={form.fullName}
                  onChange={updateField}
                  required
                  disabled={saving}
                />
              </label>
              <label className="form-field" htmlFor="reservation-guest-email">
                <span className="field-label">Correo electrónico *</span>
                <input
                  className="form-input"
                  id="reservation-guest-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={form.email}
                  onChange={updateField}
                  required
                  disabled={saving}
                />
              </label>
              <label className="form-field" htmlFor="reservation-guest-phone">
                <span className="field-label">Teléfono *</span>
                <input
                  className="form-input"
                  id="reservation-guest-phone"
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  minLength={7}
                  maxLength={25}
                  value={form.phone}
                  onChange={updateField}
                  required
                  disabled={saving}
                />
              </label>
              <label className="form-field" htmlFor="reservation-guest-identification">
                <span className="field-label">Identificación *</span>
                <input
                  className="form-input"
                  id="reservation-guest-identification"
                  name="identification"
                  maxLength={30}
                  value={form.identification}
                  onChange={updateField}
                  required
                  disabled={saving}
                />
              </label>
            </div>
          </div>

          <div className="reservation-form-section">
            <span className="card-kicker">HABITACIÓN Y FECHAS</span>
            <div className="receptionist-form-grid">
              <label className="form-field" htmlFor="reservation-check-in">
                <span className="field-label">Check-in *</span>
                <input
                  className="form-input"
                  id="reservation-check-in"
                  name="checkIn"
                  type="date"
                  value={form.checkIn}
                  onChange={updateField}
                  required
                  disabled={saving}
                />
              </label>
              <label className="form-field" htmlFor="reservation-check-out">
                <span className="field-label">Check-out *</span>
                <input
                  className="form-input"
                  id="reservation-check-out"
                  name="checkOut"
                  type="date"
                  value={form.checkOut}
                  onChange={updateField}
                  required
                  disabled={saving}
                />
              </label>
              <label className="form-field" htmlFor="reservation-room">
                <span className="field-label">Habitación disponible *</span>
                <select
                  className="form-input"
                  id="reservation-room"
                  name="roomId"
                  value={form.roomId}
                  onChange={updateField}
                  required
                  disabled={saving || loadingRooms || !form.checkIn || !form.checkOut || !rooms.length}
                >
                  <option value="">
                    {loadingRooms
                      ? 'Consultando disponibilidad…'
                      : rooms.length
                        ? 'Selecciona una habitación'
                        : 'No hay habitaciones para esas fechas'}
                  </option>
                  {rooms.map((room) => (
                    <option value={room._id} key={room._id}>
                      {room.number} · {room.type} · {formatCurrency(room.price)} por noche
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-field" htmlFor="reservation-nightly-rate">
                <span className="field-label">Tarifa aplicada por noche *</span>
                <input
                  className="form-input"
                  id="reservation-nightly-rate"
                  name="nightlyRate"
                  type="number"
                  min="0"
                  step="any"
                  value={form.nightlyRate}
                  onChange={updateField}
                  required
                  disabled={saving || !form.roomId}
                />
                <span className="profile-field-hint">La tarifa inicial corresponde al precio registrado para la habitación.</span>
              </label>
            </div>
            {form.checkIn && form.checkOut && form.checkOut <= form.checkIn && (
              <p className="reservation-inline-error" role="alert">El check-out debe ser posterior al check-in.</p>
            )}
            {availabilityError && <p className="reservation-inline-error" role="alert">{availabilityError}</p>}
            {!loadingRooms && !availabilityError && form.checkIn && form.checkOut && form.checkOut > form.checkIn && !rooms.length && (
              <p className="reservation-inline-error" role="status">No hay habitaciones disponibles para el periodo seleccionado.</p>
            )}
          </div>

          {form.roomId && form.checkIn && form.checkOut > form.checkIn && Number(form.nightlyRate) >= 0 && (
            <div className="reservation-total-preview" aria-live="polite">
              <span>Total estimado · {(new Date(`${form.checkOut}T00:00:00Z`) - new Date(`${form.checkIn}T00:00:00Z`)) / 86400000} noches</span>
              <strong>{formatCurrency(
                Math.round(
                  Number(form.nightlyRate)
                  * ((new Date(`${form.checkOut}T00:00:00Z`) - new Date(`${form.checkIn}T00:00:00Z`)) / 86400000)
                  * 100
                ) / 100
              )}</strong>
            </div>
          )}

          <div className="receptionist-form-footer">
            <p>La disponibilidad se verifica y bloquea para las fechas seleccionadas al confirmar.</p>
            <button className="button-primary" type="submit" disabled={saving || loadingRooms}>
              {saving ? 'Confirmando reservación…' : 'Confirmar reservación'}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
