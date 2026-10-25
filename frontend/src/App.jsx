import { useEffect, useState } from 'react';
import {
  getAdminDashboard,
  getCurrentUser,
  getReceptionDashboard,
  login,
  logoutSession,
} from './services/api.js';

const SESSION_TOKEN_KEY = 'estancia.session.token';
const ROLE_ADMIN = 'ADMIN';
const ROLE_RECEPTIONIST = 'RECEPCIONISTA';

async function getRoleDashboard(token, role) {
  if (role === ROLE_ADMIN) return getAdminDashboard(token);
  if (role === ROLE_RECEPTIONIST) return getReceptionDashboard(token);
  throw new Error('Esta cuenta no tiene un rol habilitado para el panel.');
}

function Brand() {
  return (
    <a className="brand" href="/" aria-label="Estancia, inicio">
      <span className="brand-mark" aria-hidden="true">E</span>
      <span>estancia<span className="brand-period">.</span></span>
    </a>
  );
}

function Topbar({ children }) {
  return (
    <header className="topbar">
      <Brand />
      {children}
    </header>
  );
}

function LoginScreen({ onLogin, busy, message, messageTone }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    await onLogin({ email: email.trim(), password });
    setPassword('');
  }

  return (
    <div className="page-shell">
      <Topbar>
        <span className="topbar-label">Administración y recepción</span>
      </Topbar>

      <main className="auth-layout">
        <section className="auth-panel" aria-labelledby="login-title">
          <div className="auth-copy">
            <p className="eyebrow">ACCESO AL EQUIPO</p>
            <h1 id="login-title">Tu operación,<br />bajo control.</h1>
            <p className="intro">
              Inicia sesión para entrar al espacio de trabajo de Estancia.
            </p>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            <label className="form-field" htmlFor="admin-email">
              <span className="field-label">Correo electrónico</span>
              <input
                id="admin-email"
                className="form-input"
                type="email"
                name="email"
                autoComplete="username"
                placeholder="usuario@hotel.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                disabled={busy}
              />
            </label>

            <div className="form-field">
              <label className="field-label" htmlFor="admin-password">Contraseña</label>
              <span className="password-control">
                <input
                  id="admin-password"
                  className="form-input"
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  autoComplete="current-password"
                  placeholder="Ingresa tu contraseña"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  disabled={busy}
                />
                <button
                  className="password-toggle"
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  aria-pressed={showPassword}
                  disabled={busy}
                >
                  {showPassword ? 'Ocultar' : 'Mostrar'}
                </button>
              </span>
            </div>

            <div className="auth-feedback" aria-live="polite">
              {message && <p className={`feedback-message feedback-${messageTone}`}>{message}</p>}
            </div>

            <button className="button-primary auth-submit" type="submit" disabled={busy}>
              {busy ? (
                <><span className="button-spinner" aria-hidden="true" /> Verificando acceso</>
              ) : (
                <>Iniciar sesión <span aria-hidden="true">→</span></>
              )}
            </button>
          </form>

          <p className="auth-hint">
            Las opciones disponibles dependen del rol asignado a tu cuenta.
          </p>
        </section>

        <aside className="auth-aside" aria-label="Seguridad de la plataforma">
          <div className="aside-topline">
            <span>ESTANCIA / EQUIPO</span>
            <span>01 — 03</span>
          </div>
          <div className="auth-art" aria-hidden="true">
            <div className="auth-sun" />
            <div className="auth-arch-back" />
            <div className="auth-arch-front">
              <div className="auth-arch-window" />
              <span className="auth-seal">E</span>
            </div>
            <span className="auth-art-label">HOSPITALIDAD, CON CALMA</span>
          </div>
          <div className="security-note">
            <span className="security-note-icon" aria-hidden="true">✓</span>
            <div>
              <strong>Acceso protegido</strong>
              <p>Verificamos tu identidad y permisos antes de abrir cada espacio.</p>
            </div>
          </div>
        </aside>
      </main>

      <footer className="page-footer">
        <span>ESTANCIA · GESTIÓN HOTELERA</span>
        <span>Acceso seguro por rol</span>
      </footer>
    </div>
  );
}

