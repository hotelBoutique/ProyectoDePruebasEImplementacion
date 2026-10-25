import { useEffect, useState } from 'react';
import {
  createReceptionist,
  getReceptionists,
  setReceptionistStatus,
} from '../services/api.js';

function formatDate(dateValue) {
  if (!dateValue) return '—';

  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export default function ReceptionistsPage({ token, mode = 'list', onNavigate }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [updatingUserId, setUpdatingUserId] = useState('');
  const [notice, setNotice] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);

  async function loadUsers() {
    setLoading(true);
    setLoadError('');

    try {
      const response = await getReceptionists(token);
      setUsers(response.data?.users || []);
    } catch (error) {
      setLoadError(error.message || 'No fue posible cargar los recepcionistas.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let isCurrent = true;

    getReceptionists(token)
      .then((response) => {
        if (isCurrent) setUsers(response.data?.users || []);
      })
      .catch((error) => {
        if (isCurrent) setLoadError(error.message || 'No fue posible cargar los recepcionistas.');
      })
      .finally(() => {
        if (isCurrent) setLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [token]);

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleCreate(event) {
    event.preventDefault();
    setSaving(true);
    setNotice(null);

    try {
      await createReceptionist(token, {
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
      });
      setForm({ name: '', email: '', password: '' });
      setNotice({ tone: 'success', text: 'La cuenta de recepcionista se creó correctamente.' });
      await loadUsers();
      onNavigate('users-list');
    } catch (error) {
      setNotice({ tone: 'error', text: error.message || 'No fue posible crear la cuenta.' });
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(user) {
    setUpdatingUserId(user._id);
    setNotice(null);

    try {
      const nextStatus = !user.isActive;
      const response = await setReceptionistStatus(token, user._id, nextStatus);
      const updatedUser = response.data?.user;
      if (updatedUser) {
        setUsers((current) => current.map((item) => (
          item._id === updatedUser._id ? updatedUser : item
        )));
      }
      setNotice({
        tone: 'success',
        text: nextStatus ? 'La cuenta quedó activa.' : 'La cuenta se desactivó y sus sesiones fueron revocadas.',
      });
    } catch (error) {
      setNotice({ tone: 'error', text: error.message || 'No fue posible actualizar el estado.' });
    } finally {
      setUpdatingUserId('');
    }
  }

  const activeCount = users.filter((user) => user.isActive).length;
  const inactiveCount = users.length - activeCount;
  const isCreateMode = mode === 'create';

  return (
    <section className="receptionists-page" aria-labelledby="receptionists-title">
      <div className="receptionists-heading">
        <div>
          <p className="eyebrow">GESTIÓN DEL EQUIPO</p>
          <h1 id="receptionists-title">Recepcionistas</h1>
          <p className="intro">Administra las cuentas que tienen acceso al espacio de recepción.</p>
        </div>
        {isCreateMode ? (
          <button className="button-secondary" type="button" onClick={() => onNavigate('users-list')}>
            Ver listado
          </button>
        ) : (
          <button className="button-primary receptionists-create-action" type="button" onClick={() => onNavigate('users-create')}>
            <span aria-hidden="true">＋</span> Crear recepcionista
          </button>
        )}
      </div>

      {notice && (
        <div className={`receptionists-notice feedback-${notice.tone}`} role="status" aria-live="polite">
          {notice.text}
        </div>
      )}

      {isCreateMode ? (
        <form className="receptionist-form-card" onSubmit={handleCreate}>
          <div className="receptionist-form-heading">
            <div>
              <span className="card-kicker">NUEVA CUENTA</span>
              <h2>Crear recepcionista</h2>
              <p>La cuenta se creará activa y con permisos de recepción.</p>
            </div>
            <span className="account-role-pill">RECEPCIONISTA</span>
          </div>

          <div className="receptionist-form-grid">
            <label className="form-field" htmlFor="receptionist-name">
              <span className="field-label">Nombre completo</span>
              <input
                className="form-input"
                id="receptionist-name"
                name="name"
                autoComplete="name"
                minLength={2}
                maxLength={100}
                placeholder="Nombre y apellido"
                value={form.name}
                onChange={updateField}
                required
                disabled={saving}
              />
            </label>
            <label className="form-field" htmlFor="receptionist-email">
              <span className="field-label">Correo electrónico</span>
              <input
                className="form-input"
                id="receptionist-email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="persona@hotel.com"
                value={form.email}
                onChange={updateField}
                required
                disabled={saving}
              />
            </label>
            <div className="form-field">
              <label className="field-label" htmlFor="receptionist-password">Contraseña</label>
              <span className="password-control">
                <input
                  className="form-input"
                  id="receptionist-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  minLength={8}
                  placeholder="Mínimo 8 caracteres"
                  value={form.password}
                  onChange={updateField}
                  required
                  disabled={saving}
                />
                <button
                  className="password-toggle"
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  aria-pressed={showPassword}
                  disabled={saving}
                >
                  {showPassword ? 'Ocultar' : 'Ver'}
                </button>
              </span>
            </div>
          </div>

          <div className="receptionist-form-footer">
            <p>Por seguridad, la contraseña no se mostrará después de crear la cuenta.</p>
            <button className="button-primary" type="submit" disabled={saving}>
              {saving ? <><span className="button-spinner" aria-hidden="true" /> Creando cuenta…</> : 'Crear cuenta'}
            </button>
          </div>
        </form>
      ) : (
        <>
          <div className="receptionist-stats" aria-label="Resumen de cuentas">
            <article className="receptionist-stat-card">
              <span className="card-kicker">TOTAL DE CUENTAS</span>
              <strong>{loading ? '—' : users.length}</strong>
              <span>Recepcionistas registrados</span>
            </article>
            <article className="receptionist-stat-card">
              <span className="card-kicker">ACTIVAS</span>
              <strong>{loading ? '—' : activeCount}</strong>
              <span>Con acceso habilitado</span>
            </article>
            <article className="receptionist-stat-card">
              <span className="card-kicker">INACTIVAS</span>
              <strong>{loading ? '—' : inactiveCount}</strong>
              <span>Sin acceso al sistema</span>
            </article>
          </div>

          <section className="receptionist-list-card" aria-labelledby="receptionist-list-title">
            <div className="receptionist-list-heading">
              <div>
                <span className="card-kicker">CUENTAS DEL EQUIPO</span>
                <h2 id="receptionist-list-title">Listado de recepcionistas</h2>
              </div>
              <button className="button-secondary receptionist-refresh" type="button" onClick={loadUsers} disabled={loading}>
                {loading ? 'Actualizando…' : 'Actualizar listado'}
              </button>
            </div>

            {loadError ? (
              <div className="receptionist-empty-state" role="alert">
                <strong>No se pudo cargar el listado</strong>
                <p>{loadError}</p>
                <button className="button-secondary" type="button" onClick={loadUsers}>Intentar de nuevo</button>
              </div>
            ) : loading ? (
              <div className="receptionist-empty-state" role="status" aria-live="polite">
                <span className="button-spinner receptionist-loading-spinner" aria-hidden="true" />
                <p>Cargando cuentas…</p>
              </div>
            ) : users.length === 0 ? (
              <div className="receptionist-empty-state">
                <span className="receptionist-empty-mark" aria-hidden="true">+</span>
                <strong>Aún no hay recepcionistas</strong>
                <p>Crea la primera cuenta para dar acceso al equipo de recepción.</p>
                <button className="button-primary" type="button" onClick={() => onNavigate('users-create')}>
                  Crear recepcionista
                </button>
              </div>
            ) : (
              <div className="receptionist-table-wrap">
                <table className="receptionist-table">
                  <thead>
                    <tr>
                      <th scope="col">Nombre</th>
                      <th scope="col">Correo</th>
                      <th scope="col">Estado</th>
                      <th scope="col">Fecha de creación</th>
                      <th scope="col"><span className="sr-only">Acciones</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => {
                      const updating = updatingUserId === user._id;
                      return (
                        <tr key={user._id}>
                          <td data-label="Nombre">
                            <span className="receptionist-name-cell">
                              <span className="receptionist-avatar" aria-hidden="true">{user.name?.trim().charAt(0).toUpperCase() || 'R'}</span>
                              <strong>{user.name}</strong>
                            </span>
                          </td>
                          <td data-label="Correo">{user.email}</td>
                          <td data-label="Estado">
                            <span className={`receptionist-status${user.isActive ? ' receptionist-status-active' : ' receptionist-status-inactive'}`}>
                              <span aria-hidden="true" /> {user.isActive ? 'Activa' : 'Inactiva'}
                            </span>
                          </td>
                          <td data-label="Fecha de creación">{formatDate(user.createdAt)}</td>
                          <td data-label="Acción" className="receptionist-action-cell">
                            <button
                              className={`receptionist-status-action${user.isActive ? ' receptionist-deactivate-action' : ''}`}
                              type="button"
                              onClick={() => handleStatusChange(user)}
                              disabled={Boolean(updatingUserId)}
                              aria-label={`${user.isActive ? 'Desactivar' : 'Activar'} cuenta de ${user.name}`}
                            >
                              {updating ? 'Guardando…' : user.isActive ? 'Desactivar' : 'Activar'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </section>
  );
}
