import { useState } from 'react';
import { createReservation, getAvailableRooms } from '../services/api.js';

function todayDateOnly() {
  return new Date().toISOString().slice(0, 10);
}

function nextDate(value) {
  if (!value) return todayDateOnly();
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function formatCurrency(value) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value);
}

function getErrorMessage(error, fallback) {
  return Array.isArray(error.details) && error.details.length
    ? error.details.join('. ')
    : error.message || fallback;
}

export default function ReservationsPage({ token, mode = 'create' }) {
  const today = todayDateOnly();
  const [checkIn, setCheckIn] = useState(today);
  const [checkOut, setCheckOut] = useState(nextDate(today));
  const [rooms, setRooms] = useState([]);
  const [searchedRange, setSearchedRange] = useState('');
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [nightlyRate, setNightlyRate] = useState('');
  const [guest, setGuest] = useState({
    fullName: '',
    email: '',
    phone: '',
    identification: '',
  });
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);
  const [receipt, setReceipt] = useState(null);
  const isAvailabilityOnly = mode === 'availability';
  const rangeKey = `${checkIn}|${checkOut}`;
  const selectedRoom = rooms.find((room) => room._id === selectedRoomId);

  function updateDates(field, value) {
    if (field === 'checkIn') {
      setCheckIn(value);
      if (checkOut <= value) setCheckOut(nextDate(value));
    } else {
      setCheckOut(value);
    }
    setRooms([]);
    setSearchedRange('');
    setSelectedRoomId('');
    setNightlyRate('');
    setReceipt(null);
    setNotice(null);
  }

  function updateGuest(event) {
    const { name, value } = event.target;
    setGuest((current) => ({ ...current, [name]: value }));
  }

  function validateDateRange() {
    if (!checkIn || !checkOut) {
      return 'Selecciona las fechas de check-in y check-out.';
    }
    if (checkIn < today) {
      return 'La fecha de check-in no puede estar en el pasado.';
    }
    if (checkOut <= checkIn) {
      return 'El check-out debe ser posterior al check-in.';
    }
    return '';
  }

  async function searchAvailability() {
    const dateError = validateDateRange();
    if (dateError) {
      setNotice({ tone: 'error', text: dateError });
      return false;
    }

    setSearching(true);
    setNotice(null);
    setReceipt(null);
    setSelectedRoomId('');
    setNightlyRate('');
    try {
      const response = await getAvailableRooms(token, { checkIn, checkOut });
      setRooms(response.data?.rooms || []);
      setSearchedRange(rangeKey);
      if (!response.data?.rooms?.length) {
        setNotice({
          tone: 'info',
          text: 'No hay habitaciones disponibles para el periodo seleccionado.',
        });
      }
      return true;
    } catch (error) {
      setRooms([]);
      setSearchedRange('');
      setNotice({
        tone: 'error',
        text: getErrorMessage(error, 'No fue posible consultar la disponibilidad.'),
      });
      return false;
    } finally {
      setSearching(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setNotice(null);

    const dateError = validateDateRange();
    if (dateError) {
      setNotice({ tone: 'error', text: dateError });
      return;
    }
    if (searchedRange !== rangeKey) {
      setNotice({
        tone: 'error',
        text: 'Consulta nuevamente la disponibilidad antes de confirmar la reservación.',
      });
      return;
    }
    if (!selectedRoom) {
      setNotice({ tone: 'error', text: 'Selecciona una habitación disponible.' });
      return;
    }

    const missingFields = [
      ['fullName', 'nombre completo'],
      ['email', 'correo electrónico'],
      ['phone', 'teléfono'],
      ['identification', 'identificación'],
    ]
      .filter(([field]) => !guest[field].trim())
      .map(([, label]) => label);

    if (missingFields.length) {
      setNotice({
        tone: 'error',
        text: `Completa los datos obligatorios del huésped: ${missingFields.join(', ')}.`,
      });
      return;
    }
    if (guest.fullName.trim().length < 2 || guest.fullName.trim().length > 100) {
      setNotice({ tone: 'error', text: 'El nombre completo debe tener entre 2 y 100 caracteres.' });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guest.email.trim())) {
      setNotice({ tone: 'error', text: 'Ingresa un correo válido para el huésped.' });
      return;
    }
    if (guest.phone.trim().length < 7 || guest.phone.trim().length > 25) {
      setNotice({ tone: 'error', text: 'El teléfono debe tener entre 7 y 25 caracteres.' });
      return;
    }
    if (guest.identification.trim().length < 4 || guest.identification.trim().length > 30) {
      setNotice({ tone: 'error', text: 'La identificación debe tener entre 4 y 30 caracteres.' });
      return;
    }

    const rate = Number(nightlyRate);
    if (nightlyRate.trim() === '' || !Number.isFinite(rate) || rate < 0) {
      setNotice({ tone: 'error', text: 'La tarifa por noche debe ser un número mayor o igual a 0.' });
      return;
    }

    setSaving(true);
    try {
      const response = await createReservation(token, {
        guest: {
          fullName: guest.fullName.trim(),
          email: guest.email.trim(),
          phone: guest.phone.trim(),
          identification: guest.identification.trim(),
        },
        roomId: selectedRoom._id,
        checkIn,
        checkOut,
        nightlyRate: rate,
      });
      setReceipt(response.data?.receipt || null);
      setSelectedRoomId('');
      setNightlyRate('');
      setNotice({
        tone: 'success',
        text: response.message || 'La reservación se confirmó correctamente.',
      });

      try {
        const availability = await getAvailableRooms(token, { checkIn, checkOut });
        setRooms(availability.data?.rooms || []);
        setSearchedRange(rangeKey);
      } catch (refreshError) {
        setNotice({
          tone: 'success',
          text: `La reservación se guardó, pero no se pudo actualizar la disponibilidad: ${getErrorMessage(refreshError, 'error desconocido')}`,
        });
      }
    } catch (error) {
      setNotice({
        tone: 'error',
        text: getErrorMessage(error, 'No fue posible guardar la reservación.'),
      });
      if (error.status === 409) {
        try {
          const availability = await getAvailableRooms(token, { checkIn, checkOut });
          setRooms(availability.data?.rooms || []);
          setSearchedRange(rangeKey);
          setSelectedRoomId('');
          setNightlyRate('');
        } catch (refreshError) {
          setNotice({
            tone: 'error',
            text: `${getErrorMessage(error, 'La habitación ya no está disponible.')}. No se pudo actualizar la disponibilidad: ${getErrorMessage(refreshError, 'error desconocido')}`,
          });
        }
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rooms-page reservations-page" aria-labelledby="reservations-title">
      <div className="rooms-heading">
        <div>
          <p className="eyebrow">{isAvailabilityOnly ? 'DISPONIBILIDAD' : 'GESTIÓN DE ESTADÍAS'}</p>
          <h1 id="reservations-title">{isAvailabilityOnly ? 'Consultar disponibilidad' : 'Nueva reservación'}</h1>
          <p className="intro">
            {isAvailabilityOnly
              ? 'Verifica qué habitaciones están libres en el rango de fechas indicado.'
              : 'Selecciona fechas y habitación; la disponibilidad se confirma nuevamente al guardar.'}
          </p>
        </div>
      </div>

      {notice && (
        <div className={`rooms-notice feedback-${notice.tone}`} role="status" aria-live="polite">
          {notice.text}
        </div>
      )}

      {receipt && (
        <section className="reservation-receipt" aria-labelledby="receipt-title" role="status">
          <p className="eyebrow">CONFIRMACIÓN</p>
          <h2 id="receipt-title">Reservación registrada</h2>
          <dl>
            <div><dt>Huésped</dt><dd>{receipt.guest.fullName}</dd></div>
            <div><dt>Habitación</dt><dd>{receipt.roomNumber} · {receipt.roomType}</dd></div>
            <div><dt>Check-in</dt><dd>{receipt.checkIn.slice(0, 10)}</dd></div>
            <div><dt>Check-out</dt><dd>{receipt.checkOut.slice(0, 10)}</dd></div>
            <div><dt>Noches</dt><dd>{receipt.nights}</dd></div>
            <div><dt>Tarifa por noche</dt><dd>{formatCurrency(receipt.nightlyRate)}</dd></div>
            <div><dt>Total</dt><dd>{formatCurrency(receipt.totalAmount)}</dd></div>
          </dl>
        </section>
      )}

      <form className="receptionist-form-card" onSubmit={handleSubmit} noValidate>
        <div className="receptionist-form-heading">
          <div>
            <h2>Periodo de estadía</h2>
            <p>El check-out no bloquea la habitación para una nueva entrada ese mismo día.</p>
          </div>
        </div>

        <div className="receptionist-form-grid reservation-date-grid">
          <label className="form-field">
            <span className="field-label">Check-in *</span>
            <input
              className="form-input"
              type="date"
              min={today}
              value={checkIn}
              onChange={(event) => updateDates('checkIn', event.target.value)}
              required
            />
          </label>
          <label className="form-field">
            <span className="field-label">Check-out *</span>
            <input
              className="form-input"
              type="date"
              min={nextDate(checkIn)}
              value={checkOut}
              onChange={(event) => updateDates('checkOut', event.target.value)}
              required
            />
          </label>
        </div>

        <div className="receptionist-form-footer reservation-search-footer">
          <p>Consulta la disponibilidad para comprobar los conflictos de ocupación.</p>
          <button
            className="button-secondary"
            type="button"
            onClick={searchAvailability}
            disabled={searching || saving}
          >
            {searching ? 'Buscando…' : 'Buscar habitaciones'}
          </button>
        </div>

        {searchedRange === rangeKey && (
          <section className="reservation-available-rooms" aria-labelledby="available-rooms-title">
            <h2 id="available-rooms-title">Habitaciones disponibles</h2>
            {rooms.length ? (
              <div className="reservation-room-list">
                {rooms.map((room) => (
                  <button
                    className={`reservation-room-option${selectedRoomId === room._id ? ' is-selected' : ''}`}
                    type="button"
                    key={room._id}
                    onClick={() => {
                      setSelectedRoomId(room._id);
                      setNightlyRate(String(room.price));
                      setNotice(null);
                    }}
                    aria-pressed={selectedRoomId === room._id}
                  >
                    <span>
                      <strong>Habitación {room.number}</strong>
                      <span>{room.type}{room.capacity ? ` · Capacidad: ${room.capacity}` : ''}</span>
                    </span>
                    <strong>{formatCurrency(room.price)} / noche</strong>
                  </button>
                ))}
              </div>
            ) : (
              <p className="reservation-empty-state">No hay habitaciones disponibles para estas fechas.</p>
            )}
          </section>
        )}

        {!isAvailabilityOnly && selectedRoom && (
          <>
            <div className="receptionist-form-heading reservation-guest-heading">
              <div>
                <h2>Datos del huésped</h2>
                <p>Todos los campos son obligatorios para confirmar la reservación.</p>
              </div>
            </div>
            <div className="receptionist-form-grid">
              <label className="form-field">
                <span className="field-label">Nombre completo *</span>
                <input className="form-input" name="fullName" value={guest.fullName} onChange={updateGuest} maxLength="100" required />
              </label>
              <label className="form-field">
                <span className="field-label">Correo electrónico *</span>
                <input className="form-input" type="email" name="email" value={guest.email} onChange={updateGuest} maxLength="254" required />
              </label>
              <label className="form-field">
                <span className="field-label">Teléfono *</span>
                <input className="form-input" type="tel" name="phone" value={guest.phone} onChange={updateGuest} minLength="7" maxLength="25" required />
              </label>
              <label className="form-field">
                <span className="field-label">Identificación *</span>
                <input className="form-input" name="identification" value={guest.identification} onChange={updateGuest} minLength="4" maxLength="30" required />
              </label>
              <label className="form-field">
                <span className="field-label">Tarifa aplicada por noche (COP) *</span>
                <input
                  className="form-input"
                  type="number"
                  name="nightlyRate"
                  min="0"
                  step="0.01"
                  value={nightlyRate}
                  onChange={(event) => setNightlyRate(event.target.value)}
                  required
                />
              </label>
            </div>
            <div className="receptionist-form-footer">
              <p>La habitación se reservará para el periodo seleccionado si sigue disponible al confirmar.</p>
              <button className="button-primary" type="submit" disabled={saving || searching}>
                {saving ? 'Guardando…' : 'Confirmar reservación'}
              </button>
            </div>
          </>
        )}
      </form>
    </section>
  );
}
