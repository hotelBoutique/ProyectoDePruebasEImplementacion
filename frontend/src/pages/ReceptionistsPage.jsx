import { useEffect, useState } from 'react';
import {
  createAdminUser,
  createReceptionist,
  getReceptionists,
  setReceptionistStatus,
  updateReceptionist,
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
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', password: '', isActive: true });
  const [savingEdit, setSavingEdit] = useState(false);

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

  useEffect(() => {
    setForm({ name: '', email: '', password: '' });
    setShowPassword(false);
    setNotice(null);
  }, [mode]);

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleCreate(event) {
    event.preventDefault();
    setSaving(true);
    setNotice(null);

    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
      };
      if (isAdminCreateMode) {
        await createAdminUser(token, payload);
      } else {
        await createReceptionist(token, payload);
      }
      setForm({ name: '', email: '', password: '' });
      setNotice({
        tone: 'success',
        text: isAdminCreateMode
          ? 'La cuenta de administrador se creó correctamente.'
          : 'La cuenta de recepcionista se creó correctamente.',
      });
      if (!isAdminCreateMode) {
        await loadUsers();
        onNavigate('users-list');
      }
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

  function startEditing(user) {
    setEditingUser(user);
    setEditForm({
      name: user.name || '',
      password: '',
      isActive: user.isActive,
    });
    setNotice(null);
  }

  function cancelEditing() {
    setEditingUser(null);
    setEditForm({ name: '', password: '', isActive: true });
  }

  function updateEditField(event) {
    const { name, value } = event.target;
    setEditForm((current) => ({
      ...current,
      [name]: name === 'isActive' ? value === 'true' : value,
    }));
  }

  async function handleUpdateReceptionist(event) {
    event.preventDefault();
    const name = editForm.name.trim();
    if (name.length < 2 || name.length > 100) {
      setNotice({ tone: 'error', text: 'El nombre debe tener entre 2 y 100 caracteres.' });
      return;
    }

    setSavingEdit(true);
    setNotice(null);
    const changes = {
      name,
      isActive: editForm.isActive,
    };
    if (editForm.password) changes.password = editForm.password;

    try {
      await updateReceptionist(token, editingUser._id, changes);
      setEditingUser(null);
      setEditForm({ name: '', password: '', isActive: true });
      setNotice({
        tone: 'success',
        text: 'La cuenta de recepcionista se actualizó correctamente.',
      });
      await loadUsers();
    } catch (error) {
      setNotice({ tone: 'error', text: error.message || 'No fue posible actualizar la cuenta.' });
    } finally {
      setSavingEdit(false);
    }
  }

  const activeCount = users.filter((user) => user.isActive).length;
  const inactiveCount = users.length - activeCount;
  const isAdminCreateMode = mode === 'create-admin';
  const isCreateMode = mode === 'create' || isAdminCreateMode;
  const isEditMode = Boolean(editingUser);

  return (
    <section className="receptionists-page" aria-labelledby="receptionists-title">
      <div className="receptionists-heading">
        <div>
          <p className="eyebrow">{isCreateMode ? 'GESTIÓN DE USUARIOS' : 'GESTIÓN DEL EQUIPO'}</p>
          <h1 id="receptionists-title">
            {isAdminCreateMode ? 'Crear administrador' : isCreateMode ? 'Crear recepcionista' : 'Recepcionistas'}
          </h1>
          <p className="intro">
            {isAdminCreateMode
              ? 'Crea una cuenta con permisos administrativos.'
              : isCreateMode
                ? 'Crea una cuenta para el equipo de recepción.'
                : 'Administra las cuentas que tienen acceso al espacio de recepción.'}
          </p>
        </div>
        {isCreateMode || isEditMode ? (
          <button
            className="button-secondary"
            type="button"
            onClick={isEditMode ? cancelEditing : () => onNavigate('users-list')}
          >
            {isEditMode ? 'Volver al listado' : 'Ver listado'}
          </button>
        ) : (
          <div className="receptionists-create-actions">
            <button className="button-secondary" type="button" onClick={() => onNavigate('users-admin-create')}>
              Crear administrador
            </button>
            <button className="button-primary receptionists-create-action" type="button" onClick={() => onNavigate('users-create')}>
              <span aria-hidden="true">＋</span> Crear recepcionista
            </button>
          </div>
        )}
      </div>

      {notice && (
        <div className={`receptionists-notice feedback-${notice.tone}`} role="status" aria-live="polite">
          {notice.text}
        </div>
      )}

      {isEditMode ? (
        <form className="receptionist-form-card" onSubmit={handleUpdateReceptionist}>
          <div className="receptionist-form-heading">
            <div>
              <span className="card-kicker">EDICIÓN DE CUENTA</span>
              <h2>Editar recepcionista</h2>
              <p>Actualiza los datos de {editingUser.name}. El correo no se puede modificar.</p>
            </div>
            <span className="account-role-pill">RECEPCIONISTA</span>
          </div>

          <div className="receptionist-form-grid">
            <label className="form-field" htmlFor="edit-receptionist-name">
              <span className="field-label">Nombre completo</span>
              <input
                className="form-input"
                id="edit-receptionist-name"
                name="name"
                autoComplete="name"
                minLength={2}
                maxLength={100}
                value={editForm.name}
                onChange={updateEditField}
                required
                disabled={savingEdit}
              />
            </label>
            <label className="form-field" htmlFor="edit-receptionist-email">
              <span className="field-label">Correo electrónico</span>
              <input
                className="form-input profile-readonly-input"
                id="edit-receptionist-email"
                type="email"
                value={editingUser.email || ''}
                readOnly
              />
              <span className="profile-field-hint">El correo no se puede modificar.</span>
            </label>
            <label className="form-field" htmlFor="edit-receptionist-password">
              <span className="field-label">Nueva contraseña</span>
              <input
                className="form-input"
                id="edit-receptionist-password"
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                placeholder="Dejar vacío para conservarla"
                value={editForm.password}
                onChange={updateEditField}
                disabled={savingEdit}
              />
              <span className="profile-field-hint">Si la cambias, debe tener al menos 8 caracteres.</span>
            </label>
            <div className="form-field">
              <span className="field-label">Rol de la cuenta</span>
              <div className="form-input profile-readonly-input profile-static-value" aria-readonly="true">
                Recepcionista
              </div>
            </div>
            <label className="form-field" htmlFor="edit-receptionist-status">
              <span className="field-label">Estado de la cuenta</span>
              <select
                className="form-input"
                id="edit-receptionist-status"
                name="isActive"
                value={String(editForm.isActive)}
                onChange={updateEditField}
                disabled={savingEdit}
              >
                <option value="true">Activa</option>
                <option value="false">Inactiva</option>
              </select>
            </label>
          </div>

          <div className="receptionist-form-footer">
            <p>Al cambiar la contraseña o el estado, se revocarán las sesiones existentes de esta cuenta.</p>
            <div className="receptionist-form-actions">
              <button className="button-secondary" type="button" onClick={cancelEditing} disabled={savingEdit}>
                Cancelar
              </button>
              <button className="button-primary" type="submit" disabled={savingEdit}>
                {savingEdit ? 'Guardando cambios…' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </form>
      ) : isCreateMode ? (
        <form className="receptionist-form-card" onSubmit={handleCreate}>
          <div className="receptionist-form-heading">
            <div>
              <span className="card-kicker">NUEVA CUENTA · {isAdminCreateMode ? 'ADMINISTRACIÓN' : 'RECEPCIÓN'}</span>
              <h2>{isAdminCreateMode ? 'Crear administrador' : 'Crear recepcionista'}</h2>
              <p>
                {isAdminCreateMode
                  ? 'La cuenta se creará activa y tendrá permisos administrativos.'
                  : 'La cuenta se creará activa y con permisos de recepción.'}
              </p>
            </div>
            <span className="account-role-pill">{isAdminCreateMode ? 'ADMIN' : 'RECEPCIONISTA'}</span>
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
                      <th scope="col">Acciones</th>
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
                          <td data-label="Acciones" className="receptionist-action-cell">
                            <div className="receptionist-actions">
                              <button
                                className="receptionist-status-action receptionist-edit-action"
                                type="button"
                                onClick={() => startEditing(user)}
                                disabled={Boolean(updatingUserId)}
                                aria-label={`Editar cuenta de ${user.name}`}
                              >
                                Editar
                              </button>
                              <button
                                className={`receptionist-status-action${user.isActive ? ' receptionist-deactivate-action' : ''}`}
                                type="button"
                                onClick={() => handleStatusChange(user)}
                                disabled={Boolean(updatingUserId)}
                                aria-label={`${user.isActive ? 'Desactivar' : 'Activar'} cuenta de ${user.name}`}
                              >
                                {updating ? 'Guardando…' : user.isActive ? 'Desactivar' : 'Activar'}
                              </button>
                            </div>
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
