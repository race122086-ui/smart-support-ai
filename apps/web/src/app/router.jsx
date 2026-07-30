import { createBrowserRouter, Link } from 'react-router-dom'
import { AppShell } from '../components/layout/AppShell.jsx'
import { ActivityPage } from '../features/activity/ActivityPage.jsx'
import { DashboardPage } from '../features/dashboard/DashboardPage.jsx'
import { MetricsPage } from '../features/metrics/MetricsPage.jsx'
import { TicketDetailPage } from '../features/reports/pages/TicketDetailPage.jsx'
import { EditTicketPage, NewTicketPage } from '../features/reports/pages/TicketFormPages.jsx'
import { TicketsPage } from '../features/reports/pages/TicketsPage.jsx'
import { SettingsPage } from '../features/settings/SettingsPage.jsx'
import { TechniciansPage } from '../features/technicians/TechniciansPage.jsx'

function NotFoundPage() {
  return <section className="connection-state"><h2>Página no encontrada</h2><p>La ruta solicitada no existe.</p><Link className="btn btn--primary" to="/">Volver al dashboard</Link></section>
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'tickets', element: <TicketsPage /> },
      { path: 'tickets/new', element: <NewTicketPage /> },
      { path: 'tickets/:id', element: <TicketDetailPage /> },
      { path: 'tickets/:id/edit', element: <EditTicketPage /> },
      { path: 'technicians', element: <TechniciansPage /> },
      { path: 'activity', element: <ActivityPage /> },
      { path: 'reports', element: <MetricsPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
