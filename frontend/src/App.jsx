import { useEffect, useState } from 'react';
import ArrivalsReportPage from './pages/ArrivalsReportPage.jsx';
import AvailabilityPage from './pages/AvailabilityPage.jsx';
import CheckInPage from './pages/CheckInPage.jsx';
import CheckOutPage from './pages/CheckOutPage.jsx';
import ConsumptionPage from './pages/ConsumptionPage.jsx';
import CurrentOccupancyPage from './pages/CurrentOccupancyPage.jsx';
import DailyReportPage from './pages/DailyReportPage.jsx';
import DeparturesReportPage from './pages/DeparturesReportPage.jsx';
import ReceptionistsPage from './pages/ReceptionistsPage.jsx';
import ProfilePage from './pages/ProfilePage.jsx';
import OccupancyReportPage from './pages/OccupancyReportPage.jsx';
import OpenAccountsPage from './pages/OpenAccountsPage.jsx';
import IncomeReportPage from './pages/IncomeReportPage.jsx';
import ProductCatalogPage from './pages/ProductCatalogPage.jsx';
import SalesReportPage from './pages/SalesReportPage.jsx';
import ReservationsPage from './pages/ReservationsPage.jsx';
import RoomsPage from './pages/RoomsPage.jsx';
import SettlementHistoryPage from './pages/SettlementHistoryPage.jsx';
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

const ADMIN_NAV_GROUPS = [
  { title: 'Inicio', icon: 'home', items: [{ id: 'admin-home', label: 'Panel principal' }] },
  { title: 'Usuarios', icon: 'users', items: [
    { id: 'users-list', label: 'Listado de usuarios' },
    { id: 'users-create', label: 'Crear recepcionista' },
    { id: 'users-admin-create', label: 'Crear administrador' },
  ] },
  { title: 'Habitaciones', icon: 'rooms', items: [
    { id: 'rooms-list', label: 'Listado de habitaciones' },
    { id: 'rooms-create', label: 'Registrar habitación' },
    { id: 'rooms-availability', label: 'Disponibilidad' },
  ] },
  { title: 'Reservaciones', icon: 'reservations', items: [
    { id: 'reservations-list', label: 'Todas las reservaciones' },
    { id: 'reservations-cancellations', label: 'Cancelaciones administrativas' },
  ] },
  { title: 'Consumos', icon: 'consumptions', items: [
    { id: 'consumptions-catalog', label: 'Catálogo de productos' },
    { id: 'consumptions-create', label: 'Registrar producto' },
    { id: 'consumptions-history', label: 'Historial de consumos' },
  ] },
  { title: 'Liquidaciones', icon: 'payments', items: [
    { id: 'settlements-history', label: 'Historial de liquidaciones' },
    { id: 'settlements-payments', label: 'Pagos realizados' },
  ] },
  { title: 'Reportes', icon: 'reports', items: [
    { id: 'reports-occupancy', label: 'Reporte de ocupación' },
    { id: 'reports-income', label: 'Reporte de ingresos' },
    { id: 'reports-sales', label: 'Ventas de productos' },
  ] },
];

const RECEPTION_NAV_GROUPS = [
  { title: 'Inicio', icon: 'home', items: [{ id: 'reception-home', label: 'Panel de recepción' }] },
  { title: 'Habitaciones', icon: 'rooms', items: [
    { id: 'reception-rooms-list', label: 'Listado de habitaciones' },
    { id: 'reception-rooms-availability', label: 'Consultar disponibilidad' },
  ] },
  { title: 'Reservaciones', icon: 'reservations', items: [
    { id: 'reception-reservations-list', label: 'Consultar reservaciones' },
    { id: 'reception-reservations-create', label: 'Nueva reservación' },
    { id: 'reception-reservations-cancellations', label: 'Cancelar reservaciones' },
    { id: 'reception-check-in', label: 'Registrar check-in' },
  ] },
  { title: 'Consumos', icon: 'consumptions', items: [
    { id: 'reception-consumptions-catalog', label: 'Catálogo de productos' },
    { id: 'reception-consumptions-create', label: 'Registrar consumo' },
    { id: 'reception-consumptions-room', label: 'Consumos por habitación' },
  ] },
  { title: 'Liquidaciones', icon: 'payments', items: [
    { id: 'reception-settlements-open', label: 'Cuentas abiertas' },
    { id: 'reception-check-out', label: 'Registrar pago y check-out' },
    { id: 'reception-receipts', label: 'Comprobantes de pago' },
  ] },
  { title: 'Reportes', icon: 'reports', items: [
    { id: 'reception-reports-daily', label: 'Reporte diario' },
    { id: 'reception-reports-arrivals', label: 'Llegadas programadas' },
    { id: 'reception-reports-departures', label: 'Salidas previstas' },
    { id: 'reception-reports-occupancy', label: 'Ocupación actual' },
  ] },
];

