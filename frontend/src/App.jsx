import { useCallback, useEffect, useState } from 'react';
import { checkBackend } from './services/api.js';

const stateLabels = {
  checking: 'Comprobando conexión',
  connected: 'Backend conectado',
  disconnected: 'Backend sin conexión',
};

export default function App() {
  const [connection, setConnection] = useState('checking');
  const [message, setMessage] = useState('');

  const verifyConnection = useCallback(async () => {
    setConnection('checking');
    setMessage('');

    try {
      const health = await checkBackend();
      setConnection('connected');
      setMessage(health.message || 'La API respondió correctamente.');
    } catch (error) {
      setConnection('disconnected');
      setMessage(error.message || 'No fue posible consultar el backend.');
    }
  }, []);

  useEffect(() => {
    verifyConnection();
  }, [verifyConnection]);

  return (
    <main className="page-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Estancia, inicio">
          <span className="brand-mark" aria-hidden="true">E</span>
          <span>estancia<span className="brand-period">.</span></span>
        </a>
        <span className="topbar-label">Plataforma de gestión hotelera</span>
      </header>

      <section className="welcome-card" aria-labelledby="welcome-title">
        <div className="welcome-copy">
          <p className="eyebrow">ESPACIO DE TRABAJO</p>
          <h1 id="welcome-title">Tu operación,<br />en un solo lugar.</h1>
          <p className="intro">
            La interfaz está lista para comenzar a integrar los módulos del hotel.
          </p>

          <div className={`connection-card connection-${connection}`} role="status" aria-live="polite">
            <span className="connection-indicator" aria-hidden="true" />
            <div>
              <strong>{stateLabels[connection]}</strong>
              <p>{message}</p>
            </div>
            <button
              className="refresh-button"
              type="button"
              onClick={verifyConnection}
              disabled={connection === 'checking'}
              aria-label="Volver a comprobar la conexión"
              title="Volver a comprobar"
            >
              ↻
            </button>
          </div>

          <div className="endpoint-note">
            <span>API</span>
            <code>/api/v1</code>
          </div>
        </div>

        <div className="welcome-art" aria-hidden="true">
          <div className="sun" />
          <div className="arch arch-back" />
          <div className="arch arch-front">
            <div className="arch-window" />
            <div className="arch-base" />
          </div>
          <div className="plant plant-one"><i /><i /><i /><b /></div>
          <div className="plant plant-two"><i /><i /><i /><b /></div>
          <div className="art-caption">HOSPITALIDAD, CON CALMA</div>
        </div>
      </section>

      <footer className="page-footer">
        <span>ESTANCIA · GESTIÓN HOTELERA</span>
        <span>Frontend inicial · React</span>
      </footer>
    </main>
  );
}