function RoleDashboard({ user, role, onLogout, busy }) {
  const isAdmin = role === ROLE_ADMIN;
  const firstName = user?.name?.trim().split(/\s+/)[0] || 'equipo';
  const roleLabel = isAdmin ? 'ADMINISTRADOR' : 'RECEPCIONISTA';

  return (
    <div className="page-shell admin-shell">
      <Topbar>
        <div className="admin-topbar-actions">
          <span className="topbar-label">{isAdmin ? 'Panel administrativo' : 'Espacio de recepción'}</span>
          <button className="button-secondary logout-button" type="button" onClick={onLogout} disabled={busy}>
            {busy ? 'Cerrando sesión…' : 'Cerrar sesión'}
          </button>
        </div>
      </Topbar>

      <main className="dashboard-main">
        <section className="dashboard-heading" aria-labelledby="dashboard-title">
          <div>
            <p className="eyebrow">{isAdmin ? 'ESPACIO DE ADMINISTRACIÓN' : 'ESPACIO DE RECEPCIÓN'}</p>
            <h1 id="dashboard-title">Hola, {firstName}.</h1>
            <p className="intro">
              {isAdmin
                ? 'Tu sesión está activa y tienes acceso a las funciones administrativas.'
                : 'Tu sesión está activa y tienes acceso a las funciones de recepción.'}
            </p>
          </div>
          <span className="role-badge"><span aria-hidden="true">✦</span> {roleLabel}</span>
        </section>

        <section className="dashboard-cards" aria-label="Estado de la cuenta">
          <article className="summary-card summary-card-primary">
            <div className="summary-card-topline">
              <span className="card-kicker">ESTADO DE ACCESO</span>
              <span className="summary-icon" aria-hidden="true">✓</span>
            </div>
            <strong>Verificado</strong>
            <p>La API confirmó tus credenciales y los permisos de {isAdmin ? 'administración' : 'recepción'}.</p>
          </article>

          <article className="summary-card">
            <span className="card-kicker">CUENTA ACTIVA</span>
            <strong className="account-email">{user?.email || 'Correo no disponible'}</strong>
            <p>Esta cuenta tiene el rol {roleLabel.toLowerCase()} y acceso a sus rutas autorizadas.</p>
          </article>

          <article className="summary-card">
            <span className="card-kicker">SESIÓN</span>
            <strong className="session-state"><span className="session-dot" /> Activa</strong>
            <p>La sesión está vinculada a esta pestaña del navegador.</p>
          </article>
        </section>

        <section className="security-panel" aria-labelledby="security-title">
          <div className="security-panel-heading">
            <div>
              <p className="eyebrow">SEGURIDAD</p>
              <h2 id="security-title">Tu acceso está protegido.</h2>
            </div>
            <span className="status-badge"><span className="session-dot" /> Sesión segura</span>
          </div>
          <p>
            Cada solicitud vuelve a validar tu sesión y tus permisos para las rutas de
            {isAdmin ? ' administración y recepción' : ' recepción'}. Al cerrar sesión, el backend
            invalida los tokens activos de esta cuenta.
          </p>
          <div className="security-panel-footer">
            <span>Autenticación</span>
            <span>JWT verificado · Rol {roleLabel.toLowerCase()}</span>
          </div>
        </section>
      </main>

      <footer className="page-footer">
        <span>ESTANCIA · GESTIÓN HOTELERA</span>
        <span>Sesión de {roleLabel.toLowerCase()} activa</span>
      </footer>
    </div>
  );
}

