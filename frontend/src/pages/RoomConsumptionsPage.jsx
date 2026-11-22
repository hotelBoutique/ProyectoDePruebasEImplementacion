import { useCallback, useEffect, useState } from 'react';
import {
  getPendingCheckOuts,
  getReservationConsumptions,
  updateReservationConsumption,
  voidReservationConsumption,
} from '../services/api.js';

function formatCurrency(value) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function formatDateTime(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function getErrorMessage(error, fallback) {
  return Array.isArray(error.details) && error.details.length
    ? error.details.join('. ')
    : error.message || fallback;
}

function activeTotal(reservation) {
  return (reservation.consumptions || [])
    .filter((item) => item.status !== 'anulado')
    .reduce((total, item) => total + Number(item.subtotal || item.amount || 0), 0);
}

function ConsumptionEditor({ consumption, busy, onSave, onCancel }) {
  const isCatalogItem = Boolean(consumption.product);
  const [description, setDescription] = useState(consumption.description);
  const [quantity, setQuantity] = useState(String(consumption.quantity));
  const [unitPrice, setUnitPrice] = useState(String(consumption.unitPrice));
  const [error, setError] = useState('');

  function handleSubmit(event) {
    event.preventDefault();
    const quantityValue = Number(quantity);
    const priceValue = Number(unitPrice);
    if (!Number.isInteger(quantityValue) || quantityValue < 1 || quantityValue > 1000) {
      setError('La cantidad debe ser un entero entre 1 y 1000.');
      return;
    }

    const changes = {};
    if (quantityValue !== Number(consumption.quantity)) changes.quantity = quantityValue;
    if (!isCatalogItem) {
      const text = description.trim();
      if (text.length < 2 || text.length > 120) {
        setError('El concepto debe tener entre 2 y 120 caracteres.');
        return;
      }
      if (unitPrice.trim() === '' || !Number.isFinite(priceValue) || priceValue < 0) {
        setError('El precio unitario debe ser un número mayor o igual a 0.');
        return;
      }
      if (text !== consumption.description) changes.description = text;
      if (priceValue !== Number(consumption.unitPrice)) changes.unitPrice = priceValue;
    }

    if (!Object.keys(changes).length) {
      setError('No hay cambios para guardar.');
      return;
    }
    setError('');
    onSave(changes);
  }

  return (
    <form className="reservation-cancellation-form" onSubmit={handleSubmit} noValidate>
      <div className="consumption-form-grid">
        <label className="form-field consumption-description">
          <span className="field-label">Concepto</span>
          <input
            className="form-input"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={120}
            readOnly={isCatalogItem}
            disabled={busy}
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
            disabled={busy}
          />
        </label>
        <label className="form-field">
          <span className="field-label">Precio unitario</span>
          <input
            className="form-input"
            type="number"
            min="0"
            step="any"
            value={unitPrice}
            onChange={(event) => setUnitPrice(event.target.value)}
            readOnly={isCatalogItem}
            disabled={busy}
          />
        </label>
      </div>
      {isCatalogItem && (
        <p className="room-description">
          Producto del catálogo: solo se corrige la cantidad y las existencias se ajustan automáticamente.
        </p>
      )}
      {error && <p className="reservation-inline-error" role="alert">{error}</p>}
      <div className="receptionist-form-actions">
        <button className="button-secondary" type="button" onClick={onCancel} disabled={busy}>Volver</button>
        <button className="button-primary" type="submit" disabled={busy}>{busy ? 'Guardando…' : 'Guardar corrección'}</button>
      </div>
    </form>
  );
}

function VoidForm({ busy, onConfirm, onCancel }) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  function handleSubmit(event) {
    event.preventDefault();
    const text = reason.trim();
    if (text.length < 3 || text.length > 500) {
      setError('El motivo debe tener entre 3 y 500 caracteres.');
      return;
    }
    setError('');
    onConfirm(text);
  }

  return (
    <form className="reservation-cancellation-form" onSubmit={handleSubmit} noValidate>
      <label className="form-field">
        <span className="field-label">Motivo de anulación *</span>
        <textarea
          className="form-input room-description-input"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          maxLength={500}
          rows={3}
          disabled={busy}
        />
      </label>
      {error && <p className="reservation-inline-error" role="alert">{error}</p>}
      <div className="receptionist-form-actions">
        <button className="button-secondary" type="button" onClick={onCancel} disabled={busy}>Volver</button>
        <button className="button-primary" type="submit" disabled={busy}>{busy ? 'Anulando…' : 'Confirmar anulación'}</button>
      </div>
    </form>
  );
}

