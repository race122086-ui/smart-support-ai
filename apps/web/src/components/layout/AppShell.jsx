import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { api } from '../../api/client.js'
import { queryKeys, useApiMutation, useApiQuery } from '../../api/queries.js'
import { ErrorState, LoadingState, useToast } from '../ui/Feedback.jsx'
import { PwaInstall } from '../ui/PwaInstall.jsx'
import { formatDate } from '../../utils/format.js'

const navigation = [
  ['/', 'Dashboard'],
  ['/tickets', 'Tickets de soporte'],
  ['/tickets/new', 'Nuevo ticket'],
  ['/technicians', 'Técnicos'],
  ['/activity', 'Actividad'],
  ['/reports', 'Reportes'],
  ['/settings', 'Configuración'],
]

function NotificationsDialog({ onClose }) {
  const notify = useToast()
  const notifications = useApiQuery(queryKeys.notifications, api.listNotifications)
  const markRead = useApiMutation(api.markNotificationsRead, [queryKeys.notifications])

  async function handleMarkRead() {
    try {
      await markRead.mutateAsync()
      notify('Notificaciones marcadas como leídas')
    } catch (error) {
      notify(error.message, 'error')
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose()
    }}>
      <section className="module-modal" role="dialog" aria-modal="true" aria-labelledby="notifications-title">
        <button type="button" className="modal-close" aria-label="Cerrar notificaciones" onClick={onClose}>×</button>
        <h2 id="notifications-title">Notificaciones</h2>
        <div className="module-modal__body">
          {notifications.isLoading && <LoadingState message="Cargando notificaciones…" />}
          {notifications.isError && <ErrorState error={notifications.error} onRetry={notifications.refetch} />}
          {notifications.data?.length === 0 && <p className="module-empty">No hay notificaciones.</p>}
          <ul className="module-list">
            {notifications.data?.map((item) => (
              <li className="module-list__item" key={item.id}>
                <span>{item.read ? '✓' : '●'} {item.message}</span>
                <time dateTime={item.createdAt}>{formatDate(item.createdAt)}</time>
              </li>
            ))}
          </ul>
          {!!notifications.data?.some((item) => !item.read) && (
            <button type="button" className="btn btn--primary" disabled={markRead.isPending} onClick={handleMarkRead}>
              Marcar todas como leídas
            </button>
          )}
        </div>
      </section>
    </div>
  )
}

export function AppShell() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [showNotifications, setShowNotifications] = useState(false)
  const notifications = useApiQuery(queryKeys.notifications, api.listNotifications)
  const settings = useApiQuery(queryKeys.settings, api.getSettings)
  const unread = notifications.data?.filter((item) => !item.read).length || 0

  function search(event) {
    event.preventDefault()
    if (!query.trim()) return
    navigate(`/tickets?q=${encodeURIComponent(query.trim())}`)
  }

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <NavLink to="/" className="sidebar-brand">
          <div className="brand__icon" aria-hidden="true">⚡</div>
          <div><h1>SmartSupport</h1><p>IT Management Portal</p></div>
        </NavLink>
        <nav className="sidebar-nav" aria-label="Navegación principal">
          <span>WORKSPACE</span>
          {navigation.slice(0, 3).map(([to, label]) => (
            <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => isActive ? 'is-active' : ''}>
              <i aria-hidden="true">●</i><b>{label}</b>
            </NavLink>
          ))}
          <span>ADMINISTRAR</span>
          {navigation.slice(3).map(([to, label]) => (
            <NavLink key={to} to={to} className={({ isActive }) => isActive ? 'is-active' : ''}>
              <i aria-hidden="true">●</i><b>{label}</b>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer"><span><i></i>Todos los sistemas operativos</span><small>Datos persistidos en PostgreSQL</small></div>
      </aside>
      <section className="app-workspace">
        <header className="app-topbar">
          <form className="global-search" role="search" onSubmit={search}>
            <span aria-hidden="true">⌕</span>
            <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar tickets, usuarios, contactos, áreas o folios…" aria-label="Búsqueda global" />
            <button type="submit">Buscar</button>
          </form>
          <div className="topbar-actions">
            <PwaInstall />
            <button type="button" className="header-icon-button" aria-label={`Abrir notificaciones, ${unread} sin leer`} onClick={() => setShowNotifications(true)}>
              🔔<span>{unread}</span>
            </button>
            <div className="topbar-user">
              <span>{settings.data?.profile?.name?.[0]?.toUpperCase() || 'A'}</span>
              <div className="topbar-user__details"><strong>{settings.data?.profile?.name || 'Administrador'}</strong></div>
            </div>
          </div>
        </header>
        <main className="workspace-content"><Outlet /></main>
      </section>
      {showNotifications && <NotificationsDialog onClose={() => setShowNotifications(false)} />}
    </div>
  )
}
