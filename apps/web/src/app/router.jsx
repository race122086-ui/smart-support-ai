import { createBrowserRouter, Link, Navigate, useLocation } from 'react-router-dom'
import { useSession } from './session.jsx'
import { ADMIN_ONLY_ROLES } from './authorization.js'
import { AppShell } from '../components/layout/AppShell.jsx'
import { LoadingState } from '../components/ui/Feedback.jsx'
import { ActivityPage } from '../features/activity/ActivityPage.jsx'
import { LoginPage } from '../features/auth/LoginPage.jsx'
import { DashboardPage } from '../features/dashboard/DashboardPage.jsx'
import { MetricsPage } from '../features/metrics/MetricsPage.jsx'
import { TicketDetailPage } from '../features/reports/pages/TicketDetailPage.jsx'
import { EditTicketPage, NewTicketPage } from '../features/reports/pages/TicketFormPages.jsx'
import { TicketsPage } from '../features/reports/pages/TicketsPage.jsx'
import { SettingsPage } from '../features/settings/SettingsPage.jsx'
import { TechniciansPage } from '../features/technicians/TechniciansPage.jsx'
import { UsersPage } from '../features/users/UsersPage.jsx'

function ProtectedApp() {
  const session = useSession()
  const location = useLocation()
  if (session.loading) return <main className="connection-state"><LoadingState message="Comprobando sesión…" /></main>
  if (!session.user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return <AppShell />
}

function RolePage({ roles, children }) {
  const { user } = useSession()
  return roles.includes(user?.role) ? children : <Navigate to="/" replace />
}

function NotFoundPage() {
  return <section className="connection-state"><h2>Página no encontrada</h2><p>La ruta solicitada no existe.</p><Link className="btn btn--primary" to="/">Volver al dashboard</Link></section>
}

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: <ProtectedApp />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'tickets', element: <TicketsPage /> },
      { path: 'tickets/new', element: <RolePage roles={['ADMIN', 'USER']}><NewTicketPage /></RolePage> },
      { path: 'tickets/:id', element: <TicketDetailPage /> },
      { path: 'tickets/:id/edit', element: <RolePage roles={['ADMIN', 'USER']}><EditTicketPage /></RolePage> },
      { path: 'technicians', element: <RolePage roles={ADMIN_ONLY_ROLES}><TechniciansPage /></RolePage> },
      { path: 'activity', element: <RolePage roles={['ADMIN', 'TECHNICIAN']}><ActivityPage /></RolePage> },
      { path: 'reports', element: <RolePage roles={ADMIN_ONLY_ROLES}><MetricsPage /></RolePage> },
      { path: 'users', element: <RolePage roles={ADMIN_ONLY_ROLES}><UsersPage /></RolePage> },
      { path: 'settings', element: <RolePage roles={ADMIN_ONLY_ROLES}><SettingsPage /></RolePage> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