export default function RoomConsumptionsPage({ token, onNavigate }) {
  const [stays, setStays] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [account, setAccount] = useState(null);
  const [loadingStays, setLoadingStays] = useState(true);
  const [loadingAccount, setLoadingAccount] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [notice, setNotice] = useState(null);
  const [action, setAction] = useState(null);
  const [busy, setBusy] = useState(false);

  const selectedStay = stays.find((stay) => stay._id === selectedId);

  const loadStays = useCallback(async () => {
    setLoadingStays(true);
    setLoadError('');
    try {
      const response = await getPendingCheckOuts(token);
      const activeStays = response.data?.reservations || [];
      setStays(activeStays);
      setSelectedId((current) => (
        activeStays.some((stay) => stay._id === current) ? current : activeStays[0]?._id || ''
      ));
    } catch (error) {
      setLoadError(getErrorMessage(error, 'No fue posible cargar las estancias activas.'));
    } finally {
      setLoadingStays(false);
    }
  }, [token]);

  const loadAccount = useCallback(async (reservationId) => {
    if (!reservationId) {
      setAccount(null);
      return;
    }
    setLoadingAccount(true);
    try {
      const response = await getReservationConsumptions(token, reservationId);
      setAccount(response.data || null);
    } catch (error) {
      setAccount(null);
      setNotice({ tone: 'error', text: getErrorMessage(error, 'No fue posible cargar los consumos de la estancia.') });
    } finally {
      setLoadingAccount(false);
    }
  }, [token]);

  useEffect(() => {
    loadStays();
  }, [loadStays]);

  useEffect(() => {
    setAction(null);
    loadAccount(selectedId);
  }, [selectedId, loadAccount]);

  async function refreshAfterChange(message) {
    setAction(null);
    setNotice({ tone: 'success', text: message });
    await Promise.all([loadAccount(selectedId), loadStays()]);
  }

  async function saveCorrection(consumption, changes) {
    setBusy(true);
    setNotice(null);
    try {
      const response = await updateReservationConsumption(token, selectedId, consumption._id, changes);
      await refreshAfterChange(response.message || 'El consumo se corrigió correctamente.');
    } catch (error) {
      setNotice({ tone: 'error', text: getErrorMessage(error, 'No fue posible corregir el consumo.') });
    } finally {
      setBusy(false);
    }
  }

  async function confirmVoid(consumption, reason) {
    setBusy(true);
    setNotice(null);
    try {
      const response = await voidReservationConsumption(token, selectedId, consumption._id, reason);
      await refreshAfterChange(response.message || 'El consumo se anuló y no se cobrará en la liquidación.');
    } catch (error) {
      setNotice({ tone: 'error', text: getErrorMessage(error, 'No fue posible anular el consumo.') });
    } finally {
      setBusy(false);
    }
  }

  const activeItems = account?.activeConsumptions || [];
  const voidedItems = account?.voidedConsumptions || [];

  return (
    <section className="rooms-page consumption-page" aria-labelledby="room-consumptions-title">
      <div className="rooms-heading">
        <div>
          <p className="eyebrow">CUENTA DEL HUÉSPED</p>
          <h1 id="room-consumptions-title">Consumos por habitación</h1>
          <p className="intro">
            Revisa los cargos de cada estancia activa y corrige o anula los registrados por error antes del check-out.
          </p>
        </div>
        <div className="reservation-heading-actions">
          <button className="button-secondary" type="button" onClick={loadStays} disabled={loadingStays || busy}>
            {loadingStays ? 'Actualizando…' : 'Actualizar estancias'}
          </button>
          <button className="button-primary" type="button" onClick={() => onNavigate?.('reception-consumptions-create')}>
            ＋ Registrar consumo
          </button>
        </div>
      </div>

      {notice && (
        <div className={`rooms-notice feedback-${notice.tone}`} role="status" aria-live="polite">{notice.text}</div>
      )}
      {loadError && <div className="rooms-notice feedback-error" role="alert">{loadError}</div>}

      {loadingStays && !stays.length ? (
        <div className="module-placeholder" role="status">Cargando estancias activas…</div>
      ) : stays.length ? (
        <div className="consumption-layout">
          <section className="check-in-list" aria-label="Estancias activas">
            {stays.map((stay) => (
              <button
                className={`checkout-reservation-option${selectedId === stay._id ? ' is-selected' : ''}`}
                type="button"
                key={stay._id}
                onClick={() => { setNotice(null); setSelectedId(stay._id); }}
                aria-pressed={selectedId === stay._id}
              >
                <span>
                  <strong>Habitación {stay.roomNumber}</strong>
                  <span>{stay.guest?.fullName} · {stay.roomType}</span>
                  <span>{(stay.consumptions || []).filter((item) => item.status !== 'anulado').length} consumos vigentes</span>
                </span>
                <strong>{formatCurrency(activeTotal(stay))}</strong>
              </button>
            ))}
          </section>

          <div className="consumption-entry-column">
            <section className="consumption-history" aria-labelledby="room-consumptions-active">
              <div className="receptionist-form-heading">
                <div>
                  <h2 id="room-consumptions-active">
                    {selectedStay ? `Habitación ${selectedStay.roomNumber}` : 'Consumos'}
                  </h2>
                  {selectedStay && <p>{selectedStay.guest?.fullName} · ingreso {formatDateTime(selectedStay.checkInAt)}</p>}
                </div>
              </div>

              {loadingAccount ? (
                <p className="reservation-empty-state" role="status">Cargando consumos…</p>
              ) : activeItems.length ? (
                <div className="consumption-history-list">
                  {activeItems.map((item) => (
                    <div key={item._id}>
                      <div className="consumption-history-row">
                        <span>
                          <strong>{item.description}</strong>
                          <span>
                            {item.quantity} × {formatCurrency(item.unitPrice)} · {formatDateTime(item.createdAt)}
                            {item.product ? ' · Catálogo' : ''}
                          </span>
                        </span>
                        <strong>{formatCurrency(item.subtotal ?? item.amount)}</strong>
                      </div>
                      {action?.id === item._id ? (
                        action.type === 'edit' ? (
                          <ConsumptionEditor
                            consumption={item}
                            busy={busy}
                            onSave={(changes) => saveCorrection(item, changes)}
                            onCancel={() => setAction(null)}
                          />
                        ) : (
                          <VoidForm
                            busy={busy}
                            onConfirm={(reason) => confirmVoid(item, reason)}
                            onCancel={() => setAction(null)}
                          />
                        )
                      ) : (
                        <div className="receptionist-actions">
                          <button
                            className="button-secondary receptionist-status-action receptionist-edit-action"
                            type="button"
                            onClick={() => { setNotice(null); setAction({ id: item._id, type: 'edit' }); }}
                            disabled={busy}
                          >
                            Corregir
                          </button>
                          <button
                            className="receptionist-status-action receptionist-deactivate-action"
                            type="button"
                            onClick={() => { setNotice(null); setAction({ id: item._id, type: 'void' }); }}
                            disabled={busy}
                          >
                            Anular
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                  <div className="checkout-total-row">
                    <span>Total de consumos vigentes</span>
                    <strong>{formatCurrency(account?.total)}</strong>
                  </div>
                </div>
              ) : (
                <p className="reservation-empty-state">Esta estancia no tiene consumos vigentes.</p>
              )}
            </section>

            {voidedItems.length > 0 && (
              <section className="consumption-history" aria-labelledby="room-consumptions-voided">
                <h2 id="room-consumptions-voided">Consumos anulados</h2>
                <div className="consumption-history-list">
                  {voidedItems.map((item) => (
                    <div className="consumption-history-row" key={item._id}>
                      <span>
                        <strong><s>{item.description}</s></strong>
                        <span>{item.quantity} × {formatCurrency(item.unitPrice)} · Anulado {formatDateTime(item.voidedAt)}</span>
                        {item.voidReason && <span>Motivo: {item.voidReason}</span>}
                      </span>
                      <strong><s>{formatCurrency(item.subtotal ?? item.amount)}</s></strong>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      ) : !loadError ? (
        <div className="reservation-empty-state check-in-empty-state">
          No hay habitaciones ocupadas con cuenta abierta.
        </div>
      ) : null}
    </section>
  );
}
