import { useCallback, useEffect, useMemo, useState } from 'react';
import { ReceiptDialog } from '../components/PaymentReceipt.jsx';
import { checkOutReservation, getPendingCheckOuts } from '../services/api.js';

function formatCurrency(value) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function getErrorMessage(error) {
  return Array.isArray(error.details) && error.details.length
    ? error.details.join('. ')
    : error.message || 'No fue posible completar el check-out.';
}

export default function CheckOutPage({ token, initialReservationId = '' }) {
  const [reservations, setReservations] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [additionalCharges, setAdditionalCharges] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState('efectivo');
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [notice, setNotice] = useState(null);
  const [receipt, setReceipt] = useState(null);
  const [showReceipt, setShowReceipt] = useState(false);

  const selectedReservation = reservations.find((item) => item._id === selectedId);
  const estimate = selectedReservation?.settlementEstimate;

  const chargesTotal = useMemo(
    () => additionalCharges.reduce((total, charge) => {
      const quantity = Number(charge.quantity);
      const unitPrice = Number(charge.unitPrice);
      if (
        !Number.isInteger(quantity)
        || quantity < 1
        || !Number.isFinite(unitPrice)
        || unitPrice < 0
      ) {
        return total;
      }
      return total + Math.round(unitPrice * 100) * quantity;
    }, 0) / 100,
    [additionalCharges],
  );
  const totalDue = estimate
    ? (
      Math.round(estimate.roomSubtotal * 100)
      + Math.round((estimate.consumptionsTotal || 0) * 100)
      + Math.round(chargesTotal * 100)
    ) / 100
    : 0;

  const loadPendingCheckOuts = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const response = await getPendingCheckOuts(token);
      const pending = response.data?.reservations || [];
      setReservations(pending);
      setSelectedId((currentId) => (
        pending.some((reservation) => reservation._id === currentId)
          ? currentId
          : pending.find((reservation) => reservation._id === initialReservationId)?._id
            || pending[0]?._id
            || ''
      ));
    } catch (error) {
      setLoadError(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [initialReservationId, token]);

  useEffect(() => {
    loadPendingCheckOuts();
  }, [loadPendingCheckOuts]);

  function updateCharge(index, field, value) {
    setAdditionalCharges((current) => current.map((charge, chargeIndex) => (
      chargeIndex === index ? { ...charge, [field]: value } : charge
    )));
  }

  function addCharge() {
    setAdditionalCharges((current) => [
      ...current,
      { description: '', quantity: '1', unitPrice: '' },
    ]);
  }

  function removeCharge(index) {
    setAdditionalCharges((current) => current.filter((_, chargeIndex) => chargeIndex !== index));
  }

  function selectReservation(reservationId) {
    setSelectedId(reservationId);
    setAdditionalCharges([]);
    setNotice(null);
    setReceipt(null);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setNotice(null);

    if (!selectedReservation || !estimate) {
      setNotice({
        tone: 'error',
        text: 'La estancia no tiene una fecha de ingreso válida para generar la liquidación.',
      });
      return;
    }

    const invalidCharge = additionalCharges.find((charge) => (
      charge.description.trim().length < 2
      || charge.description.trim().length > 120
      || charge.quantity === ''
      || !Number.isInteger(Number(charge.quantity))
      || Number(charge.quantity) < 1
      || Number(charge.quantity) > 1000
      || charge.unitPrice === ''
      || !Number.isFinite(Number(charge.unitPrice))
      || Number(charge.unitPrice) < 0
    ));
    if (invalidCharge) {
      setNotice({
        tone: 'error',
        text: 'Cada cargo debe tener un concepto de 2 a 120 caracteres y un importe válido mayor o igual a 0.',
      });
      return;
    }

    setProcessing(true);
    try {
      const response = await checkOutReservation(token, selectedReservation._id, {
        additionalCharges: additionalCharges.map((charge) => ({
          description: charge.description.trim(),
          quantity: Number(charge.quantity),
          unitPrice: Number(charge.unitPrice),
        })),
        paidAmount: totalDue,
        paymentMethod,
      });
      setReceipt(response.data?.receipt || null);
      setNotice({
        tone: 'success',
        text: response.message || 'Pago confirmado y estancia finalizada correctamente.',
      });
      setAdditionalCharges([]);
      await loadPendingCheckOuts();
    } catch (error) {
      setNotice({ tone: 'error', text: getErrorMessage(error) });
      if (error.status === 400 || error.status === 409) {
        await loadPendingCheckOuts();
      }
    } finally {
      setProcessing(false);
    }
  }

  return (
    <section className="rooms-page checkout-page" aria-labelledby="checkout-title">
      <div className="rooms-heading">
        <div>
          <p className="eyebrow">CIERRE DE ESTANCIA</p>
          <h1 id="checkout-title">Pago y check-out</h1>
          <p className="intro">
            Revisa la estancia, registra cargos adicionales si aplican y confirma el pago para liberar la habitación.
          </p>
        </div>
        <button
          className="button-secondary"
          type="button"
          onClick={loadPendingCheckOuts}
          disabled={loading || processing}
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
        <div className="rooms-notice feedback-error" role="alert">
          {loadError}
        </div>
      )}

      {receipt && (
        <section className="reservation-receipt checkout-receipt" aria-labelledby="checkout-receipt-title">
          <div className="reservation-receipt-heading">
            <span className="reservation-receipt-mark" aria-hidden="true">✓</span>
            <div>
              <p className="eyebrow">LIQUIDACIÓN PAGADA</p>
              <h2 id="checkout-receipt-title">Salida confirmada</h2>
              <p>La habitación {receipt.roomNumber} quedó disponible · {formatDateTime(receipt.checkOutAt)}</p>
            </div>
            <button className="button-primary checkout-receipt-action" type="button" onClick={() => setShowReceipt(true)}>
              Ver comprobante{receipt.settlement.receiptNumber ? ` ${receipt.settlement.receiptNumber}` : ''}
            </button>
          </div>
          <dl className="reservation-receipt-grid">
            <div><dt>Huésped</dt><dd>{receipt.guest.fullName}</dd></div>
            <div><dt>Habitación</dt><dd>{receipt.roomNumber} · {receipt.roomType}</dd></div>
            <div><dt>Noches cobradas</dt><dd>{receipt.settlement.actualNights}</dd></div>
            <div><dt>Tarifa por noche</dt><dd>{formatCurrency(receipt.settlement.nightlyRate)}</dd></div>
            <div><dt>Alojamiento</dt><dd>{formatCurrency(receipt.settlement.roomSubtotal)}</dd></div>
            {(receipt.settlement.consumptions || []).map((consumption, index) => (
              <div key={`consumption-${index}`}>
                <dt>
                  {consumption.description} · {consumption.quantity} ×{' '}
                  {formatCurrency(consumption.unitPrice)}
                </dt>
                <dd>{formatCurrency(consumption.subtotal)}</dd>
              </div>
            ))}
            <div>
              <dt>Subtotal de consumos registrados</dt>
              <dd>{formatCurrency(receipt.settlement.consumptionsTotal)}</dd>
            </div>
            {receipt.settlement.additionalCharges.map((charge, index) => (
              <div key={`${charge.description}-${index}`}>
                <dt>
                  {charge.description} · {charge.quantity ?? 1} ×{' '}
                  {formatCurrency(charge.unitPrice ?? charge.amount)}
                </dt>
                <dd>{formatCurrency(charge.subtotal ?? charge.amount)}</dd>
              </div>
            ))}
            <div>
              <dt>Subtotal de cargos al cierre</dt>
              <dd>{formatCurrency(receipt.settlement.additionalChargesTotal)}</dd>
            </div>
            <div><dt>Impuestos</dt><dd>No configurados</dd></div>
            <div className="reservation-receipt-total">
              <dt>Gran total pagado · {receipt.settlement.paymentMethod}</dt>
              <dd>{formatCurrency(receipt.settlement.paidAmount)}</dd>
            </div>
          </dl>
        </section>
      )}

      {loading ? (
        <div className="module-placeholder" role="status">Cargando estancias activas…</div>
      ) : reservations.length ? (
        <div className="checkout-layout">
          <section className="check-in-list" aria-label="Estancias activas">
            {reservations.map((reservation) => (
              <button
                className={`checkout-reservation-option${selectedId === reservation._id ? ' is-selected' : ''}`}
                type="button"
                key={reservation._id}
                onClick={() => selectReservation(reservation._id)}
                aria-pressed={selectedId === reservation._id}
              >
                <span>
                  <strong>{reservation.guest.fullName}</strong>
                  <span>Habitación {reservation.roomNumber} · {reservation.roomType}</span>
                  <span>Ingreso: {reservation.checkInAt ? formatDateTime(reservation.checkInAt) : 'Fecha no registrada'}</span>
                </span>
                <strong>
                  {reservation.settlementEstimate
                    ? formatCurrency(reservation.settlementEstimate.totalDue)
                    : 'Liquidación no disponible'}
                </strong>
              </button>
            ))}
          </section>

          {selectedReservation && (
            <form className="receptionist-form-card checkout-form" onSubmit={handleSubmit} noValidate>
              <div className="receptionist-form-heading">
                <div>
                  <h2>Liquidación de {selectedReservation.guest.fullName}</h2>
                  <p>El total se calcula y valida nuevamente en el servidor al confirmar.</p>
                </div>
              </div>
              {estimate ? (
                <>
                  <dl className="checkout-summary">
                    <div><dt>Habitación</dt><dd>{selectedReservation.roomNumber} · {selectedReservation.roomType}</dd></div>
                    <div><dt>Noches efectivas</dt><dd>{estimate.actualNights}</dd></div>
                    <div><dt>Tarifa por noche</dt><dd>{formatCurrency(estimate.nightlyRate)}</dd></div>
                    <div><dt>Alojamiento</dt><dd>{formatCurrency(estimate.roomSubtotal)}</dd></div>
                    <div><dt>Consumos registrados</dt><dd>{formatCurrency(estimate.consumptionsTotal || 0)}</dd></div>
                    <div><dt>Cargos al cierre</dt><dd>{formatCurrency(chargesTotal)}</dd></div>
                    <div><dt>Impuestos</dt><dd>No configurados</dd></div>
                  </dl>

                  {(selectedReservation.consumptions || []).length > 0 && (
                    <section className="checkout-consumption-breakdown" aria-label="Consumos registrados">
                      <h3>Detalle de consumos</h3>
                      {selectedReservation.consumptions.map((consumption, index) => (
                        <div className="consumption-history-row" key={`checkout-consumption-${index}`}>
                          <span>
                            <strong>{consumption.description}</strong>
                            <span>{consumption.quantity} × {formatCurrency(consumption.unitPrice)}</span>
                          </span>
                          <strong>{formatCurrency(consumption.subtotal)}</strong>
                        </div>
                      ))}
                    </section>
                  )}

                  <div className="checkout-charges-heading">
                    <h3>Cargos adicionales</h3>
                    <button
                      className="button-secondary"
                      type="button"
                      onClick={addCharge}
                      disabled={processing || additionalCharges.length >= 20}
                    >
                      Añadir cargo
                    </button>
                  </div>
                  {additionalCharges.map((charge, index) => (
                    <div className="checkout-charge-row" key={index}>
                      <label className="form-field">
                        <span className="field-label">Concepto</span>
                        <input
                          className="form-input"
                          value={charge.description}
                          onChange={(event) => updateCharge(index, 'description', event.target.value)}
                          maxLength="120"
                          required
                        />
                      </label>
                      <label className="form-field">
                        <span className="field-label">Cantidad</span>
                        <input
                          className="form-input"
                          type="number"
                          min="1"
                          max="1000"
                          step="1"
                          value={charge.quantity}
                          onChange={(event) => updateCharge(index, 'quantity', event.target.value)}
                          required
                        />
                      </label>
                      <label className="form-field">
                        <span className="field-label">Precio unitario (COP)</span>
                        <input
                          className="form-input"
                          type="number"
                          min="0"
                          step="0.01"
                          value={charge.unitPrice}
                          onChange={(event) => updateCharge(index, 'unitPrice', event.target.value)}
                          required
                        />
                      </label>
                      <button
                        className="button-secondary checkout-remove-charge"
                        type="button"
                        onClick={() => removeCharge(index)}
                        aria-label={`Eliminar cargo ${index + 1}`}
                        disabled={processing}
                      >
                        Quitar
                      </button>
                      <p className="checkout-charge-subtotal">
                        Subtotal:{' '}
                        {Number.isInteger(Number(charge.quantity))
                        && Number(charge.quantity) > 0
                        && Number.isFinite(Number(charge.unitPrice))
                        && Number(charge.unitPrice) >= 0
                          ? formatCurrency(Math.round(Number(charge.unitPrice) * 100) * Number(charge.quantity) / 100)
                          : 'Ingresa cantidad y precio unitario'}
                      </p>
                    </div>
                  ))}

                  <label className="form-field checkout-payment-method">
                    <span className="field-label">Método de pago *</span>
                    <select
                      className="form-input"
                      value={paymentMethod}
                      onChange={(event) => setPaymentMethod(event.target.value)}
                      required
                    >
                      <option value="efectivo">Efectivo</option>
                      <option value="tarjeta">Tarjeta</option>
                      <option value="transferencia">Transferencia</option>
                    </select>
                  </label>

                  <div className="checkout-total-row">
                    <span>Total a confirmar</span>
                    <strong>{formatCurrency(totalDue)}</strong>
                  </div>
                  <div className="receptionist-form-footer">
                    <p>Al confirmar el pago, la estancia se marcará como pagada y finalizada.</p>
                    <button className="button-primary" type="submit" disabled={processing || !estimate}>
                      {processing ? 'Procesando pago…' : 'Confirmar pago y check-out'}
                    </button>
                  </div>
                </>
              ) : (
                <div className="rooms-notice feedback-error" role="alert">
                  No es posible liquidar esta estancia porque falta una fecha de check-in válida.
                </div>
              )}
            </form>
          )}
        </div>
      ) : !loadError ? (
        <div className="reservation-empty-state check-in-empty-state">
          No hay huéspedes con una estancia activa para procesar el check-out.
        </div>
      ) : null}

      {showReceipt && receipt && (
        <ReceiptDialog token={token} reservationId={receipt.reservationId} onClose={() => setShowReceipt(false)} />
      )}
    </section>
  );
}
