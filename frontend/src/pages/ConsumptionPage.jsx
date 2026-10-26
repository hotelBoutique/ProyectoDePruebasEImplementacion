import { useCallback, useEffect, useState } from 'react';
import { addReservationConsumption, getPendingCheckOuts } from '../services/api.js';

function formatCurrency(value) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 2,
  }).format(value);
}

function getErrorMessage(error) {
  return Array.isArray(error.details) && error.details.length
    ? error.details.join('. ')
    : error.message || 'No fue posible registrar el consumo.';
}

export default function ConsumptionPage({ token }) {
  const [reservations, setReservations] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unitPrice, setUnitPrice] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [notice, setNotice] = useState(null);

  const selectedReservation = reservations.find((item) => item._id === selectedId);
  const quantityValue = Number(quantity);
  const unitPriceValue = Number(unitPrice);
  const lineTotal = Number.isInteger(quantityValue)
    && quantityValue >= 1
    && Number.isFinite(unitPriceValue)
    && unitPriceValue >= 0
    ? Math.round(unitPriceValue * 100) * quantityValue / 100
    : null;

  const loadActiveStays = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const response = await getPendingCheckOuts(token);
      const activeReservations = response.data?.reservations || [];
      setReservations(activeReservations);
      setSelectedId((currentId) => (
        activeReservations.some((reservation) => reservation._id === currentId)
          ? currentId
          : activeReservations[0]?._id || ''
      ));
    } catch (error) {
      setLoadError(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadActiveStays();
  }, [loadActiveStays]);

  async function handleSubmit(event) {
    event.preventDefault();
    setNotice(null);
    if (!selectedReservation) {
      setNotice({ tone: 'error', text: 'Selecciona una estancia activa.' });
      return;
    }
    if (description.trim().length < 2 || description.trim().length > 120) {
      setNotice({ tone: 'error', text: 'El concepto debe tener entre 2 y 120 caracteres.' });
      return;
    }
    if (!Number.isInteger(quantityValue) || quantityValue < 1 || quantityValue > 1000) {
      setNotice({ tone: 'error', text: 'La cantidad debe ser un entero entre 1 y 1000.' });
      return;
    }
    if (unitPrice === '' || !Number.isFinite(unitPriceValue) || unitPriceValue < 0) {
      setNotice({ tone: 'error', text: 'El precio unitario debe ser un número mayor o igual a 0.' });
      return;
    }

    setSaving(true);
    try {
      const response = await addReservationConsumption(token, selectedReservation._id, {
        description: description.trim(),
        quantity: quantityValue,
        unitPrice: unitPriceValue,
      });
      setDescription('');
      setQuantity('1');
      setUnitPrice('');
      setNotice({
        tone: 'success',
        text: response.message || 'El consumo se registró en la cuenta de la estancia.',
      });
      await loadActiveStays();
    } catch (error) {
      setNotice({ tone: 'error', text: getErrorMessage(error) });
      if (error.status === 409) await loadActiveStays();
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rooms-page consumption-page" aria-labelledby="consumption-title">
      <div className="rooms-heading">
        <div>
          <p className="eyebrow">CUENTA DEL HUÉSPED</p>
          <h1 id="consumption-title">Registrar consumo</h1>
          <p className="intro">
            Asocia cargos de minibar, restaurante, lavandería u otros servicios a una estancia activa.
          </p>
        </div>
        <button
          className="button-secondary"
          type="button"
          onClick={loadActiveStays}
          disabled={loading || saving}
        >
          {loading ? 'Actualizando…' : 'Actualizar estancias'}
        </button>
      </div>

      {notice && (
        <div className={`rooms-notice feedback-${notice.tone}`} role="status" aria-live="polite">
          {notice.text}
        </div>
      )}
      {loadError && (
        <div className="rooms-notice feedback-error" role="alert">{loadError}</div>
      )}

      {loading ? (
        <div className="module-placeholder" role="status">Cargando estancias activas…</div>
      ) : reservations.length ? (
        <div className="consumption-layout">
          <section className="check-in-list" aria-label="Estancias activas">
            {reservations.map((reservation) => {
              const consumedTotal = (reservation.consumptions || []).reduce(
                (total, item) => total + Number(item.subtotal || item.amount || 0),
                0,
              );
              return (
                <button
                  className={`checkout-reservation-option${selectedId === reservation._id ? ' is-selected' : ''}`}
                  type="button"
                  key={reservation._id}
                  onClick={() => setSelectedId(reservation._id)}
                  aria-pressed={selectedId === reservation._id}
                >
                  <span>
                    <strong>{reservation.guest.fullName}</strong>
                    <span>Habitación {reservation.roomNumber} · {reservation.roomType}</span>
                    <span>{(reservation.consumptions || []).length} consumos registrados</span>
                  </span>
                  <strong>{formatCurrency(consumedTotal)}</strong>
                </button>
              );
            })}
          </section>

          {selectedReservation && (
            <div className="consumption-entry-column">
              <form className="receptionist-form-card checkout-form" onSubmit={handleSubmit} noValidate>
                <div className="receptionist-form-heading">
                  <div>
                    <h2>Nuevo consumo</h2>
                    <p>{selectedReservation.guest.fullName} · Habitación {selectedReservation.roomNumber}</p>
                  </div>
                </div>
                <div className="consumption-form-grid">
                  <label className="form-field consumption-description">
                    <span className="field-label">Concepto *</span>
                    <input
                      className="form-input"
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                      placeholder="Minibar, lavandería, restaurante…"
                      minLength="2"
                      maxLength="120"
                      required
                    />
                  </label>
                  <label className="form-field">
                    <span className="field-label">Cantidad *</span>
                    <input
                      className="form-input"
                      type="number"
                      min="1"
                      max="1000"
                      step="1"
                      value={quantity}
                      onChange={(event) => setQuantity(event.target.value)}
                      required
                    />
                  </label>
                  <label className="form-field">
                    <span className="field-label">Precio unitario (COP) *</span>
                    <input
                      className="form-input"
                      type="number"
                      min="0"
                      step="0.01"
                      value={unitPrice}
                      onChange={(event) => setUnitPrice(event.target.value)}
                      required
                    />
                  </label>
                </div>
                <div className="checkout-total-row">
                  <span>Subtotal del consumo</span>
                  <strong>{lineTotal === null ? '—' : formatCurrency(lineTotal)}</strong>
                </div>
                <div className="receptionist-form-footer">
                  <p>El consumo se añadirá a la liquidación final de esta estancia.</p>
                  <button className="button-primary" type="submit" disabled={saving}>
                    {saving ? 'Registrando…' : 'Registrar consumo'}
                  </button>
                </div>
              </form>

              <section className="consumption-history" aria-labelledby="consumption-history-title">
                <h2 id="consumption-history-title">Consumos de la estancia</h2>
                {(selectedReservation.consumptions || []).length ? (
                  <div className="consumption-history-list">
                    {selectedReservation.consumptions.map((item, index) => (
                      <div className="consumption-history-row" key={`${item.description}-${index}`}>
                        <span>
                          <strong>{item.description}</strong>
                          <span>{item.quantity} × {formatCurrency(item.unitPrice)}</span>
                        </span>
                        <strong>{formatCurrency(item.subtotal ?? item.amount)}</strong>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="reservation-empty-state">Todavía no hay consumos asociados a esta estancia.</p>
                )}
              </section>
            </div>
          )}
        </div>
      ) : !loadError ? (
        <div className="reservation-empty-state check-in-empty-state">
          No hay estancias activas para registrar consumos.
        </div>
      ) : null}
    </section>
  );
}
