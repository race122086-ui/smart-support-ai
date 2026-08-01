import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../../../api/client.js'
import { useSession } from '../../../app/session.jsx'
import { invalidateReportData, useReport } from '../../../api/queries.js'
import { ErrorState, LoadingState, useToast } from '../../../components/ui/Feedback.jsx'
import { formatTicket } from '../../../utils/format.js'
import { AttachmentsSection } from '../components/AttachmentsSection.jsx'
import { TicketForm } from '../components/TicketForm.jsx'

export function NewTicketPage() {
  const navigate = useNavigate()
  const notify = useToast()
  const client = useQueryClient()
  const create = useMutation({
    mutationFn: async (input) => {
      const report = await api.createReport(input)
      for (const file of input.files || []) {
        try {
          await api.uploadAttachment(report.id, file)
        } catch (error) {
          notify(`No se pudieron adjuntar todos los archivos: ${error.message}`, 'error')
          break
        }
      }
      return report
    },
    onSuccess: async (report) => {
      await invalidateReportData(client, report.id)
      notify(`${formatTicket(report.ticketNumber)} registrado correctamente`)
      navigate(`/tickets/${report.id}`)
    },
  })

  return (
    <>
      <div className="page-heading"><div><span className="page-kicker">WORKSPACE</span><h2>Nuevo ticket</h2><p>Registra una nueva incidencia técnica.</p></div></div>
      <section className="workspace-card new-ticket-page">
        {create.isError && <ErrorState error={create.error} />}
        <TicketForm attachments pending={create.isPending} onSubmit={(input) => create.mutate(input)} />
      </section>
    </>
  )
}

export function EditTicketPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const notify = useToast()
  const client = useQueryClient()
  const { user } = useSession()
  const report = useReport(id)
  const update = useMutation({
    mutationFn: (input) => api.updateReport(id, input),
    onSuccess: async (updated) => {
      await invalidateReportData(client, id)
      notify(`${formatTicket(updated.ticketNumber)} actualizado correctamente`)
      navigate(`/tickets/${id}`)
    },
  })

  if (report.isLoading) return <LoadingState message="Cargando ticket…" />
  if (report.isError) return <ErrorState error={report.error} onRetry={report.refetch} />
  return (
    <>
      <div className="page-heading"><div><span className="page-kicker">EDICIÓN</span><h2>Editar {formatTicket(report.data.ticketNumber)}</h2><p>Actualiza los datos de la incidencia.</p></div><Link className="btn btn--secondary" to={`/tickets/${id}`}>Cancelar</Link></div>
      <section className="workspace-card new-ticket-page">
        {update.isError && <ErrorState error={update.error} />}
        <TicketForm initialValue={report.data} submitLabel="Guardar cambios" pending={update.isPending} onSubmit={(input) => update.mutate(input)} />
      </section>
      <AttachmentsSection reportId={id} report={report.data} user={user} />
    </>
  )
}