export default function App() {
  const [view, setView] = useState('loading');
  const [user, setUser] = useState(null);
  const [role, setRole] = useState('');
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [messageTone, setMessageTone] = useState('info');

  useEffect(() => {
    const savedToken = window.sessionStorage.getItem(SESSION_TOKEN_KEY);

    if (!savedToken) {
      setView('login');
      return undefined;
    }

    let isCurrent = true;

    getCurrentUser(savedToken)
      .then((response) => {
        const authenticatedUser = response.data?.user;
        if (!authenticatedUser?.role) {
          throw new Error('La API no devolvió el rol de la cuenta.');
        }
        return getRoleDashboard(savedToken, authenticatedUser.role);
      })
      .then((response) => {
        if (!isCurrent) return;
        setToken(savedToken);
        setUser(response.user);
        setRole(response.user.role);
        setView('dashboard');
      })
      .catch((error) => {
        if (!isCurrent) return;
        if (error.status === 401 || error.status === 403 || error.message === 'Esta cuenta no tiene un rol habilitado para el panel.') {
          window.sessionStorage.removeItem(SESSION_TOKEN_KEY);
        }
        setMessage(
          error.status === 403
            ? 'Esta cuenta no tiene permisos para ver este espacio.'
            : error.status === 401
              ? 'Tu sesión venció. Inicia sesión de nuevo.'
              : error.message === 'Esta cuenta no tiene un rol habilitado para el panel.'
                ? 'Esta cuenta no tiene un rol habilitado para entrar.'
                : 'No fue posible verificar tu sesión. Revisa la conexión e inténtalo de nuevo.',
        );
        setMessageTone(error.status === 403 || error.message === 'Esta cuenta no tiene un rol habilitado para el panel.' ? 'error' : error.status === 401 ? 'info' : 'warning');
        setView('login');
      });

    return () => {
      isCurrent = false;
    };
  }, []);

  async function handleLogin(credentials) {
    setBusy(true);
    setMessage('');
    setMessageTone('info');

    try {
      const response = await login(credentials);
      const nextToken = response.data?.token;
      const authenticatedUser = response.data?.user;

      if (!nextToken || !authenticatedUser?.role) {
        throw new Error('La API no devolvió los datos necesarios para iniciar sesión.');
      }

      const dashboard = await getRoleDashboard(nextToken, authenticatedUser.role);
      window.sessionStorage.setItem(SESSION_TOKEN_KEY, nextToken);
      setToken(nextToken);
      setUser(dashboard.user);
      setRole(dashboard.user.role);
      setView('dashboard');
    } catch (error) {
      const isNetworkError = error instanceof TypeError;
      setMessage(
        isNetworkError
          ? 'No fue posible conectar con el servidor. Inténtalo de nuevo.'
          : error.message === 'Esta cuenta no tiene un rol habilitado para el panel.'
            ? 'Esta cuenta no tiene un rol habilitado para entrar.'
            : error.message === 'No tienes permisos para esta acción'
              ? 'Las credenciales son válidas, pero esta cuenta no tiene permisos para ese espacio.'
            : error.message || 'No fue posible iniciar sesión.',
      );
      setMessageTone('error');
    } finally {
      setBusy(false);
    }
  }

  async function handleLogout() {
    setBusy(true);
    let logoutError = false;

    try {
      await logoutSession(token);
    } catch (error) {
      logoutError = error.status !== 401 && error.status !== 403;
    } finally {
      window.sessionStorage.removeItem(SESSION_TOKEN_KEY);
      setToken('');
      setUser(null);
      setRole('');
      setMessage(
        logoutError
          ? 'Se cerró la sesión en esta pestaña, pero no se pudo confirmar su revocación en el servidor.'
          : 'Sesión cerrada correctamente.',
      );
      setMessageTone(logoutError ? 'warning' : 'success');
      setView('login');
      setBusy(false);
    }
  }

  if (view === 'loading') {
    return (
      <main className="loading-screen" role="status" aria-live="polite">
        <span className="loading-mark" aria-hidden="true">E</span>
        <p>Verificando tu sesión…</p>
      </main>
    );
  }

  if (view === 'dashboard') {
    return <RoleDashboard user={user} role={role} onLogout={handleLogout} busy={busy} />;
  }

  return (
    <LoginScreen
      onLogin={handleLogin}
      busy={busy}
      message={message}
      messageTone={messageTone}
    />
  );
}
