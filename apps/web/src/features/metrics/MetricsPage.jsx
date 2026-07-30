import { PRIORITIES } from '@smartsupport/contracts'
import { api } from '../../api/client.js'
import { queryKeys, useApiQuery } from '../../api/queries.js'
import { ErrorState, LoadingState } from '../../components/ui/Feedback.jsx'

export function MetricsPage() {
  const metrics = useApiQuery(queryKeys.metrics, api.getMetrics)
  if (metrics.isLoading) return <LoadingState message="Calculando métricas…" />
  if (metrics.isError) return <ErrorState error={metrics.error} onRetry={metrics.refetch} />
  const data = metrics.data
  const max = Math.max(1, ...Object.values(data.priorities))
  return (
    <>
      <div className="page-heading"><div><span className="page-kicker">ANÁLISIS</span><h2>Métricas de desempeño</h2><p>Distribución y avance de las incidencias.</p></div></div>
      <div className="metrics-grid">
        <section className="workspace-card"><h3>Resolución global</h3><div className="resolution-ring" style={{ '--progress': `${data.resolutionRate * 3.6}deg` }}><div><strong>{data.resolutionRate}%</strong><span>resuelto</span></div></div><p>{data.resolved} de {data.total} tickets finalizados.</p></section>
        <section className="workspace-card"><h3>Por prioridad</h3><div className="priority-bars">{PRIORITIES.map((priority) => <div key={priority}><span>{priority}</span><div><i style={{ width: `${data.priorities[priority] / max * 100}%` }}></i></div><strong>{data.priorities[priority]}</strong></div>)}</div></section>
        <section className="workspace-card"><h3>Por estado</h3><ul className="chart-legend"><li><i className="dot dot--warning"></i>Pendientes <strong>{data.pending}</strong></li><li><i className="dot dot--progress"></i>En progreso <strong>{data.inProgress}</strong></li><li><i className="dot dot--success"></i>Resueltas <strong>{data.resolved}</strong></li></ul></section>
      </div>
    </>
  )
}
