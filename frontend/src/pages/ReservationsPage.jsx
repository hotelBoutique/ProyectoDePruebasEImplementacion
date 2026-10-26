import { useEffect, useState } from 'react';
import {
  cancelReservation as cancelReservationRequest,
  createReservation,
  getAvailableRooms,
  getReservation,
  getReservations,
  getRooms,
} from '../services/api.js';

const EMPTY_RESERVATION_FILTERS = {
  checkInFrom: '',
  checkInTo: '',
  roomId: '',
  roomType: '',
  status: '',
};

const PENDING_CANCELLATION_FILTERS = {
  ...EMPTY_RESERVATION_FILTERS,
  status: 'reservada',
};

const ROOM_TYPES = ['Sencilla', 'Doble', 'Triple', 'Familiar', 'Suite'];

const RESERVATION_STATUS_LABELS = {
  reservada: 'Reservada',
  ocupada: 'Ocupada',
  cancelada: 'Cancelada',
  finalizada: 'Finalizada',
};

function todayDateOnly() {
  return new Date().toISOString().slice(0, 10);
}

function nextDate(value) {
  if (!value) return todayDateOnly();
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

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
    maximumFractionDigits: 0,
  }).format(value);
}

function getErrorMessage(error, fallback) {
  return Array.isArray(error.details) && error.details.length
    ? error.details.join('. ')
    : error.message || fallback;
}

export default function ReservationsPage({ token, mode = 'create', onNavigate, canCreate = true }) {
  if (mode === 'list') {
    return <ReservationListPage token={token} canCreate={canCreate} onNavigate={onNavigate} />;
  }
  if (mode === 'cancellations') {
    return <ReservationListPage token={token} mode="cancellations" />;
  }

  return <ReservationCreationPage token={token} mode={mode} onNavigate={onNavigate} />;
}

