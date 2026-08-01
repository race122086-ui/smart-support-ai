import { STATUSES, UNASSIGNED_TECHNICIAN, sortReportActivity } from '@smartsupport/contracts'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../../../api/client.js'
import { useSession } from '../../../app/session.jsx'
import { invalidateReportData, queryKeys, useApiQuery, useReport } from '../../../api/queries.js'
import { ConfirmDialog, ErrorState, LoadingState, useToast } from '../../../components/ui/Feedback.jsx'
import { formatDate, formatTicket, priorityClass, statusClass } from '../../../utils/format.js'
import { AttachmentsSection } from '../components/AttachmentsSection.jsx'

export function TicketDetailPage() {
  const { id } = useParams()
  const { user } = useSession()
  const navigate = useNavigate()
  const client = useQueryClient()
  const notify = useToast()
  const [comment, setComment] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const report = useReport(id)
  const technicians = useApiQuery(queryKeys.technicians, api.listTechnicians, { enabled: user.role === 'ADMIN' })
  const activity = useApiQuery(queryKeys.activity(id), () => api.getActivity(id))
  const sla = useApiQuery(queryKeys.sla(id), () => api.getSla(id))

  useEffect(() => {
    if (!report.isError || report.error?.status !== 404) return
    notify('Este ticket fue eliminado', 'error')
    navigate('/tickets', { replace: true })
  }, [navigate, notify, report.error, report.isError])

  useEffect(() => {
    function ticketDeleted(event) {
      if (event.detail?.reportId !== id) return
      notify('Este ticket fue eliminado', 'error')
      navigate('/tickets', { replace: true })
    }
    window.addEventListener('smartsupport:ticket-deleted', ticketDeleted)
    return () => window.removeEventListener('smartsupport:ticket-deleted', ticketDeleted)
  }, [id, navigate, notify])

  const mutation = useMutation({
    mutationFn: ({ action, value }) => {
      if (action === 'status') return api.changeStatus(id, value)
      if (action === 'technician') return api.assignTechnician(id, value)
      if (action === 'comment') return api.addComment(id, value)
      return api.deleteReport(id)
    },
    onSuccess: async (_, variables) => {
      await invalidateReportData(client, id)
      if (variables.action === 'delete') {
        notify('Ticket eliminado')
        navigate('/tickets')
      } else {
        notify(variables.action === 'comment' ? 'Comentario agregado al historial' : 'Ticket actualizado')
        if (variables.action === 'comment') setComment('')
      }
    },
  })

  if (report.isLoading) return <LoadingState message="Cargando detalle…" />
  if (report.isError) return <ErrorState error={report.error} onRetry={report.refetch} />
  const item = report.data
  const activities = activity.data || item.activity || []

  return (
    <>
      <div className="page-heading">
        <div><span className="page-kicker">DETALLE</span><h2>{formatTicket(item.ticketNumber)} · {item.userName}</h2><p>Creado el {formatDate(item.createdAt)}</p></div>
        <div className="report-card__actions"><Link className="btn btn--secondary" to="/tickets">Volver</Link>{['ADMIN', 'USER'].includes(user.role) && <Link className="btn btn--primary" to={`/tickets/${id}/edit`}>Editar</Link>}{user.role === 'ADMIN' && <button className="btn btn--danger" type="button" onClick={() => setConfirmDelete(true)}>Eliminar</button>}</div>
      </div>
      {mutation.isError && <ErrorState error={mutation.error} />}
      <article className="workspace-card ticket-detail">
        <div className="report-card__meta"><span className={priorityClass(item.priority)}>{item.priority}</span><span className={statusClass(item.status)}>{item.status}</span><span>{item.department}</span></div>
        <p className="ticket-detail__description">{item.description}</p>
        <dl className="ticket-detail__contact"><div><dt>Correo</dt><dd><a href={`mailto:${item.contactEmail}`}>{item.contactEmail}</a></dd></div><div><dt>Teléfono</dt><dd>{item.contactPhone}</dd></div><div><dt>SLA</dt><dd className={sla.data?.overdue ? 'danger-text' : ''}>{sla.data ? `${sla.data.overdue ? 'Vencido' : 'Vence'}: ${formatDate(sla.data.deadline)}` : 'Calculando…'}</dd></div></dl>
        {user.role === 'ADMIN' && <div className="report-card__assignment">
          <label htmlFor="detail-technician">Técnico responsable</label>
          <select id="detail-technician" className="technician-select" value={item.technician} disabled={mutation.isPending} onChange={(event) => mutation.mutate({ action: 'technician', value: event.target.value })}>
            <option>{UNASSIGNED_TECHNICIAN}</option>{technicians.data?.map((technician) => <option key={technician.id}>{technician.name}</option>)}
          </select>
          <label htmlFor="detail-status">Estado del ticket</label>
          <select id="detail-status" className="status-select" value={item.status} disabled={mutation.isPending} onChange={(event) => mutation.mutate({ action: 'status', value: event.target.value })}>{STATUSES.map((status) => <option key={status}>{status}</option>)}</select>
        </div>}
        {user.role === 'TECHNICIAN' && <div className="report-card__assignment">
          <strong>Técnico responsable: {item.technician}</strong>
          {item.technician === UNASSIGNED_TECHNICIAN && <button className="btn btn--primary" type="button" disabled={mutation.isPending} onClick={() => mutation.mutate({ action: 'technician', value: user.name })}>Tomar ticket</button>}
          <label htmlFor="detail-status">Estado del ticket</label>
          <select id="detail-status" className="status-select" value={item.status} disabled={mutation.isPending || item.technician === UNASSIGNED_TECHNICIAN} onChange={(event) => mutation.mutate({ action: 'status', value: event.target.value })}>{STATUSES.map((status) => <option key={status}>{status}</option>)}</select>
        </div>}
        <section className="activity" aria-labelledby="activity-title">
          <h3 id="activity-title">Historial de actividad</h3>
          <ul className="activity-list">{sortReportActivity(activities).map((entry) => <li className="activity-item" key={entry.id}><span>{entry.message}</span><time dateTime={entry.createdAt}>{formatDate(entry.createdAt)}</time></li>)}</ul>
          <form className="comment-box" onSubmit={(event) => { event.preventDefault(); if (comment.trim()) mutation.mutate({ action: 'comment', value: comment.trim() }) }}>
            <label className="sr-only" htmlFor="comment">Agregar comentario</label><input id="comment" className="comment-input" value={comment} maxLength="160" onChange={(event) => setComment(event.target.value)} placeholder="Agregar comentario…" /><button className="btn btn--comment" type="submit" disabled={!comment.trim() || mutation.isPending}>Agregar</button>
          </form>
        </section>
        <AttachmentsSection reportId={item.id} report={item} user={user} />
      </article>
      {confirmDelete && <ConfirmDialog title={`Eliminar ${formatTicket(item.ticketNumber)}`} onClose={() => setConfirmDelete(false)} onConfirm={() => mutation.mutate({ action: 'delete' })}>Esta acción eliminará la incidencia y su historial. No se puede deshacer.</ConfirmDialog>}
    </>
  )
}
