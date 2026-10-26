import { useState } from 'react';
import { getAvailableRooms } from '../services/api.js';

const ROOM_TYPES = ['Sencilla', 'Doble', 'Triple', 'Familiar', 'Suite'];
const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

function todayDateOnly() {
  return new Date().toISOString().slice(0, 10);
}

function nextDate(value) {
  if (!value) return todayDateOnly();
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function countNights(checkIn, checkOut) {
  return Math.round(
    (new Date(`${checkOut}T00:00:00.000Z`) - new Date(`${checkIn}T00:00:00.000Z`)) / DAY_IN_MILLISECONDS,
  );
}

function formatDate(value) {
  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00.000Z`));
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

function validateSearch(search, today) {
  if (!search.checkIn || !search.checkOut) {
    return 'Selecciona las fechas de check-in y check-out.';
  }
  if (search.checkIn < today) {
    return 'La fecha de check-in no puede estar en el pasado.';
  }
  if (search.checkOut <= search.checkIn) {
    return 'El check-out debe ser posterior al check-in.';
  }

  const guests = search.guests.trim();
  if (guests && (!Number.isInteger(Number(guests)) || Number(guests) < 1)) {
    return 'El número de huéspedes debe ser un entero mayor o igual a 1.';
  }

  const maxPrice = search.maxPrice.trim();
  if (maxPrice && !(Number(maxPrice) >= 0)) {
    return 'El precio máximo debe ser un número mayor o igual a 0.';
  }

  return '';
}

export default function AvailabilityPage({ token, canReserve = false, onNavigate }) {
  const today = todayDateOnly();
  const [search, setSearch] = useState({
    checkIn: today,
    checkOut: nextDate(today),
    type: '',
    guests: '',
    maxPrice: '',
  });
  const [rooms, setRooms] = useState([]);
  const [result, setResult] = useState(null);
  const [searching, setSearching] = useState(false);
  const [notice, setNotice] = useState(null);

  function updateField(event) {
    const { name, value } = event.target;
    setSearch((current) => {
      const next = { ...current, [name]: value };
      if (name === 'checkIn' && next.checkOut <= value) next.checkOut = nextDate(value);
      return next;
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const error = validateSearch(search, today);
    if (error) {
      setNotice({ tone: 'error', text: error });
      return;
    }

    setSearching(true);
    setNotice(null);
    try {
      const response = await getAvailableRooms(token, search);
      setRooms(response.data?.rooms || []);
      // Se guarda la búsqueda realizada para que el resumen no cambie mientras se editan los campos.
      setResult({ ...search, nights: countNights(search.checkIn, search.checkOut) });
    } catch (requestError) {
      setRooms([]);
      setResult(null);
      setNotice({
        tone: 'error',
        text: getErrorMessage(requestError, 'No fue posible consultar la disponibilidad.'),
      });
    } finally {
      setSearching(false);
    }
  }

  const hasFilters = Boolean(result && (result.type || result.guests.trim() || result.maxPrice.trim()));

  return (
    <section className="rooms-page reservations-page" aria-labelledby="availability-title">
      <div className="rooms-heading">
        <div>
          <p className="eyebrow">DISPONIBILIDAD</p>
          <h1 id="availability-title">Consultar disponibilidad</h1>
          <p className="intro">Verifica qué habitaciones están libres para un periodo y las necesidades del huésped.</p>
        </div>
        {canReserve && (
          <button className="button-secondary" type="button" onClick={() => onNavigate?.('reception-reservations-create')}>
            Nueva reservación
          </button>
        )}
      </div>

      {notice && (
        <div className={`rooms-notice feedback-${notice.tone}`} role="status" aria-live="polite">
          {notice.text}
        </div>
      )}

      <form className="receptionist-form-card" onSubmit={handleSubmit} noValidate>
        <div className="receptionist-form-heading">
          <div>
            <h2>Criterios de búsqueda</h2>
            <p>Las fechas son obligatorias. El día de check-out no bloquea la habitación para una nueva entrada.</p>
          </div>
        </div>

        <div className="receptionist-form-grid availability-search-grid">
          <label className="form-field" htmlFor="availability-check-in">
            <span className="field-label">Check-in *</span>
            <input
              className="form-input"
              id="availability-check-in"
              name="checkIn"
              type="date"
              min={today}
              value={search.checkIn}
              onChange={updateField}
              required
            />
          </label>
          <label className="form-field" htmlFor="availability-check-out">
            <span className="field-label">Check-out *</span>
            <input
              className="form-input"
              id="availability-check-out"
              name="checkOut"
              type="date"
              min={nextDate(search.checkIn)}
              value={search.checkOut}
              onChange={updateField}
              required
            />
          </label>
          <label className="form-field" htmlFor="availability-type">
            <span className="field-label">Tipo de habitación</span>
            <select
              className="form-input"
              id="availability-type"
              name="type"
              value={search.type}
              onChange={updateField}
            >
              <option value="">Todos</option>
              {ROOM_TYPES.map((type) => <option value={type} key={type}>{type}</option>)}
            </select>
          </label>
          <label className="form-field" htmlFor="availability-guests">
            <span className="field-label">Huéspedes</span>
            <input
              className="form-input"
              id="availability-guests"
              name="guests"
              type="number"
              min="1"
              step="1"
              placeholder="Ej. 2"
              value={search.guests}
              onChange={updateField}
            />
          </label>
          <label className="form-field" htmlFor="availability-max-price">
            <span className="field-label">Precio máximo por noche</span>
            <input
              className="form-input"
              id="availability-max-price"
              name="maxPrice"
              type="number"
              min="0"
              step="any"
              placeholder="Sin límite"
              value={search.maxPrice}
              onChange={updateField}
            />
          </label>
        </div>

        <div className="receptionist-form-footer">
          <p>Se excluyen las habitaciones en mantenimiento, limpieza, desinfección, fuera de servicio o con reservas que se crucen.</p>
          <button className="button-primary" type="submit" disabled={searching}>
            {searching ? 'Consultando…' : 'Consultar disponibilidad'}
          </button>
        </div>
      </form>

      {result && (
        <section className="receptionist-list-card" aria-labelledby="availability-results-title">
          <div className="receptionist-list-heading">
            <div>
              <span className="card-kicker">RESULTADOS</span>
              <h2 id="availability-results-title">Habitaciones disponibles</h2>
            </div>
            <p className="availability-summary" role="status">
              {rooms.length === 1 ? '1 habitación' : `${rooms.length} habitaciones`}
              {' · '}
              {result.nights === 1 ? '1 noche' : `${result.nights} noches`}
              {' · '}
              {formatDate(result.checkIn)} – {formatDate(result.checkOut)}
            </p>
          </div>

          {rooms.length === 0 ? (
            <div className="receptionist-empty-state">
              <strong>No hay habitaciones disponibles</strong>
              <p>
                {hasFilters
                  ? 'Ninguna habitación libre cumple los criterios. Prueba con otro tipo, menos huéspedes o un precio mayor.'
                  : 'Todas las habitaciones están reservadas o fuera de operación para estas fechas. Prueba con otro periodo.'}
              </p>
            </div>
          ) : (
            <div className="receptionist-table-wrap">
              <table className="receptionist-table rooms-table">
                <thead>
                  <tr>
                    <th scope="col">Número</th>
                    <th scope="col">Tipo y descripción</th>
                    <th scope="col">Capacidad</th>
                    <th scope="col">Tarifa por noche</th>
                    <th scope="col">Total estimado</th>
                  </tr>
                </thead>
                <tbody>
                  {rooms.map((room) => (
                    <tr key={room._id}>
                      <td>{room.number}</td>
                      <td>
                        <strong>{room.type}</strong>
                        {room.description && <span className="room-description">{room.description}</span>}
                      </td>
                      <td>{room.capacity ? `${room.capacity} personas` : '—'}</td>
                      <td>{formatCurrency(room.price)}</td>
                      <td>
                        <strong>{formatCurrency(room.price * result.nights)}</strong>
                        <span className="room-description">
                          {result.nights === 1 ? '1 noche' : `${result.nights} noches`}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </section>
  );
}
