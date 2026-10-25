import { useState } from 'react';
import { updateMyProfile } from '../services/api.js';

export default function ProfilePage({ user, token, roleLabel, onProfileUpdated }) {
  const [name, setName] = useState(user?.name || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);

  async function handleSubmit(event) {
    event.preventDefault();
    setNotice(null);

    const trimmedName = name.trim();
    if (trimmedName.length < 2 || trimmedName.length > 100) {
      setNotice({ tone: 'error', text: 'El nombre debe tener entre 2 y 100 caracteres.' });
      return;
    }

    const changes = {};

    if (trimmedName !== user?.name) {
      changes.name = trimmedName;
    }

    if (currentPassword || newPassword) {
      if (!currentPassword || !newPassword) {
        setNotice({
          tone: 'error',
          text: 'Para cambiar la contraseña completa ambos campos de contraseña.',
        });
        return;
      }
      changes.currentPassword = currentPassword;
      changes.newPassword = newPassword;
    }

    if (!Object.keys(changes).length) {
      setNotice({ tone: 'info', text: 'No hay cambios por guardar.' });
      return;
    }

    setSaving(true);
    try {
      const response = await updateMyProfile(token, changes);
      const updatedProfile = response.data;
      onProfileUpdated(updatedProfile);
      setName(updatedProfile.user?.name || trimmedName);
      setCurrentPassword('');
      setNewPassword('');
      setNotice({ tone: 'success', text: 'Tu perfil se actualizó correctamente.' });
    } catch (error) {
      setNotice({ tone: 'error', text: error.message || 'No fue posible actualizar tu perfil.' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="account-view profile-view" aria-labelledby="account-title">
      <div className="dashboard-heading">
        <div>
          <p className="eyebrow">PERFIL DE USUARIO</p>
          <h1 id="account-title">Mi perfil</h1>
          <p className="intro">Actualiza tu nombre y contraseña. El correo de la cuenta permanece sin cambios.</p>
        </div>
        <span className="role-badge"><span aria-hidden="true">✦</span> {roleLabel}</span>
      </div>

      <form className="receptionist-form-card profile-form-card" onSubmit={handleSubmit}>
        <div className="receptionist-form-heading">
          <div>
            <span className="card-kicker">INFORMACIÓN PERSONAL</span>
            <h2>Datos de tu cuenta</h2>
            <p>Estos cambios se aplican a tu usuario en todos tus espacios de trabajo.</p>
          </div>
          <span className="account-role-pill">{roleLabel}</span>
        </div>

        <div className="receptionist-form-grid profile-form-grid">
          <label className="form-field" htmlFor="profile-name">
            <span className="field-label">Nombre completo</span>
            <input
              id="profile-name"
              className="form-input"
              type="text"
              name="name"
              autoComplete="name"
              minLength={2}
              maxLength={100}
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              disabled={saving}
            />
          </label>

          <label className="form-field" htmlFor="profile-email">
            <span className="field-label">Correo electrónico</span>
            <input
              id="profile-email"
              className="form-input profile-readonly-input"
              type="email"
              value={user?.email || ''}
              readOnly
              aria-describedby="profile-email-hint"
            />
            <span className="profile-field-hint" id="profile-email-hint">El correo no se puede editar.</span>
          </label>
        </div>

        <div className="profile-password-section">
          <div>
            <span className="card-kicker">SEGURIDAD</span>
            <h3>Cambiar contraseña</h3>
            <p>Deja estos campos vacíos si solo quieres actualizar tu nombre.</p>
          </div>
          <div className="receptionist-form-grid profile-form-grid">
            <label className="form-field" htmlFor="profile-current-password">
              <span className="field-label">Contraseña actual</span>
              <input
                id="profile-current-password"
                className="form-input"
                type="password"
                name="currentPassword"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                required={Boolean(newPassword)}
                disabled={saving}
              />
            </label>
            <label className="form-field" htmlFor="profile-new-password">
              <span className="field-label">Nueva contraseña</span>
              <input
                id="profile-new-password"
                className="form-input"
                type="password"
                name="newPassword"
                autoComplete="new-password"
                minLength={8}
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                required={Boolean(currentPassword)}
                disabled={saving}
              />
              <span className="profile-field-hint">Debe tener al menos 8 caracteres.</span>
            </label>
          </div>
        </div>

        {notice && (
          <div className={`receptionists-notice feedback-${notice.tone}`} role="status" aria-live="polite">
            {notice.text}
          </div>
        )}

        <div className="receptionist-form-footer profile-form-footer">
          <p>Al cambiar la contraseña, se cerrarán las demás sesiones de esta cuenta.</p>
          <button className="button-primary" type="submit" disabled={saving}>
            {saving ? 'Guardando cambios…' : 'Guardar cambios'}
          </button>
        </div>
      </form>
    </section>
  );
}
