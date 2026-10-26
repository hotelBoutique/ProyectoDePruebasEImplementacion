import { useEffect, useState } from 'react';
import { createRoom, getRooms, updateRoom } from '../services/api.js';

const EMPTY_FORM = {
  number: '',
  type: '',
  description: '',
  capacity: '',
  price: '',
  status: 'disponible',
};

const ROOM_TYPES = ['Sencilla', 'Doble', 'Triple', 'Familiar', 'Suite'];

const ROOM_STATUSES = [
  { value: 'disponible', label: 'Disponible' },
  { value: 'ocupada', label: 'Ocupada' },
  { value: 'mantenimiento', label: 'Mantenimiento' },
  { value: 'fuera de servicio', label: 'Fuera de servicio' },
  { value: 'limpieza', label: 'En limpieza' },
  { value: 'desinfeccion', label: 'En desinfección' },
];

export default function RoomsPage({
  token,
  mode = 'list',
  canCreate = false,
  canManage = false,
  createItemId = 'rooms-create',
  listItemId = 'rooms-list',
  onNavigate,
}) {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(mode === 'list');
  const [loadError, setLoadError] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [updatingRoomId, setUpdatingRoomId] = useState('');
  const [editingRoom, setEditingRoom] = useState(null);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    if (mode !== 'list') return undefined;

    let isCurrent = true;
    setLoading(true);
    setLoadError('');

    getRooms(token)
      .then((response) => {
        if (isCurrent) setRooms(response.data?.rooms || []);
      })
      .catch((error) => {
        if (isCurrent) setLoadError(error.message || 'No fue posible cargar las habitaciones.');
      })
      .finally(() => {
        if (isCurrent) setLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [mode, token]);

  useEffect(() => {
    setEditingRoom(null);
    setForm(EMPTY_FORM);
    setNotice(null);
  }, [mode]);

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  function startEditing(room) {
    setEditingRoom(room);
    setForm({
      number: room.number || '',
      type: room.type || '',
      description: room.description || '',
      capacity: room.capacity == null ? '' : String(room.capacity),
      price: String(room.price ?? ''),
      status: room.status || 'disponible',
    });
    setNotice(null);
  }

  function cancelEditing() {
    setEditingRoom(null);
    setForm(EMPTY_FORM);
    setNotice(null);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setNotice(null);

    const requiredFields = [
      ['number', 'número de habitación'],
      ['type', 'tipo de habitación'],
      ['price', 'precio'],
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

    const price = Number(form.price);
    if (!Number.isFinite(price) || price < 0) {
      setNotice({ tone: 'error', text: 'El precio debe ser un número mayor o igual a 0.' });
      return;
    }

    const capacity = form.capacity.trim() === '' ? null : Number(form.capacity);
    if (capacity !== null && (!Number.isInteger(capacity) || capacity < 1)) {
      setNotice({ tone: 'error', text: 'La capacidad debe ser un número entero mayor o igual a 1.' });
      return;
    }

    const changes = {
      number: form.number.trim(),
      type: form.type.trim(),
      description: form.description.trim(),
      capacity,
      price,
      status: form.status,
    };

    setSaving(true);
    try {
      if (editingRoom) {
        const response = await updateRoom(token, editingRoom._id, changes);
        const updatedRoom = response.data?.room;
        if (updatedRoom) {
          setRooms((current) => current.map((room) => (
            room._id === updatedRoom._id ? updatedRoom : room
          )));
        }
        setEditingRoom(null);
        setForm(EMPTY_FORM);
        setNotice({ tone: 'success', text: 'La habitación se actualizó correctamente.' });
      } else {
        await createRoom(token, {
          ...changes,
          ...(capacity === null ? { capacity: undefined } : {}),
        });
        setForm(EMPTY_FORM);
        setNotice({ tone: 'success', text: 'La habitación se registró correctamente.' });
      }
    } catch (error) {
      const details = Array.isArray(error.details) ? error.details : [];
      setNotice({
        tone: 'error',
        text: details.length
          ? details.join('. ')
          : error.message || 'No fue posible registrar la habitación.',
      });
    } finally {
      setSaving(false);
    }
  }

  async function deactivateRoom(room) {
    setUpdatingRoomId(room._id);
    setNotice(null);

    try {
      const response = await updateRoom(token, room._id, { status: 'fuera de servicio' });
      const updatedRoom = response.data?.room;
      if (updatedRoom) {
        setRooms((current) => current.map((item) => (
          item._id === updatedRoom._id ? updatedRoom : item
        )));
      }
      setNotice({
        tone: 'success',
        text: `La habitación ${room.number} quedó fuera de servicio y ya no figura como disponible.`,
      });
    } catch (error) {
      setNotice({ tone: 'error', text: error.message || 'No fue posible desactivar la habitación.' });
    } finally {
      setUpdatingRoomId('');
    }
  }

  const isEditing = Boolean(editingRoom);
  const isCreating = mode === 'create';

  return (
    <section className="rooms-page" aria-labelledby="rooms-title">
      <div className="rooms-heading">
        <div>
          <p className="eyebrow">INVENTARIO DEL HOTEL</p>
          <h1 id="rooms-title">{isCreating ? 'Registrar habitación' : 'Habitaciones'}</h1>
          <p className="intro">
            {isCreating
              ? 'Agrega una habitación al inventario del Hotel Boutique.'
              : 'Consulta, actualiza o desactiva habitaciones del inventario.'}
          </p>
        </div>
        {isCreating || isEditing ? (
          <button
            className="button-secondary"
            type="button"
            onClick={isEditing ? cancelEditing : () => onNavigate(listItemId)}
          >
            {isEditing ? 'Cancelar edición' : 'Ver habitaciones'}
          </button>
        ) : canCreate ? (
          <button className="button-primary rooms-create-action" type="button" onClick={() => onNavigate(createItemId)}>
            <span aria-hidden="true">＋</span> Registrar habitación
          </button>
        ) : null}
      </div>

      {notice && (
        <div className={`rooms-notice feedback-${notice.tone}`} role="status" aria-live="polite">
          {notice.text}
        </div>
      )}

      {isCreating || isEditing ? (
      <form className="receptionist-form-card" onSubmit={handleSubmit} noValidate>
        <div className="receptionist-form-heading">
          <div>
            <span className="card-kicker">{isEditing ? 'ACTUALIZACIÓN DE INVENTARIO' : 'NUEVA HABITACIÓN'}</span>
            <h2>{isEditing ? `Habitación ${editingRoom.number}` : 'Datos de la habitación'}</h2>
            <p>El número, el tipo y el precio son obligatorios. La descripción y capacidad son opcionales.</p>
          </div>
          <span className="account-role-pill">INVENTARIO</span>
        </div>

        <div className="receptionist-form-grid">
          <label className="form-field" htmlFor="room-number">
            <span className="field-label">Número de habitación *</span>
            <input
              className="form-input"
              id="room-number"
              name="number"
              type="text"
              maxLength={20}
              placeholder="Ej. 101"
              value={form.number}
              onChange={updateField}
              required
              disabled={saving}
            />
          </label>

          <label className="form-field" htmlFor="room-type">
            <span className="field-label">Tipo de habitación *</span>
            <select
              className="form-input"
              id="room-type"
              name="type"
              value={form.type}
              onChange={updateField}
              required
              disabled={saving}
            >
              <option value="">Selecciona un tipo</option>
              {ROOM_TYPES.map((type) => <option value={type} key={type}>{type}</option>)}
            </select>
          </label>

          <label className="form-field" htmlFor="room-description">
            <span className="field-label">Descripción</span>
            <textarea
              className="form-input room-description-input"
              id="room-description"
              name="description"
              maxLength={500}
              placeholder="Detalles de la habitación"
              value={form.description}
              onChange={updateField}
              disabled={saving}
            />
          </label>

          <label className="form-field" htmlFor="room-capacity">
            <span className="field-label">Capacidad (personas)</span>
            <input
              className="form-input"
              id="room-capacity"
              name="capacity"
              type="number"
              min="1"
              step="1"
              placeholder="Ej. 2"
              value={form.capacity}
              onChange={updateField}
              disabled={saving}
            />
          </label>

          <label className="form-field" htmlFor="room-price">
            <span className="field-label">Precio por noche *</span>
            <input
              className="form-input"
              id="room-price"
              name="price"
              type="number"
              min="0"
              step="any"
              placeholder="0"
              value={form.price}
              onChange={updateField}
              required
              disabled={saving}
            />
          </label>

          <label className="form-field" htmlFor="room-status">
            <span className="field-label">{isEditing ? 'Estado' : 'Estado inicial'}</span>
            <select
              className="form-input"
              id="room-status"
              name="status"
              value={form.status}
              onChange={updateField}
              disabled={saving}
            >
              {ROOM_STATUSES.map((status) => (
                <option value={status.value} key={status.value}>{status.label}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="receptionist-form-footer">
          <p>El precio debe ser igual o mayor que cero. La capacidad debe ser un entero positivo.</p>
          <button className="button-primary" type="submit" disabled={saving}>
            {saving
              ? (isEditing ? 'Guardando cambios…' : 'Registrando habitación…')
              : (isEditing ? 'Guardar cambios' : 'Registrar habitación')}
          </button>
        </div>
      </form>
      ) : (
        <section className="receptionist-list-card" aria-label="Listado de habitaciones">
          <div className="receptionist-list-heading">
            <div>
              <span className="card-kicker">INVENTARIO</span>
              <h2>Habitaciones registradas</h2>
            </div>
            <button
              className="button-secondary receptionist-refresh"
              type="button"
              onClick={() => {
                setLoading(true);
                setLoadError('');
                getRooms(token)
                  .then((response) => setRooms(response.data?.rooms || []))
                  .catch((error) => setLoadError(error.message || 'No fue posible cargar las habitaciones.'))
                  .finally(() => setLoading(false));
              }}
              disabled={loading}
            >
              {loading ? 'Cargando…' : 'Actualizar listado'}
            </button>
          </div>
          {loading ? (
            <div className="receptionist-empty-state" role="status">Cargando habitaciones…</div>
          ) : loadError ? (
            <div className="receptionist-empty-state">
              <strong>No fue posible cargar el inventario</strong>
              <p>{loadError}</p>
            </div>
          ) : rooms.length === 0 ? (
            <div className="receptionist-empty-state">
              <strong>Aún no hay habitaciones</strong>
              <p>Registra una habitación para comenzar a administrar el inventario.</p>
              {canCreate && (
                <button className="button-primary" type="button" onClick={() => onNavigate(createItemId)}>
                  Registrar habitación
                </button>
              )}
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
                    <th scope="col">Estado</th>
                    <th scope="col"><span className="sr-only">Acciones</span></th>
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
                      <td>{new Intl.NumberFormat('es-CO', {
                        style: 'currency',
                        currency: 'COP',
                        maximumFractionDigits: 0,
                      }).format(room.price)}</td>
                      <td>
                        <span className={`receptionist-status${room.status === 'disponible' ? ' receptionist-status-active' : ' receptionist-status-inactive'}`}>
                          <span aria-hidden="true" />
                          {ROOM_STATUSES.find((status) => status.value === room.status)?.label || room.status}
                        </span>
                      </td>
                      <td className="receptionist-action-cell">
                        <div className="receptionist-actions">
                          {canManage && (
                            <>
                              <button
                                className="button-secondary receptionist-status-action receptionist-edit-action"
                                type="button"
                                onClick={() => startEditing(room)}
                                disabled={Boolean(updatingRoomId)}
                              >
                                Editar
                              </button>
                              {room.status !== 'fuera de servicio' && (
                                <button
                                  className="receptionist-status-action receptionist-deactivate-action"
                                  type="button"
                                  onClick={() => deactivateRoom(room)}
                                  disabled={Boolean(updatingRoomId)}
                                >
                                  {updatingRoomId === room._id ? 'Desactivando…' : 'Desactivar'}
                                </button>
                              )}
                            </>
                          )}
                        </div>
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
