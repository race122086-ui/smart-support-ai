import { Link } from 'react-router-dom'
import { formatDate, formatTicket, priorityClass, statusClass } from '../../../utils/format.js'

export function TicketCard({ report }) {
  return (
    <article className="report-card">
      <header className="report-card__header">
        <div className="report-card__meta">
          <span className="ticket-number">{formatTicket(report.ticketNumber)}</span>
          <span className={priorityClass(report.priority)}>{report.priority}</span>
          <span className={statusClass(report.status)}>{report.status}</span>
        </div>
        <time className="report-card__date" dateTime={report.createdAt}>{formatDate(report.createdAt)}</time>
      </header>
      <h3 className="report-card__user">{report.userName}</h3>
      <a className="report-card__email" href={`mailto:${report.contactEmail}`}>{report.contactEmail}</a>
      <a className="report-card__phone" href={`tel:${report.contactPhone.replace(/\s/g, '')}`}>{report.contactPhone}</a>
      <span className="report-card__department">{report.department}</span>
      <p className="report-card__description">{report.description}</p>
      <div className="report-card__assignment"><span>Técnico responsable</span><strong>{report.technician}</strong></div>
      <footer className="report-card__actions"><Link className="btn btn--secondary" to={`/tickets/${report.id}`}>Ver detalle</Link><Link className="btn btn--primary" to={`/tickets/${report.id}/edit`}>Editar</Link></footer>
    </article>
  )
}