function SidebarIcon({ name }) {
  const iconPaths = {
    home: <><path d="m3 10 9-7 9 7" /><path d="M5 9v11h14V9M9 20v-6h6v6" /></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="10" cy="7" r="4" /><path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
    rooms: <><path d="M3 20V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v15" /><path d="M3 14h18M6 14v-3h5v3M3 20h18" /></>,
    reservations: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18M8 14h3" /></>,
    consumptions: <><path d="M4 7h16l-1 14H5L4 7Z" /><path d="M9 7a3 3 0 0 1 6 0M8 11h8" /></>,
    payments: <><rect x="3" y="5" width="18" height="15" rx="2" /><path d="M3 10h18M7 15h4" /></>,
    reports: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>,
    account: <><circle cx="12" cy="8" r="4" /><path d="M5 21a7 7 0 0 1 14 0" /></>,
    logout: <><path d="M10 17l5-5-5-5M15 12H3" /><path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6" /></>,
  };

  return (
    <svg className="sidebar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {iconPaths[name]}
    </svg>
  );
}

function RoleSidebar({ groups, roleLabel, activeItem, accountActive, onSelect, onLogout, onCloseMobile, busy }) {
  return (
    <>
      <button className="sidebar-backdrop" type="button" onClick={onCloseMobile} aria-label="Cerrar menú" />
      <aside className="dashboard-sidebar" aria-label="Menú principal">
        <div className="sidebar-brand-row">
          <Brand />
          <span className="sidebar-brand-caption">GESTIÓN HOTELERA</span>
        </div>

        <div className="sidebar-role">
          <span className="sidebar-role-dot" aria-hidden="true" />
          <span>ROL: {roleLabel}</span>
        </div>

        <nav className="sidebar-nav" aria-label={`Opciones para ${roleLabel.toLowerCase()}`}>
          {groups.map((group) => (
            <section className="sidebar-group" key={group.title} aria-label={group.title}>
              <div className="sidebar-group-title">
                <SidebarIcon name={group.icon} />
                <span>{group.title}</span>
              </div>
              <div className="sidebar-group-items">
                {group.items.map((item) => (
                  <button
                    className={`sidebar-link${activeItem === item.id ? ' sidebar-link-active' : ''}`}
                    type="button"
                    key={item.id}
                    onClick={() => onSelect(item.id)}
                    aria-current={activeItem === item.id ? 'page' : undefined}
                  >
                    <span>{item.label}</span>
                    {activeItem === item.id && <span className="sidebar-link-indicator" aria-hidden="true" />}
                  </button>
                ))}
              </div>
            </section>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button
            className={`sidebar-utility${accountActive ? ' sidebar-link-active' : ''}`}
            type="button"
            onClick={() => onSelect('account')}
            aria-current={accountActive ? 'page' : undefined}
          >
            <SidebarIcon name="account" />
            <span>Mi perfil</span>
          </button>
          <button className="sidebar-utility sidebar-logout" type="button" onClick={onLogout} disabled={busy}>
            <SidebarIcon name="logout" />
            <span>{busy ? 'Cerrando sesión…' : 'Cerrar sesión'}</span>
          </button>
        </div>
      </aside>
    </>
  );
}

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

function RoleDashboard({ user, role, token, onLogout, onProfileUpdated, busy }) {
  const isAdmin = role === ROLE_ADMIN;
  const firstName = user?.name?.trim().split(/\s+/)[0] || 'equipo';
  const roleLabel = isAdmin ? 'ADMINISTRADOR' : 'RECEPCIONISTA';
  const sidebarRoleLabel = isAdmin ? 'ADMIN' : 'RECEPCIONISTA';
  const groups = isAdmin ? ADMIN_NAV_GROUPS : RECEPTION_NAV_GROUPS;
  const homeItem = groups[0].items[0];
  const [activeItem, setActiveItem] = useState(homeItem.id);
  const [accountActive, setAccountActive] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedCheckoutReservationId, setSelectedCheckoutReservationId] = useState('');
  const selectedItem = groups.flatMap((group) => group.items).find((item) => item.id === activeItem);

  function selectItem(itemId, options = {}) {
    setAccountActive(itemId === 'account');
    setActiveItem(itemId === 'account' ? '' : itemId);
    setSelectedCheckoutReservationId(itemId === 'reception-check-out' ? options.reservationId || '' : '');
    setMobileMenuOpen(false);
  }

  const isHome = !accountActive && activeItem === homeItem.id;

  return (
    <div className={`dashboard-layout${mobileMenuOpen ? ' sidebar-open' : ''}`}>
      <RoleSidebar
        groups={groups}
        roleLabel={sidebarRoleLabel}
        activeItem={activeItem}
        accountActive={accountActive}
        onSelect={selectItem}
        onLogout={onLogout}
        onCloseMobile={() => setMobileMenuOpen(false)}
        busy={busy}
      />

      <div className="dashboard-workspace">
        <header className="dashboard-topbar">
          <button
            className="menu-toggle"
            type="button"
            onClick={() => setMobileMenuOpen((open) => !open)}
            aria-label={mobileMenuOpen ? 'Cerrar menú' : 'Abrir menú'}
            aria-expanded={mobileMenuOpen}
          >
            <span aria-hidden="true">{mobileMenuOpen ? '×' : '☰'}</span>
          </button>
          <div className="dashboard-topbar-title">
            <span className="topbar-label">{isAdmin ? 'Panel administrativo' : 'Espacio de recepción'}</span>
            <span className="dashboard-topbar-divider" aria-hidden="true" />
            <span className="dashboard-topbar-section">{accountActive ? 'Mi perfil' : selectedItem?.label}</span>
          </div>
          <div className="dashboard-user-chip">
            <span className="dashboard-user-avatar" aria-hidden="true">{firstName.slice(0, 1).toUpperCase()}</span>
            <span>{firstName}</span>
          </div>
        </header>

        <main className="dashboard-main">
          {isHome ? (
            <>
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
            </>
          ) : accountActive ? (
            <ProfilePage
              user={user}
              token={token}
              roleLabel={roleLabel}
              onProfileUpdated={onProfileUpdated}
            />
          ) : isAdmin && ['users-list', 'users-create', 'users-admin-create'].includes(activeItem) ? (
            <ReceptionistsPage
              token={token}
              mode={activeItem === 'users-create' ? 'create' : activeItem === 'users-admin-create' ? 'create-admin' : 'list'}
              onNavigate={selectItem}
            />
          ) : isAdmin && ['rooms-list', 'rooms-create'].includes(activeItem) ? (
            <RoomsPage
              token={token}
              mode={activeItem === 'rooms-create' ? 'create' : 'list'}
              canCreate
              canManage
              createItemId="rooms-create"
              listItemId="rooms-list"
              onNavigate={selectItem}
            />
          ) : !isAdmin && activeItem === 'reception-rooms-list' ? (
            <RoomsPage
              token={token}
              mode="list"
              canCreate={false}
              canManage={false}
              listItemId="reception-rooms-list"
              onNavigate={selectItem}
            />
          ) : isAdmin && activeItem === 'rooms-availability' ? (
            <AvailabilityPage token={token} />
          ) : !isAdmin && activeItem === 'reception-rooms-availability' ? (
            <AvailabilityPage token={token} canReserve onNavigate={selectItem} />
          ) : (isAdmin && activeItem === 'reservations-list') || (!isAdmin && ['reception-reservations-list', 'reception-reservations-create'].includes(activeItem)) ? (
            <ReservationsPage
              token={token}
              mode={activeItem === 'reception-reservations-create' ? 'create' : 'list'}
              canCreate={!isAdmin}
              onNavigate={selectItem}
            />
          ) : isAdmin && activeItem === 'reservations-cancellations' ? (
            <ReservationsPage token={token} mode="cancellations" />
          ) : !isAdmin && activeItem === 'reception-reservations-cancellations' ? (
            <ReservationsPage token={token} mode="cancellations" />
          ) : isAdmin && activeItem === 'consumptions-catalog' ? (
            <ProductCatalogPage token={token} showInactive />
          ) : !isAdmin && activeItem === 'reception-consumptions-catalog' ? (
            <ProductCatalogPage token={token} />
          ) : isAdmin && activeItem === 'settlements-history' ? (
            <SettlementHistoryPage token={token} />
          ) : !isAdmin && activeItem === 'reception-settlements-open' ? (
            <OpenAccountsPage token={token} onNavigate={selectItem} />
          ) : isAdmin && activeItem === 'reports-occupancy' ? (
            <OccupancyReportPage token={token} />
          ) : isAdmin && activeItem === 'reports-income' ? (
            <IncomeReportPage token={token} />
          ) : !isAdmin && activeItem === 'reception-reports-daily' ? (
            <DailyReportPage token={token} onNavigate={selectItem} />
          ) : !isAdmin && activeItem === 'reception-reports-arrivals' ? (
            <ArrivalsReportPage token={token} onNavigate={selectItem} />
          ) : !isAdmin && activeItem === 'reception-reports-departures' ? (
            <DeparturesReportPage token={token} onNavigate={selectItem} />
          ) : !isAdmin && activeItem === 'reception-reports-occupancy' ? (
            <CurrentOccupancyPage token={token} />
          ) : isAdmin && activeItem === 'reports-sales' ? (
            <SalesReportPage token={token} />
          ) : !isAdmin && activeItem === 'reception-check-in' ? (
            <CheckInPage token={token} />
          ) : !isAdmin && activeItem === 'reception-check-out' ? (
            <CheckOutPage token={token} initialReservationId={selectedCheckoutReservationId} />
          ) : !isAdmin && activeItem === 'reception-consumptions-create' ? (
            <ConsumptionPage token={token} />
          ) : (
            <section className="module-placeholder" aria-labelledby="module-title">
              <span className="module-placeholder-mark" aria-hidden="true"><SidebarIcon name="home" /></span>
              <p className="eyebrow">{isAdmin ? 'ESPACIO DE ADMINISTRACIÓN' : 'ESPACIO DE RECEPCIÓN'}</p>
              <h1 id="module-title">{selectedItem?.label}</h1>
              <p>La navegación está lista. Aquí aparecerá esta sección.</p>
            </section>
          )}
        </main>

        <footer className="dashboard-footer">
          <span>ESTANCIA · GESTIÓN HOTELERA</span>
          <span>Sesión de {roleLabel.toLowerCase()} activa</span>
        </footer>
      </div>
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

  function handleProfileUpdated(profile) {
    if (profile?.token) {
      window.sessionStorage.setItem(SESSION_TOKEN_KEY, profile.token);
      setToken(profile.token);
    }
    if (profile?.user) {
      setUser(profile.user);
    }
  }

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
    return (
      <RoleDashboard
        user={user}
        role={role}
        token={token}
        onLogout={handleLogout}
        onProfileUpdated={handleProfileUpdated}
        busy={busy}
      />
    );
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
