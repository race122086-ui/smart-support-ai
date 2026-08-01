import { useState } from 'react'
import { useSession } from '../../app/session.jsx'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { api } from '../../api/client.js'
import { queryKeys, useApiMutation, useApiQuery } from '../../api/queries.js'
import { ErrorState, LoadingState, useToast } from '../ui/Feedback.jsx'
import { PwaInstall } from '../ui/PwaInstall.jsx'
import { formatDate } from '../../utils/format.js'

const navigation = [
  ['/', 'Dashboard', ['ADMIN', 'TECHNICIAN', 'USER']],
  ['/tickets', 'Tickets de soporte', ['ADMIN', 'TECHNICIAN', 'USER']],
  ['/tickets/new', 'Nuevo ticket', ['ADMIN', 'USER']],
  ['/technicians', 'Técnicos', ['ADMIN', 'TECHNICIAN']],
  ['/activity', 'Actividad', ['ADMIN', 'TECHNICIAN']],
  ['/reports', 'Reportes', ['ADMIN']],
  ['/users', 'Usuarios', ['ADMIN']],
  ['/settings', 'Configuración', ['ADMIN']],
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
  const session = useSession()
  const visibleNavigation = navigation.filter(([, , roles]) => roles.includes(session.user.role))
  const [query, setQuery] = useState('')
  const [showNotifications, setShowNotifications] = useState(false)
  const notifications = useApiQuery(queryKeys.notifications, api.listNotifications, { enabled: session.user.role === 'ADMIN' })
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
          {visibleNavigation.slice(0, 3).map(([to, label]) => (
            <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => isActive ? 'is-active' : ''}>
              <i aria-hidden="true">●</i><b>{label}</b>
            </NavLink>
          ))}
          <span>ADMINISTRAR</span>
          {visibleNavigation.slice(3).map(([to, label]) => (
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
            {session.user.role === 'ADMIN' && <button type="button" className="header-icon-button" aria-label={`Abrir notificaciones, ${unread} sin leer`} onClick={() => setShowNotifications(true)}>
              🔔<span>{unread}</span>
            </button>}
            <div className="topbar-user">
              <span>{session.user.name[0]?.toUpperCase() || 'U'}</span>
              <div className="topbar-user__details"><strong>{session.user.name}</strong><small>{session.user.role}</small></div><button type="button" className="btn btn--secondary" onClick={() => session.logout()}>Salir</button>
            </div>
          </div>
        </header>
        <main className="workspace-content"><Outlet /></main>
      </section>
      {showNotifications && session.user.role === 'ADMIN' && <NotificationsDialog onClose={() => setShowNotifications(false)} />}
    </div>
  )
}
