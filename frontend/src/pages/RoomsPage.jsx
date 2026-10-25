import { useState } from 'react';
import { createRoom } from '../services/api.js';

const EMPTY_FORM = {
  number: '',
  type: '',
  price: '',
  status: 'disponible',
};

export default function RoomsPage({ token }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
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

    setSaving(true);
    try {
      await createRoom(token, {
        number: form.number.trim(),
        type: form.type.trim(),
        price,
        status: form.status,
      });
      setForm(EMPTY_FORM);
      setNotice({ tone: 'success', text: 'La habitación se registró correctamente.' });
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

  return (
    <section className="rooms-page" aria-labelledby="rooms-title">
      <div className="rooms-heading">
        <div>
          <p className="eyebrow">INVENTARIO DEL HOTEL</p>
          <h1 id="rooms-title">Registrar habitación</h1>
          <p className="intro">Agrega una habitación al inventario del Hotel Boutique.</p>
        </div>
      </div>

      {notice && (
        <div className={`rooms-notice feedback-${notice.tone}`} role="status" aria-live="polite">
          {notice.text}
        </div>
      )}

      <form className="receptionist-form-card" onSubmit={handleSubmit} noValidate>
        <div className="receptionist-form-heading">
          <div>
            <span className="card-kicker">NUEVA HABITACIÓN</span>
            <h2>Datos de la habitación</h2>
            <p>Los campos marcados como obligatorios deben completarse para guardar el registro.</p>
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
            <input
              className="form-input"
              id="room-type"
              name="type"
              type="text"
              maxLength={50}
              placeholder="Ej. Suite"
              value={form.type}
              onChange={updateField}
              required
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
            <span className="field-label">Estado inicial</span>
            <select
              className="form-input"
              id="room-status"
              name="status"
              value={form.status}
              onChange={updateField}
              disabled={saving}
            >
              <option value="disponible">Disponible</option>
              <option value="ocupada">Ocupada</option>
              <option value="mantenimiento">Mantenimiento</option>
            </select>
          </label>
        </div>

        <div className="receptionist-form-footer">
          <p>* Datos obligatorios. El precio debe ser igual o mayor que cero.</p>
          <button className="button-primary" type="submit" disabled={saving}>
            {saving ? 'Registrando habitación…' : 'Registrar habitación'}
          </button>
        </div>
      </form>
    </section>
  );
}