function ReservationCreationPage({ token, mode = 'create', onNavigate }) {
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
        {!isAvailabilityOnly && (
          <div className="reservation-heading-actions">
            <button className="button-secondary" type="button" onClick={() => onNavigate?.('reception-reservations-list')}>
              Consultar reservaciones
            </button>
          </div>
        )}
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

function ReservationListPage({ token, canCreate, onNavigate, mode = 'list' }) {
  const isCancellationMode = mode === 'cancellations';
  const canCancel = isCancellationMode;
  const initialFilters = isCancellationMode ? PENDING_CANCELLATION_FILTERS : EMPTY_RESERVATION_FILTERS;
  const [reservations, setReservations] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [filters, setFilters] = useState(() => ({ ...initialFilters }));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [validationError, setValidationError] = useState('');
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState('');

  useEffect(() => {
    let isCurrent = true;
    const defaultQuery = isCancellationMode ? PENDING_CANCELLATION_FILTERS : {};
    Promise.all([getReservations(token, defaultQuery), getRooms(token)])
      .then(([reservationResponse, roomResponse]) => {
        if (!isCurrent) return;
        setReservations(reservationResponse.data?.reservations || []);
        setRooms(roomResponse.data?.rooms || []);
      })
      .catch((loadError) => {
        if (isCurrent) setError(loadError.message || 'No fue posible cargar las reservaciones.');
      })
      .finally(() => {
        if (isCurrent) setLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [token, isCancellationMode]);

  function updateFilter(event) {
    const { name, value } = event.target;
    setFilters((current) => ({ ...current, [name]: value }));
    setValidationError('');
  }

  async function searchReservations(event, nextFilters = filters) {
    event?.preventDefault();
    setValidationError('');

    if (nextFilters.checkInFrom && nextFilters.checkInTo && nextFilters.checkInTo < nextFilters.checkInFrom) {
      setValidationError('La fecha final debe ser igual o posterior a la fecha inicial.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const response = await getReservations(token, nextFilters);
      setReservations(response.data?.reservations || []);
    } catch (loadError) {
      setError(loadError.message || 'No fue posible consultar las reservaciones.');
    } finally {
      setLoading(false);
    }
  }

  function clearFilters() {
    const nextFilters = { ...initialFilters };
    setFilters(nextFilters);
    searchReservations(undefined, nextFilters);
  }

  async function openDetails(reservationId) {
    setDetailsOpen(true);
    setSelectedReservation(null);
    setLoadingDetail(true);
    setDetailError('');
    try {
      const response = await getReservation(token, reservationId);
      setSelectedReservation(response.data?.reservation || null);
    } catch (loadError) {
      setDetailError(loadError.message || 'No fue posible cargar el detalle de la reservación.');
    } finally {
      setLoadingDetail(false);
    }
  }

  function closeDetails() {
    setDetailsOpen(false);
    setSelectedReservation(null);
    setDetailError('');
  }

  async function cancelSelectedReservation(reservationId, reason) {
    const response = await cancelReservationRequest(token, reservationId, reason);
    const updatedReservation = response.data?.reservation;
    if (!updatedReservation) {
      throw new Error('La reservación se canceló, pero no se recibió su actualización.');
    }

    setSelectedReservation(updatedReservation);
    setReservations((current) => current
      .map((reservation) => reservation._id === reservationId
        ? { ...reservation, status: updatedReservation.status }
        : reservation)
      .filter((reservation) => !(
        isCancellationMode
        && filters.status === 'reservada'
        && reservation._id === reservationId
      )));

    return updatedReservation;
  }

  return (
    <section className="reservations-page" aria-labelledby="reservation-list-heading">
      <div className="reservations-heading">
        <div>
          <p className="eyebrow">GESTIÓN DE ESTADÍAS</p>
          <h1 id="reservation-list-heading">{isCancellationMode ? 'Cancelaciones administrativas' : 'Reservaciones'}</h1>
          <p className="intro">
            {isCancellationMode
              ? 'Consulta las reservaciones pendientes, revisa sus datos y cancélalas antes del check-in.'
              : 'Consulta las estadías registradas y filtra por fecha, habitación, tipo o estado.'}
          </p>
        </div>
        {canCreate && (
          <div className="reservation-heading-actions">
            <button className="button-primary" type="button" onClick={() => onNavigate?.('reception-reservations-create')}>
              ＋ Nueva reservación
            </button>
          </div>
        )}
      </div>
      <ReservationListing
        reservations={reservations}
        rooms={rooms}
        filters={filters}
        loading={loading}
        error={error}
        validationError={validationError}
        detailsOpen={detailsOpen}
        selectedReservation={selectedReservation}
        loadingDetail={loadingDetail}
        detailError={detailError}
        onFilterChange={updateFilter}
        onSearch={searchReservations}
        onClear={clearFilters}
        onRefresh={() => searchReservations(undefined)}
        onOpenDetails={openDetails}
        onCloseDetails={closeDetails}
        cancellationMode={isCancellationMode}
        canCancel={canCancel}
        onCancelReservation={cancelSelectedReservation}
      />
    </section>
  );
}

function ReservationListing({
  reservations,
  rooms,
  filters,
  loading,
  error,
  validationError,
  detailsOpen,
  selectedReservation,
  loadingDetail,
  detailError,
  onFilterChange,
  onSearch,
  onClear,
  onRefresh,
  onOpenDetails,
  onCloseDetails,
  cancellationMode,
  canCancel,
  onCancelReservation,
}) {
  const [cancellationFormOpen, setCancellationFormOpen] = useState(false);
  const [cancellationReason, setCancellationReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [cancellationNotice, setCancellationNotice] = useState(null);

  function openReservationDetails(reservationId) {
    setCancellationFormOpen(false);
    setCancellationReason('');
    setCancellationNotice(null);
    onOpenDetails(reservationId);
  }

  function closeReservationDetails() {
    setCancellationFormOpen(false);
    setCancellationReason('');
    setCancellationNotice(null);
    onCloseDetails();
  }

  async function submitCancellation(event) {
    event.preventDefault();
    if (!selectedReservation) return;

    const reason = cancellationReason.trim();
    if (reason.length < 3 || reason.length > 500) {
      setCancellationNotice({
        tone: 'error',
        text: 'El motivo debe tener entre 3 y 500 caracteres.',
      });
      return;
    }

    setCancelling(true);
    setCancellationNotice(null);
    try {
      await onCancelReservation(selectedReservation._id, reason);
      setCancellationFormOpen(false);
      setCancellationReason('');
      setCancellationNotice({
        tone: 'success',
        text: 'La reservación se canceló. La habitación quedó disponible para estas fechas.',
      });
    } catch (cancelError) {
      setCancellationNotice({
        tone: 'error',
        text: getErrorMessage(cancelError, 'No fue posible cancelar la reservación.'),
      });
    } finally {
      setCancelling(false);
    }
  }

  return (
    <>
      <section className="reservation-filter-card" aria-labelledby="reservation-filters-title">
        <div className="reservation-filter-heading">
          <div>
            <span className="card-kicker">BÚSQUEDA</span>
            <h2 id="reservation-filters-title">Filtrar reservaciones</h2>
          </div>
          <span className="reservation-result-count" aria-live="polite">
            {loading ? 'Consultando…' : `${reservations.length} ${reservations.length === 1 ? 'resultado' : 'resultados'}`}
          </span>
        </div>
        <form className="reservation-filter-form" onSubmit={onSearch}>
          <label className="form-field" htmlFor="reservation-filter-from">
            <span className="field-label">Check-in desde</span>
            <input className="form-input" id="reservation-filter-from" name="checkInFrom" type="date" value={filters.checkInFrom} onChange={onFilterChange} disabled={loading} />
          </label>
          <label className="form-field" htmlFor="reservation-filter-to">
            <span className="field-label">Check-in hasta</span>
            <input className="form-input" id="reservation-filter-to" name="checkInTo" type="date" value={filters.checkInTo} onChange={onFilterChange} disabled={loading} />
          </label>
          <label className="form-field" htmlFor="reservation-filter-room">
            <span className="field-label">Habitación</span>
            <select className="form-input" id="reservation-filter-room" name="roomId" value={filters.roomId} onChange={onFilterChange} disabled={loading}>
              <option value="">Todas las habitaciones</option>
              {rooms.map((room) => <option value={room._id} key={room._id}>{room.number} · {room.type}</option>)}
            </select>
          </label>
          <label className="form-field" htmlFor="reservation-filter-room-type">
            <span className="field-label">Tipo de habitación</span>
            <select className="form-input" id="reservation-filter-room-type" name="roomType" value={filters.roomType} onChange={onFilterChange} disabled={loading}>
              <option value="">Todos los tipos</option>
              {ROOM_TYPES.map((roomType) => <option value={roomType} key={roomType}>{roomType}</option>)}
            </select>
          </label>
          <label className="form-field" htmlFor="reservation-filter-status">
            <span className="field-label">Estado</span>
            <select className="form-input" id="reservation-filter-status" name="status" value={filters.status} onChange={onFilterChange} disabled={loading}>
              <option value="">Todos los estados</option>
              {Object.entries(RESERVATION_STATUS_LABELS).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
            </select>
          </label>
          <div className="reservation-filter-actions">
            <button className="button-secondary" type="button" onClick={onClear} disabled={loading}>Limpiar</button>
            <button className="button-primary" type="submit" disabled={loading}>{loading ? 'Consultando…' : 'Aplicar filtros'}</button>
          </div>
        </form>
        {validationError && <p className="reservation-inline-error" role="alert">{validationError}</p>}
      </section>

      <section className="receptionist-list-card reservation-list-card" aria-labelledby="reservation-list-title">
        <div className="receptionist-list-heading">
          <div>
            <span className="card-kicker">ESTADÍAS REGISTRADAS</span>
            <h2 id="reservation-list-title">{cancellationMode ? 'Pendientes de check-in' : 'Todas las reservaciones'}</h2>
          </div>
          <button className="button-secondary receptionist-refresh" type="button" onClick={onRefresh} disabled={loading}>
            {loading ? 'Actualizando…' : 'Actualizar listado'}
          </button>
        </div>
        {error ? (
          <div className="reservation-list-message reservation-list-error" role="alert">{error}</div>
        ) : loading ? (
          <div className="reservation-list-message" role="status" aria-live="polite">
            <span className="button-spinner receptionist-loading-spinner" aria-hidden="true" /> Cargando reservaciones…
          </div>
        ) : reservations.length ? (
          <div className="receptionist-table-wrap">
            <table className="receptionist-table reservations-table">
              <thead><tr><th scope="col">Huésped</th><th scope="col">Habitación</th><th scope="col">Estadía</th><th scope="col">Estado</th><th scope="col">Total</th><th scope="col"><span className="sr-only">Acciones</span></th></tr></thead>
              <tbody>
                {reservations.map((reservation) => (
                  <tr key={reservation._id}>
                    <td data-label="Huésped"><div className="reservation-guest-cell"><strong>{reservation.guest?.fullName || 'Huésped'}</strong><span>{reservation._id}</span></div></td>
                    <td data-label="Habitación">{reservation.roomNumber} · {reservation.roomType}</td>
                    <td data-label="Estadía">{formatDate(reservation.checkIn)} – {formatDate(reservation.checkOut)}</td>
                    <td data-label="Estado"><span className={`reservation-status-pill reservation-status-${reservation.status}`}>{RESERVATION_STATUS_LABELS[reservation.status] || reservation.status}</span></td>
                    <td data-label="Total">{formatCurrency(reservation.totalAmount)}</td>
                    <td className="receptionist-action-cell" data-label="Acciones">
                      <button className="receptionist-status-action receptionist-edit-action" type="button" onClick={() => openReservationDetails(reservation._id)}>Ver detalles</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="receptionist-empty-state reservation-empty-state">
            <span className="receptionist-empty-mark" aria-hidden="true">⌕</span>
            <strong>{cancellationMode && filters.status === 'reservada' ? 'No hay reservaciones pendientes de check-in' : 'No hay reservaciones para mostrar'}</strong>
            <p>{cancellationMode ? 'Cuando haya reservaciones pendientes, aparecerán aquí para consulta o cancelación.' : 'Prueba con otros filtros o registra una nueva reservación.'}</p>
          </div>
        )}
      </section>

      {detailsOpen && (
        <div className="reservation-detail-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closeReservationDetails(); }}>
          <section className="reservation-detail-dialog" role="dialog" aria-modal="true" aria-labelledby="reservation-detail-title">
            <div className="reservation-detail-heading">
              <div><span className="card-kicker">CONSULTA DE RESERVACIÓN</span><h2 id="reservation-detail-title">Detalle de la estadía</h2></div>
              <button className="reservation-detail-close" type="button" onClick={closeReservationDetails} aria-label="Cerrar detalle">×</button>
            </div>
            {loadingDetail ? (
              <div className="reservation-list-message" role="status" aria-live="polite"><span className="button-spinner receptionist-loading-spinner" aria-hidden="true" /> Cargando detalle…</div>
            ) : detailError ? (
              <div className="reservation-list-message reservation-list-error" role="alert">{detailError}</div>
            ) : selectedReservation ? (
              <dl className="reservation-detail-grid">
                <div><dt>Confirmación</dt><dd>{selectedReservation._id}</dd></div>
                <div><dt>Estado</dt><dd>{RESERVATION_STATUS_LABELS[selectedReservation.status] || selectedReservation.status}</dd></div>
                <div><dt>Huésped</dt><dd>{selectedReservation.guest?.fullName || '—'}</dd></div>
                <div><dt>Identificación</dt><dd>{selectedReservation.guest?.identification || '—'}</dd></div>
                <div><dt>Correo</dt><dd>{selectedReservation.guest?.email || '—'}</dd></div>
                <div><dt>Teléfono</dt><dd>{selectedReservation.guest?.phone || '—'}</dd></div>
                <div><dt>Habitación</dt><dd>{selectedReservation.roomNumber} · {selectedReservation.roomType}</dd></div>
                <div><dt>Check-in</dt><dd>{formatDate(selectedReservation.checkIn)}</dd></div>
                <div><dt>Check-out</dt><dd>{formatDate(selectedReservation.checkOut)}</dd></div>
                <div><dt>Noches</dt><dd>{selectedReservation.nights}</dd></div>
                <div><dt>Tarifa por noche</dt><dd>{formatCurrency(selectedReservation.nightlyRate)}</dd></div>
                <div className="reservation-detail-total"><dt>Total</dt><dd>{formatCurrency(selectedReservation.totalAmount)}</dd></div>
                {selectedReservation.cancellation?.reason && (
                  <div><dt>Motivo de cancelación</dt><dd>{selectedReservation.cancellation.reason}</dd></div>
                )}
              </dl>
            ) : null}
            {!loadingDetail && !detailError && selectedReservation && (
              <>
                {cancellationNotice && (
                  <div className={`reservation-notice feedback-${cancellationNotice.tone}`} role="status" aria-live="polite">
                    {cancellationNotice.text}
                  </div>
                )}
                {canCancel && selectedReservation.status === 'reservada' && (
                  <section className="reservation-cancellation-panel" aria-label="Cancelar reservación">
                    {!cancellationFormOpen ? (
                      <button
                        className="button-secondary"
                        type="button"
                        onClick={() => {
                          setCancellationFormOpen(true);
                          setCancellationNotice(null);
                        }}
                      >
                        Cancelar reservación
                      </button>
                    ) : (
                      <form className="reservation-cancellation-form" onSubmit={submitCancellation}>
                        <label className="form-field">
                          <span className="field-label">Motivo de cancelación *</span>
                          <textarea
                            className="form-input room-description-input"
                            value={cancellationReason}
                            onChange={(event) => setCancellationReason(event.target.value)}
                            minLength="3"
                            maxLength="500"
                            rows="4"
                            required
                            disabled={cancelling}
                          />
                        </label>
                        <div className="receptionist-form-actions">
                          <button
                            className="button-secondary"
                            type="button"
                            onClick={() => {
                              setCancellationFormOpen(false);
                              setCancellationReason('');
                              setCancellationNotice(null);
                            }}
                            disabled={cancelling}
                          >
                            Volver
                          </button>
                          <button className="button-primary" type="submit" disabled={cancelling}>
                            {cancelling ? 'Cancelando…' : 'Confirmar cancelación'}
                          </button>
                        </div>
                      </form>
                    )}
                  </section>
                )}
              </>
            )}
          </section>
        </div>
      )}
    </>
  );
}
