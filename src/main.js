import './style.css'
import {
  DEPARTMENTS,
  PRIORITIES,
  ROLES,
  STATUSES,
  UNASSIGNED_TECHNICIAN,
} from './domain/constants.js'
import { createBackup, normalizeBackup } from './domain/backups.js'
import {
  createNotification,
  markAllNotificationsAsRead,
} from './domain/notifications.js'
import {
  calculateStats,
  createActivity,
  createReport,
  filterReports,
  formatTicket,
  getSlaDeadline,
  isSlaOverdue,
  sortReports,
} from './domain/reports.js'
import { getTechnicians as getDomainTechnicians } from './domain/settings.js'
import { escapeHtml } from './domain/text.js'
import { createLocalRepositories } from './persistence/local-storage.js'

const repositories = createLocalRepositories()

let reports = repositories.reports.list()
let settings = repositories.settings.get()
let notifications = repositories.notifications.list()
let searchQuery = ''
let statusFilter = 'Todos'
let priorityFilter = 'Todas'
let technicianFilter = 'Todos'
let dashboardTechnician = 'Todos'
let sortOrder = 'recent'
let activeModule = null
let editingReportId = null
let deletingReportId = null
let isReportFormOpen = false
let currentView = 'dashboard'
let openActivityReportId = null

function saveSettings() {
  settings = repositories.settings.update(settings)
}

function getTechnicians() {
  return getDomainTechnicians(settings)
}

function saveNotifications() {
  notifications = repositories.notifications.replaceAll(notifications)
}

function saveReports() {
  reports = repositories.reports.replaceAll(reports)
}

function getStats() {
  return calculateStats(reports)
}

function hasActiveFilters() {
  return (
    searchQuery.trim() !== '' ||
    statusFilter !== 'Todos' ||
    priorityFilter !== 'Todas' ||
    technicianFilter !== 'Todos'
  )
}

function getFilteredReports() {
  return filterReports(reports, {
    query: searchQuery,
    status: statusFilter,
    priority: priorityFilter,
    technician: technicianFilter,
  })
}

function getReportsCountLabel() {
  if (!hasActiveFilters()) return reports.length

  return `${getFilteredReports().length} de ${reports.length}`
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function priorityClass(priority) {
  return `badge-priority badge-priority--${priority.toLowerCase()}`
}

function statusClass(status) {
  if (status === STATUSES.RESOLVED) return 'badge-status badge-status--resolved'
  if (status === STATUSES.IN_PROGRESS) return 'badge-status badge-status--progress'
  return 'badge-status badge-status--pending'
}

function renderStats(stats = getStats()) {
  const { total, pending, inProgress, resolved } = stats
  const resolutionRate = total ? Math.round((resolved / total) * 100) : 0
  return `
    <div class="stats-grid">
      <button type="button" class="stat-card stat-card--total stat-filter-card" data-status="Todos" aria-label="Ver todas las incidencias">
        <div class="stat-card__top">
          <span class="stat-icon">${summaryIcon('total')}</span>
          <span class="stat-trend">Inventario</span>
        </div>
        <span class="stat-label">Total de incidencias</span>
        <div class="stat-card__value"><span class="stat-value" id="stat-total">${total}</span><small>registradas</small></div>
      </button>
      <button type="button" class="stat-card stat-card--pending stat-filter-card" data-status="${STATUSES.PENDING}" aria-label="Ver incidencias pendientes">
        <div class="stat-card__top">
          <span class="stat-icon">${summaryIcon('pending')}</span>
          <span class="stat-trend stat-trend--warning">Requieren atención</span>
        </div>
        <span class="stat-label">Incidencias pendientes</span>
        <div class="stat-card__value"><span class="stat-value" id="stat-pending">${pending}</span><small>por resolver</small></div>
      </button>
      <button type="button" class="stat-card stat-card--progress stat-filter-card" data-status="${STATUSES.IN_PROGRESS}" aria-label="Ver incidencias en progreso">
        <div class="stat-card__top">
          <span class="stat-icon">${summaryIcon('progress')}</span>
          <span class="stat-trend">En atención</span>
        </div>
        <span class="stat-label">En progreso</span>
        <div class="stat-card__value"><span class="stat-value" id="stat-progress">${inProgress}</span><small>en atención</small></div>
      </button>
      <button type="button" class="stat-card stat-card--resolved stat-filter-card" data-status="${STATUSES.RESOLVED}" aria-label="Ver incidencias resueltas">
        <div class="stat-card__top">
          <span class="stat-icon">${summaryIcon('resolved')}</span>
          <span class="stat-trend stat-trend--success">${resolutionRate}% completado</span>
        </div>
        <span class="stat-label">Incidencias resueltas</span>
        <div class="stat-card__value"><span class="stat-value" id="stat-resolved">${resolved}</span><small>finalizadas</small></div>
      </button>
    </div>
  `
}

function summaryIcon(type) {
  const paths = {
    total: '<path d="M5 4h14v16H5zM8 8h8M8 12h8M8 16h5"/>',
    pending: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    progress: '<path d="M4 12a8 8 0 0 1 13.7-5.7M20 12a8 8 0 0 1-13.7 5.7"/><path d="m17 3 .7 3.3L21 5.6M7 21l-.7-3.3L3 18.4"/>',
    resolved: '<circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/>',
  }
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths[type]}</svg>`
}

function renderHero() {
  const { total, pending, resolved } = getStats()
  const resolutionRate = total ? Math.round((resolved / total) * 100) : 0
  const today = new Intl.DateTimeFormat('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date())

  return `
    <section class="hero-summary" aria-labelledby="hero-title">
      <div class="hero-summary__content">
        <span class="hero-summary__eyebrow">
          <i></i> CENTRO DE OPERACIONES
        </span>
        <h2 id="hero-title">Resumen operativo</h2>
        <p>
          ${pending
            ? `Hay <strong>${pending} ${pending === 1 ? 'incidencia pendiente' : 'incidencias pendientes'}</strong> que requieren seguimiento.`
            : 'Todas las incidencias registradas han sido atendidas.'}
        </p>
        <div class="hero-summary__actions">
          <button type="button" id="hero-pending" class="btn btn--hero">
            Ver pendientes
          </button>
          <span>${today}</span>
        </div>
      </div>
      <div class="hero-summary__visual">
        <div class="resolution-ring" style="--progress: ${resolutionRate * 3.6}deg">
          <div><strong>${resolutionRate}%</strong><span>resolución</span></div>
        </div>
        <div class="hero-mini-metrics">
          <span><i class="dot dot--success"></i>${resolved} resueltas</span>
          <span><i class="dot dot--warning"></i>${pending} pendientes</span>
        </div>
      </div>
    </section>
  `
}

function renderReportCard(report) {
  const technicianOptions = getTechnicians().map(
    (technician) =>
      `<option value="${escapeHtml(technician)}"${report.technician === technician ? ' selected' : ''}>${escapeHtml(technician)}</option>`
  ).join('')
  const activity = [...report.activity]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map(
      (item) => `
        <li class="activity-item">
          <span>${escapeHtml(item.message)}</span>
          <time datetime="${item.createdAt}">${formatDate(item.createdAt)}</time>
        </li>
      `
    )
    .join('')
  const deadline = getSlaDeadline(report, settings.sla)
  const isOverdue = isSlaOverdue(report, settings.sla)

  return `
    <article class="report-card" data-id="${report.id}">
      <header class="report-card__header">
        <div class="report-card__meta">
          <span class="ticket-number">${formatTicket(report.ticketNumber)}</span>
          <span class="${priorityClass(report.priority)}">${report.priority}</span>
          <span class="${statusClass(report.status)}">${report.status}</span>
        </div>
        <time class="report-card__date" datetime="${report.createdAt}">
          ${formatDate(report.createdAt)}
        </time>
      </header>
      <h3 class="report-card__user">${escapeHtml(report.userName)}</h3>
      <a class="report-card__email" href="mailto:${escapeHtml(report.contactEmail)}">${escapeHtml(report.contactEmail)}</a>
      <a class="report-card__phone" href="tel:${escapeHtml(report.contactPhone.replace(/\s/g, ''))}">${escapeHtml(report.contactPhone)}</a>
      <span class="report-card__department">${escapeHtml(report.department)}</span>
      <p class="report-card__description">${escapeHtml(report.description)}</p>
      <div class="report-card__sla ${isOverdue ? 'report-card__sla--overdue' : ''}">
        <span>${isOverdue ? 'Plazo vencido' : 'Fecha límite'}</span>
        <time datetime="${deadline.toISOString()}">${formatDate(deadline.toISOString())}</time>
      </div>
      <div class="report-card__assignment">
        <label for="technician-${report.id}">Técnico responsable</label>
        <select
          id="technician-${report.id}"
          class="technician-select"
          data-id="${report.id}"
        >
          ${technicianOptions}
        </select>
        <label for="status-${report.id}">Estado del ticket</label>
        <select id="status-${report.id}" class="status-select" data-id="${report.id}">
          ${Object.values(STATUSES).map(
            (status) =>
              `<option value="${status}"${report.status === status ? ' selected' : ''}>${status}</option>`
          ).join('')}
        </select>
      </div>
      <details
        class="activity"
        data-id="${report.id}"
        ${openActivityReportId === report.id ? 'open' : ''}
      >
        <summary>Historial <span>${report.activity.length}</span></summary>
        <ul class="activity-list">
          ${activity || '<li class="activity-empty">Sin actividad registrada.</li>'}
        </ul>
        <div class="comment-box">
          <label class="sr-only" for="comment-${report.id}">Agregar comentario</label>
          <input
            id="comment-${report.id}"
            class="comment-input"
            data-id="${report.id}"
            type="text"
            maxlength="160"
            placeholder="Agregar comentario…"
          />
          <button
            type="button"
            class="btn btn--comment btn-comment"
            data-id="${report.id}"
          >
            Agregar
          </button>
        </div>
      </details>
      <footer class="report-card__actions">
        <button type="button" class="btn btn--secondary btn-edit" data-id="${report.id}">
          Editar
        </button>
        <button type="button" class="btn btn--danger btn-delete" data-id="${report.id}">
          Eliminar
        </button>
      </footer>
    </article>
  `
}

function renderReportsList() {
  if (reports.length === 0) {
    return `
      <div class="empty-state">
        <p>No hay reportes registrados.</p>
        <span>Usa el formulario para crear el primero.</span>
      </div>
    `
  }

  const filtered = getFilteredReports()

  if (filtered.length === 0) {
    return `
      <div class="empty-state">
        <p>Ningún reporte coincide con los filtros.</p>
        <span>Prueba con otros términos de búsqueda o criterios.</span>
      </div>
    `
  }

  const sorted = sortReports(filtered, sortOrder, settings.sla)
  return sorted.map(renderReportCard).join('')
}

function renderForm() {
  const options = PRIORITIES.map(
    (p) => `<option value="${p}">${p}</option>`
  ).join('')
  const departmentOptions = DEPARTMENTS.map(
    (department) => `<option value="${department}">${department}</option>`
  ).join('')

  return `
    <form id="report-form" class="report-form" novalidate>
      <div class="form-group">
        <label for="userName">Nombre del usuario</label>
        <input
          type="text"
          id="userName"
          name="userName"
          placeholder="Ej. María González"
          required
          autocomplete="name"
        />
      </div>
      <div class="form-group">
        <label for="contactEmail">Correo de contacto</label>
        <input
          type="email"
          id="contactEmail"
          name="contactEmail"
          placeholder="usuario@empresa.com"
          required
          autocomplete="email"
        />
      </div>
      <div class="form-group">
        <label for="contactPhone">Número de contacto</label>
        <input
          type="tel"
          id="contactPhone"
          name="contactPhone"
          placeholder="+52 55 0000 0000"
          required
          autocomplete="tel"
        />
      </div>
      <div class="form-group">
        <label for="department">Área o departamento</label>
        <select id="department" name="department" required>
          ${departmentOptions}
        </select>
      </div>
      <div class="form-group form-group--description">
        <label for="description">Descripción de la falla</label>
        <textarea
          id="description"
          name="description"
          rows="4"
          placeholder="Describe el problema técnico con el mayor detalle posible…"
          required
        ></textarea>
      </div>
      <div class="form-group">
        <label for="priority">Prioridad</label>
        <select id="priority" name="priority" required>
          ${options}
        </select>
      </div>
      <button type="submit" class="btn btn--primary btn--full">
        Registrar falla
      </button>
    </form>
  `
}

function renderRoadmap() {
  const capabilities = [
    ['access', 'Acceso y roles', 'Configura el usuario activo y su nivel de acceso.'],
    ['technicians', 'Asignación de técnicos', 'Administra el equipo responsable de las incidencias.'],
    ['history', 'Historial de actividad', 'Consulta toda la actividad registrada en los reportes.'],
    ['sla', 'Tiempos de respuesta', 'Define plazos de atención para cada prioridad.'],
    ['notifications', 'Notificaciones', 'Revisa avisos generados por cambios importantes.'],
    ['database', 'Respaldo de datos', 'Exporta o importa la información almacenada localmente.'],
    ['metrics', 'Métricas de desempeño', 'Analiza carga, prioridades y porcentaje de resolución.'],
  ]

  return `
    <section class="roadmap" aria-label="Módulos de SmartSupport">
      <header class="roadmap__header">
        <div>
          <span>HERRAMIENTAS</span>
          <h2>Centro de administración</h2>
        </div>
        <p>Configuración, seguimiento y análisis del servicio técnico.</p>
      </header>
      <div class="roadmap__grid">
        ${capabilities
          .map(
            ([id, title, description]) => `
              <article class="roadmap-card" data-module="${id}">
                <span class="roadmap-card__icon" aria-hidden="true">${moduleIcon(id)}</span>
                <div>
                  <h3>${title}</h3>
                  <p>${description}</p>
                  <button type="button" class="module-link" data-module="${id}">
                    Abrir módulo <span aria-hidden="true">→</span>
                  </button>
                </div>
              </article>
            `
          )
          .join('')}
      </div>
    </section>
  `
}

function moduleIcon(id) {
  const paths = {
    access: '<path d="M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm-7 18a7 7 0 0 1 14 0"/>',
    technicians: '<path d="M8 7a4 4 0 1 0 8 0 4 4 0 0 0-8 0ZM4 21a8 8 0 0 1 16 0"/>',
    history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
    sla: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M9 2h6"/>',
    notifications: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4"/>',
    database: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>',
    metrics: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  }
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths[id]}</svg>`
}

function getModuleContent(module) {
  const allActivity = reports
    .flatMap((report) =>
      report.activity.map((item) => ({ ...item, report: report.userName }))
    )
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

  const resolved = reports.filter((report) => report.status === STATUSES.RESOLVED).length
  const inProgress = reports.filter((report) => report.status === STATUSES.IN_PROGRESS).length
  const pending = reports.filter((report) => report.status === STATUSES.PENDING).length
  const resolutionRate = reports.length ? Math.round((resolved / reports.length) * 100) : 0
  const priorityCounts = PRIORITIES.map((priority) => [
    priority,
    reports.filter((report) => report.priority === priority).length,
  ])
  const pendingReports = reports
    .filter((report) => report.status === STATUSES.PENDING)
    .sort((a, b) => {
      const aDeadline = getSlaDeadline(a, settings.sla).getTime()
      const bDeadline = getSlaDeadline(b, settings.sla).getTime()
      return aDeadline - bDeadline
    })

  const modules = {
    pending: {
      title: `Incidencias pendientes (${pendingReports.length})`,
      body: pendingReports.length
        ? `
          <p class="module-description">Ordenadas por la fecha límite más próxima.</p>
          <div class="pending-list">
            ${pendingReports
              .map((report) => {
                const deadline = getSlaDeadline(report, settings.sla)
                const overdue = isSlaOverdue(report, settings.sla)
                return `
                  <article class="pending-item ${overdue ? 'pending-item--overdue' : ''}">
                    <div class="pending-item__top">
                      <span class="ticket-number">${formatTicket(report.ticketNumber)}</span>
                      <span class="${priorityClass(report.priority)}">${report.priority}</span>
                    </div>
                    <h3>${escapeHtml(report.userName)}</h3>
                    <p>${escapeHtml(report.description)}</p>
                    <div class="pending-item__meta">
                      <span>${report.technician === UNASSIGNED_TECHNICIAN ? 'Sin técnico asignado' : escapeHtml(report.technician)}</span>
                      <time datetime="${deadline.toISOString()}">
                        ${overdue ? 'Vencida: ' : 'Vence: '}${formatDate(deadline.toISOString())}
                      </time>
                    </div>
                  </article>
                `
              })
              .join('')}
          </div>
        `
        : '<div class="module-empty">No hay incidencias pendientes. Todo está al día.</div>',
    },
    access: {
      title: 'Acceso y roles',
      body: `
        <form id="profile-form" class="module-form">
          <label>Nombre del usuario
            <input id="profile-name" value="${escapeHtml(settings.profile.name)}" required />
          </label>
          <label>Rol
            <select id="profile-role">
              ${ROLES.map(
                (role) => `<option${settings.profile.role === role ? ' selected' : ''}>${role}</option>`
              ).join('')}
            </select>
          </label>
          <button class="btn btn--primary" type="submit">Guardar perfil</button>
        </form>
      `,
    },
    technicians: {
      title: 'Administración de técnicos',
      body: `
        <div class="module-list">
          ${settings.technicians.map((name) => `<div class="module-list__item"><span>${escapeHtml(name)}</span><span>Activo</span></div>`).join('')}
        </div>
        <form id="technician-form" class="module-inline-form">
          <label class="sr-only" for="new-technician">Nombre del técnico</label>
          <input id="new-technician" placeholder="Nombre del nuevo técnico" required />
          <button class="btn btn--primary" type="submit">Agregar</button>
        </form>
      `,
    },
    history: {
      title: 'Historial general',
      body: allActivity.length
        ? `<div class="module-timeline">${allActivity.slice(0, 30).map(
            (item) => `<article><strong>${escapeHtml(item.report)}</strong><p>${escapeHtml(item.message)}</p><time>${formatDate(item.createdAt)}</time></article>`
          ).join('')}</div>`
        : '<div class="module-empty">Todavía no hay actividad registrada.</div>',
    },
    sla: {
      title: 'Tiempos de respuesta',
      body: `
        <form id="sla-form" class="module-form">
          ${PRIORITIES.map(
            (priority) => `<label>Prioridad ${priority}
              <span class="input-suffix"><input type="number" min="1" max="720" id="sla-${priority}" value="${settings.sla[priority]}" required /><span>horas</span></span>
            </label>`
          ).join('')}
          <button class="btn btn--primary" type="submit">Guardar tiempos</button>
        </form>
      `,
    },
    notifications: {
      title: `Notificaciones (${notifications.filter((item) => !item.read).length} nuevas)`,
      body: `
        ${notifications.length
          ? `<div class="module-timeline">${notifications.slice(0, 30).map(
              (item) => `<article class="${item.read ? '' : 'is-unread'}"><p>${escapeHtml(item.message)}</p><time>${formatDate(item.createdAt)}</time></article>`
            ).join('')}</div><button id="mark-notifications" class="btn btn--secondary" type="button">Marcar todas como leídas</button>`
          : '<div class="module-empty">No hay notificaciones.</div>'}
      `,
    },
    database: {
      title: 'Respaldo local de datos',
      body: `
        <p class="module-description">Descarga todos los reportes y configuraciones en JSON o restaura un respaldo anterior.</p>
        <div class="database-actions">
          <button id="export-data" class="btn btn--primary" type="button">Exportar respaldo</button>
          <label class="btn btn--secondary import-label">Importar respaldo
            <input id="import-data" type="file" accept="application/json,.json" />
          </label>
        </div>
      `,
    },
    metrics: {
      title: 'Métricas de desempeño',
      body: `
        <div class="metrics-grid">
          <article><span>Total de reportes</span><strong>${reports.length}</strong></article>
          <article><span>Tasa de resolución</span><strong>${resolutionRate}%</strong></article>
          <article><span>Pendientes</span><strong>${pending}</strong></article>
          <article><span>En progreso</span><strong>${inProgress}</strong></article>
          <article><span>Resueltos</span><strong>${resolved}</strong></article>
        </div>
        <div class="priority-bars">
          ${priorityCounts.map(([priority, count]) => `<div><span>${priority}</span><div><i style="width:${reports.length ? (count / reports.length) * 100 : 0}%"></i></div><strong>${count}</strong></div>`).join('')}
        </div>
      `,
    },
  }

  return modules[module]
}

function renderModuleModal() {
  if (!activeModule) return ''
  const module = getModuleContent(activeModule)
  return `
    <div class="modal-backdrop" id="module-backdrop">
      <section class="module-modal" role="dialog" aria-modal="true" aria-labelledby="module-title">
        <header><h2 id="module-title">${module.title}</h2><button type="button" class="modal-close" aria-label="Cerrar">×</button></header>
        <div class="module-modal__body">${module.body}</div>
      </section>
    </div>
  `
}

function renderEditModal() {
  const report = reports.find((item) => item.id === editingReportId)
  if (!report) return ''

  return `
    <div class="modal-backdrop" id="edit-backdrop">
      <section class="module-modal" role="dialog" aria-modal="true" aria-labelledby="edit-title">
        <header>
          <div>
            <span class="modal-ticket">${formatTicket(report.ticketNumber)}</span>
            <h2 id="edit-title">Editar reporte</h2>
          </div>
          <button type="button" class="modal-close close-edit" aria-label="Cerrar">×</button>
        </header>
        <div class="module-modal__body">
          <form id="edit-report-form" class="module-form">
            <label>Nombre del usuario
              <input id="edit-user" value="${escapeHtml(report.userName)}" required />
            </label>
            <label>Correo de contacto
              <input id="edit-email" type="email" value="${escapeHtml(report.contactEmail)}" required />
            </label>
            <label>Número de contacto
              <input id="edit-phone" type="tel" value="${escapeHtml(report.contactPhone)}" required />
            </label>
            <label>Área o departamento
              <select id="edit-department">
                ${DEPARTMENTS.map(
                  (department) =>
                    `<option value="${department}"${report.department === department ? ' selected' : ''}>${department}</option>`
                ).join('')}
              </select>
            </label>
            <label>Descripción
              <textarea id="edit-description" rows="4" required>${escapeHtml(report.description)}</textarea>
            </label>
            <label>Prioridad
              <select id="edit-priority">
                ${PRIORITIES.map(
                  (priority) => `<option${report.priority === priority ? ' selected' : ''}>${priority}</option>`
                ).join('')}
              </select>
            </label>
            <button type="submit" class="btn btn--primary">Guardar cambios</button>
          </form>
        </div>
      </section>
    </div>
  `
}

function renderDeleteModal() {
  const report = reports.find((item) => item.id === deletingReportId)
  if (!report) return ''

  return `
    <div class="modal-backdrop" id="delete-backdrop">
      <section class="confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="delete-title">
        <span class="confirm-modal__icon" aria-hidden="true">!</span>
        <h2 id="delete-title">¿Eliminar ${formatTicket(report.ticketNumber)}?</h2>
        <p>Esta acción eliminará el reporte de ${escapeHtml(report.userName)} y todo su historial.</p>
        <div>
          <button type="button" class="btn btn--secondary cancel-delete">Cancelar</button>
          <button type="button" class="btn btn--danger confirm-delete">Eliminar reporte</button>
        </div>
      </section>
    </div>
  `
}

function renderInlineReportForm() {
  if (!isReportFormOpen) return ''

  return `
    <section class="inline-report-form" aria-labelledby="new-report-title">
      <div class="inline-report-form__heading">
        <div>
          <span>NUEVA INCIDENCIA</span>
          <h3 id="new-report-title">Registrar falla técnica</h3>
        </div>
        <button type="button" class="close-inline-form" aria-label="Cerrar formulario">×</button>
      </div>
      ${renderForm()}
    </section>
  `
}

function showToast(message, type = 'success') {
  document.querySelector('.toast')?.remove()
  const toast = document.createElement('div')
  toast.className = `toast toast--${type}`
  toast.textContent = message
  document.body.appendChild(toast)
  requestAnimationFrame(() => toast.classList.add('toast--visible'))
  setTimeout(() => toast.remove(), 2800)
}

function renderTicketsPanel() {
  return `
    <section class="panel panel--reports">
      <div class="panel__header">
        <div>
          <span class="page-kicker">GESTIÓN DE SOPORTE</span>
          <h2 class="panel__title">
            Tickets de soporte
            <span class="panel__count">${getReportsCountLabel()}</span>
          </h2>
        </div>
        <button type="button" id="new-incident" class="btn btn--primary">
          ${isReportFormOpen ? 'Cerrar formulario' : '+ Nueva incidencia'}
        </button>
      </div>
      ${renderInlineReportForm()}
      <div class="report-controls">
        <div class="search-box">
          <label class="sr-only" for="search-input">Buscar reportes</label>
          <input
            type="search"
            id="search-input"
            class="search-input"
            placeholder="Buscar por folio, usuario, correo, teléfono, área o descripción…"
            value="${escapeHtml(searchQuery)}"
          />
        </div>
        <div class="filters">
          <div class="filter-group">
            <label for="status-filter">Estado</label>
            <select id="status-filter" class="filter-select">
              <option value="Todos"${statusFilter === 'Todos' ? ' selected' : ''}>Todos</option>
              <option value="${STATUSES.PENDING}"${statusFilter === STATUSES.PENDING ? ' selected' : ''}>Pendientes</option>
              <option value="${STATUSES.IN_PROGRESS}"${statusFilter === STATUSES.IN_PROGRESS ? ' selected' : ''}>En progreso</option>
              <option value="${STATUSES.RESOLVED}"${statusFilter === STATUSES.RESOLVED ? ' selected' : ''}>Resueltos</option>
            </select>
          </div>
          <div class="filter-group">
            <label for="priority-filter">Prioridad</label>
            <select id="priority-filter" class="filter-select">
              <option value="Todas"${priorityFilter === 'Todas' ? ' selected' : ''}>Todas</option>
              ${PRIORITIES.map(
                (priority) =>
                  `<option value="${priority}"${priorityFilter === priority ? ' selected' : ''}>${priority}</option>`
              ).join('')}
            </select>
          </div>
          <div class="filter-group">
            <label for="technician-filter">Técnico</label>
            <select id="technician-filter" class="filter-select">
              <option value="Todos"${technicianFilter === 'Todos' ? ' selected' : ''}>Todos</option>
              ${[...new Set([...getTechnicians(), settings.profile.name])].map(
                (technician) =>
                  `<option value="${escapeHtml(technician)}"${technicianFilter === technician ? ' selected' : ''}>${escapeHtml(technician)}</option>`
              ).join('')}
            </select>
          </div>
          <div class="filter-group">
            <label for="sort-order">Ordenar</label>
            <select id="sort-order" class="filter-select">
              <option value="recent"${sortOrder === 'recent' ? ' selected' : ''}>Más recientes</option>
              <option value="oldest"${sortOrder === 'oldest' ? ' selected' : ''}>Más antiguos</option>
              <option value="priority"${sortOrder === 'priority' ? ' selected' : ''}>Prioridad</option>
              <option value="deadline"${sortOrder === 'deadline' ? ' selected' : ''}>Vencimiento</option>
            </select>
          </div>
        </div>
      </div>
      <div id="reports-list" class="reports-grid" aria-live="polite">
        ${renderReportsList()}
      </div>
    </section>
  `
}

function renderDashboardHome() {
  const dashboardReports =
    dashboardTechnician === 'Todos'
      ? reports
      : reports.filter((report) => report.technician === dashboardTechnician)
  const dashboardStats = calculateStats(dashboardReports)
  const { total, pending, inProgress, resolved } = dashboardStats
  const resolutionRate = total ? Math.round((resolved / total) * 100) : 0
  const resolvedAngle = total ? (resolved / total) * 360 : 0
  const progressAngle = total ? ((resolved + inProgress) / total) * 360 : 0
  const priorityCounts = PRIORITIES.map((priority) => ({
    priority,
    count: dashboardReports.filter((report) => report.priority === priority).length,
  }))
  const recentActivity = dashboardReports
    .flatMap((report) =>
      report.activity.map((item) => ({ ...item, report }))
    )
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 5)

  return `
    <div class="page-heading">
      <div>
        <span class="page-kicker">CENTRO DE OPERACIONES</span>
        <h2>Dashboard</h2>
        <p>Resumen general de la operación de soporte técnico.</p>
      </div>
      <div class="dashboard-heading-actions">
        <label for="dashboard-technician">Ver actividad de</label>
        <select id="dashboard-technician" class="filter-select">
          <option value="Todos"${dashboardTechnician === 'Todos' ? ' selected' : ''}>Todos los técnicos</option>
          ${getTechnicians()
            .filter((technician) => technician !== UNASSIGNED_TECHNICIAN)
            .map(
              (technician) =>
                `<option value="${escapeHtml(technician)}"${dashboardTechnician === technician ? ' selected' : ''}>${escapeHtml(technician)}</option>`
            )
            .join('')}
        </select>
      </div>
    </div>
    ${renderStats(dashboardStats)}
    <div class="dashboard-widgets">
      <section class="widget widget--status">
        <header><h3>Tickets por estado</h3><span>${total} registros</span></header>
        <div class="status-chart">
          <div class="status-donut" style="--resolved:${resolvedAngle}deg;--progress:${progressAngle}deg"></div>
          <div class="chart-legend">
            <span><i class="dot dot--warning"></i>Pendientes <strong>${pending}</strong></span>
            <span><i class="dot dot--progress"></i>En progreso <strong>${inProgress}</strong></span>
            <span><i class="dot dot--success"></i>Resueltos <strong>${resolved}</strong></span>
          </div>
        </div>
      </section>
      <section class="widget">
        <header><h3>Tickets por prioridad</h3><span>Distribución actual</span></header>
        <div class="dashboard-bars">
          ${priorityCounts.map(({ priority, count }) => `
            <div>
              <span>${priority}</span>
              <div><i class="bar--${priority.toLowerCase()}" style="width:${total ? (count / total) * 100 : 0}%"></i></div>
              <strong>${count}</strong>
            </div>
          `).join('')}
        </div>
      </section>
      <section class="widget widget--activity">
        <header><h3>Actividad reciente</h3><button type="button" data-view="history" class="text-action">Ver todo</button></header>
        <div class="recent-activity">
          ${recentActivity.length
            ? recentActivity.map((item) => `
                <article>
                  <span class="activity-avatar">${escapeHtml(item.report.userName).charAt(0).toUpperCase()}</span>
                  <div><strong>${escapeHtml(item.report.userName)}</strong><p>${escapeHtml(item.message)} · ${formatTicket(item.report.ticketNumber)}</p></div>
                  <time>${formatDate(item.createdAt)}</time>
                </article>
              `).join('')
            : '<div class="module-empty">No hay actividad reciente.</div>'}
        </div>
      </section>
      <section class="widget widget--quick">
        <header><h3>Acciones rápidas</h3></header>
        <button type="button" data-view="new">${moduleIcon('history')}<span><strong>Crear ticket</strong><small>Registrar una nueva solicitud</small></span></button>
        <button type="button" data-view="technicians">${moduleIcon('technicians')}<span><strong>Gestionar técnicos</strong><small>Administrar responsables</small></span></button>
        <button type="button" data-view="metrics">${moduleIcon('metrics')}<span><strong>Ver reportes</strong><small>Analizar el desempeño</small></span></button>
      </section>
    </div>
  `
}

function renderSimpleView(view) {
  const viewData = {
    technicians: ['Administración de técnicos', 'Gestiona el equipo responsable de las incidencias.', 'technicians'],
    history: ['Historial de actividad', 'Consulta los cambios realizados en todos los tickets.', 'history'],
    metrics: ['Reportes y métricas', 'Analiza el desempeño general del servicio técnico.', 'metrics'],
  }
  const [title, description, module] = viewData[view]
  return `
    <div class="page-heading"><div><span class="page-kicker">ADMINISTRACIÓN</span><h2>${title}</h2><p>${description}</p></div></div>
    <section class="workspace-card">${getModuleContent(module).body}</section>
  `
}

function renderSettingsView() {
  const settingsCards = [
    ['access', 'Acceso y roles', 'Configura el perfil local y el nivel de acceso.'],
    ['sla', 'Tiempos de respuesta', 'Define objetivos de atención por prioridad.'],
    ['database', 'Respaldo de datos', 'Exporta o restaura la información local.'],
    ['notifications', 'Notificaciones', 'Revisa y administra los avisos del sistema.'],
  ]
  return `
    <div class="page-heading"><div><span class="page-kicker">SISTEMA</span><h2>Configuración</h2><p>Personaliza el funcionamiento de SmartSupport.</p></div></div>
    <div class="settings-grid">
      ${settingsCards.map(([id, title, description]) => `
        <article>
          <span>${moduleIcon(id)}</span>
          <div><h3>${title}</h3><p>${description}</p><button type="button" class="module-link" data-module="${id}">Abrir configuración →</button></div>
        </article>
      `).join('')}
    </div>
  `
}

function renderWorkspaceView() {
  if (currentView === 'tickets') {
    return `<div class="page-heading"><div><span class="page-kicker">WORKSPACE</span><h2>Tickets de soporte</h2><p>Consulta, asigna y actualiza las solicitudes registradas.</p></div></div>${renderTicketsPanel()}`
  }
  if (currentView === 'new') {
    return `
      <div class="page-heading"><div><span class="page-kicker">WORKSPACE</span><h2>Nuevo ticket</h2><p>Registra una nueva incidencia técnica.</p></div></div>
      <section class="workspace-card new-ticket-page">${renderForm()}</section>
    `
  }
  if (['technicians', 'history', 'metrics'].includes(currentView)) return renderSimpleView(currentView)
  if (currentView === 'settings') return renderSettingsView()
  return renderDashboardHome()
}

function renderApp() {
  const app = document.querySelector('#app')
  app.innerHTML = `
    <div class="app-shell">
      <aside class="app-sidebar">
        <div class="sidebar-brand">
          <div class="brand__icon" aria-hidden="true">⚡</div>
          <div><h1>SmartSupport</h1><p>IT Management Portal</p></div>
        </div>
        <nav class="sidebar-nav" aria-label="Navegación principal">
          <span>WORKSPACE</span>
          <button type="button" data-view="dashboard" class="${currentView === 'dashboard' ? 'is-active' : ''}">${moduleIcon('metrics')}<b>Dashboard</b></button>
          <button type="button" data-view="tickets" class="${currentView === 'tickets' ? 'is-active' : ''}">${moduleIcon('database')}<b>Tickets de soporte</b></button>
          <button type="button" data-view="new" class="${currentView === 'new' ? 'is-active' : ''}">${moduleIcon('history')}<b>Nuevo ticket</b></button>
          <span>ADMINISTRAR</span>
          <button type="button" data-view="technicians" class="${currentView === 'technicians' ? 'is-active' : ''}">${moduleIcon('technicians')}<b>Técnicos</b></button>
          <button type="button" data-view="history" class="${currentView === 'history' ? 'is-active' : ''}">${moduleIcon('history')}<b>Actividad</b></button>
          <button type="button" data-view="metrics" class="${currentView === 'metrics' ? 'is-active' : ''}">${moduleIcon('metrics')}<b>Reportes</b></button>
          <button type="button" data-view="settings" class="${currentView === 'settings' ? 'is-active' : ''}">${moduleIcon('sla')}<b>Configuración</b></button>
        </nav>
        <div class="sidebar-footer"><span><i></i>Todos los sistemas operativos</span><small>Datos almacenados localmente</small></div>
      </aside>
      <section class="app-workspace">
        <header class="app-topbar">
          <form id="global-search-form" class="global-search">
            ${moduleIcon('history')}
            <input
              id="global-search-input"
              type="search"
              value=""
              placeholder="Buscar tickets, usuarios, contactos, áreas o folios…"
              aria-label="Búsqueda global"
            />
            <button type="submit">Buscar</button>
          </form>
          <div class="topbar-actions">
            <button type="button" id="header-notifications" class="header-icon-button" aria-label="Abrir notificaciones">🔔<span>${notifications.filter((item) => !item.read).length}</span></button>
            <div class="topbar-user">
              <span>A</span>
              <div class="topbar-user__details">
                <strong>Admin IT</strong>
              </div>
            </div>
          </div>
        </header>
        <main class="workspace-content">${renderWorkspaceView()}</main>
      </section>
      ${renderModuleModal()}
      ${renderEditModal()}
      ${renderDeleteModal()}
    </div>
  `

  bindEvents()
}

function updateUI() {
  const { total, pending, inProgress, resolved } = getStats()
  const totalElement = document.querySelector('#stat-total')
  const pendingElement = document.querySelector('#stat-pending')
  const progressElement = document.querySelector('#stat-progress')
  const resolvedElement = document.querySelector('#stat-resolved')
  const countElement = document.querySelector('.panel__count')
  const reportsList = document.querySelector('#reports-list')

  if (totalElement) totalElement.textContent = total
  if (pendingElement) pendingElement.textContent = pending
  if (progressElement) progressElement.textContent = inProgress
  if (resolvedElement) resolvedElement.textContent = resolved
  if (countElement) countElement.textContent = getReportsCountLabel()
  if (reportsList) reportsList.innerHTML = renderReportsList()
  bindReportActions()
}

function bindEvents() {
  const form = document.querySelector('#report-form')
  form?.addEventListener('submit', handleSubmit)

  const runGlobalSearch = () => {
    const globalSearchInput = document.querySelector('#global-search-input')
    const query = globalSearchInput.value.trim()
    if (!query) {
      globalSearchInput.focus()
      return
    }

    searchQuery = query
    statusFilter = 'Todos'
    priorityFilter = 'Todas'
    technicianFilter = 'Todos'
    currentView = 'tickets'
    isReportFormOpen = false
    renderApp()
  }

  document.querySelector('#global-search-form')?.addEventListener('submit', (event) => {
    event.preventDefault()
    runGlobalSearch()
  })
  document.querySelector('#global-search-input')?.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return
    event.preventDefault()
    runGlobalSearch()
  })

  const searchInput = document.querySelector('#search-input')
  if (searchInput) {
    searchInput.addEventListener('input', handleSearch)
  }

  document.querySelector('#status-filter')?.addEventListener('change', handleStatusFilter)
  document.querySelector('#priority-filter')?.addEventListener('change', handlePriorityFilter)
  document.querySelector('#technician-filter')?.addEventListener('change', (event) => {
    technicianFilter = event.target.value
    updateReportsList()
  })
  document.querySelector('#sort-order')?.addEventListener('change', (event) => {
    sortOrder = event.target.value
    updateReportsList()
  })
  document.querySelector('#header-notifications').addEventListener('click', () => {
    openModule('notifications')
  })
  document.querySelector('#dashboard-technician')?.addEventListener('change', (event) => {
    dashboardTechnician = event.target.value
    renderApp()
  })
  document.querySelectorAll('.stat-filter-card').forEach((card) => {
    card.addEventListener('click', () => {
      searchQuery = ''
      statusFilter = card.dataset.status
      priorityFilter = 'Todas'
      technicianFilter = dashboardTechnician
      currentView = 'tickets'
      isReportFormOpen = false
      renderApp()
    })
  })
  document.querySelector('#new-incident')?.addEventListener('click', () => {
    isReportFormOpen = !isReportFormOpen
    renderApp()
    if (isReportFormOpen) document.querySelector('#userName')?.focus()
  })
  document.querySelectorAll('[data-view]').forEach((button) => {
    button.addEventListener('click', () => {
      currentView = button.dataset.view
      if (currentView === 'tickets') technicianFilter = 'Todos'
      isReportFormOpen = false
      renderApp()
    })
  })
  document.querySelectorAll('.module-link').forEach((button) => {
    button.addEventListener('click', () => openModule(button.dataset.module))
  })
  document.querySelector('.modal-close')?.addEventListener('click', closeModule)
  document.querySelector('#module-backdrop')?.addEventListener('click', (event) => {
    if (event.target.id === 'module-backdrop') closeModule()
  })
  document.querySelector('.close-edit')?.addEventListener('click', closeEdit)
  document.querySelector('#edit-backdrop')?.addEventListener('click', (event) => {
    if (event.target.id === 'edit-backdrop') closeEdit()
  })
  document.querySelector('#edit-report-form')?.addEventListener('submit', saveEditedReport)
  document.querySelector('.cancel-delete')?.addEventListener('click', closeDelete)
  document.querySelector('.confirm-delete')?.addEventListener('click', confirmDelete)
  document.querySelector('.close-inline-form')?.addEventListener('click', closeReportForm)
  bindModuleEvents()

  bindReportActions()
}

function closeReportForm() {
  isReportFormOpen = false
  renderApp()
}

function openModule(module) {
  activeModule = module
  renderApp()
}

function closeModule() {
  activeModule = null
  renderApp()
}

function openEdit(id) {
  editingReportId = id
  renderApp()
}

function closeEdit() {
  editingReportId = null
  renderApp()
}

function saveEditedReport(event) {
  event.preventDefault()
  const report = reports.find((item) => item.id === editingReportId)
  if (!report) return

  report.userName = document.querySelector('#edit-user').value.trim()
  report.contactEmail = document.querySelector('#edit-email').value.trim()
  report.contactPhone = document.querySelector('#edit-phone').value.trim()
  report.department = document.querySelector('#edit-department').value
  report.description = document.querySelector('#edit-description').value.trim()
  report.priority = document.querySelector('#edit-priority').value
  addActivity(report, 'Información del reporte actualizada')
  saveReports()
  editingReportId = null
  renderApp()
  showToast(`${formatTicket(report.ticketNumber)} actualizado correctamente`)
}

function openDelete(id) {
  deletingReportId = id
  renderApp()
}

function closeDelete() {
  deletingReportId = null
  renderApp()
}

function confirmDelete() {
  const report = reports.find((item) => item.id === deletingReportId)
  if (!report) return
  reports = reports.filter((item) => item.id !== deletingReportId)
  saveReports()
  deletingReportId = null
  renderApp()
  showToast(`${formatTicket(report.ticketNumber)} eliminado`, 'danger')
}

function refreshModule() {
  renderApp()
}

function bindModuleEvents() {
  document.querySelector('#profile-form')?.addEventListener('submit', (event) => {
    event.preventDefault()
    settings.profile = {
      name: document.querySelector('#profile-name').value.trim(),
      role: document.querySelector('#profile-role').value,
    }
    saveSettings()
    addNotification(`Perfil actualizado: ${settings.profile.name} (${settings.profile.role})`)
    refreshModule()
  })

  document.querySelector('#technician-form')?.addEventListener('submit', (event) => {
    event.preventDefault()
    const input = document.querySelector('#new-technician')
    const name = input.value.trim()
    if (!name || settings.technicians.includes(name)) return
    settings.technicians.push(name)
    saveSettings()
    addNotification(`Técnico agregado: ${name}`)
    refreshModule()
  })

  document.querySelector('#sla-form')?.addEventListener('submit', (event) => {
    event.preventDefault()
    PRIORITIES.forEach((priority) => {
      settings.sla[priority] = Number(document.querySelector(`#sla-${priority}`).value)
    })
    saveSettings()
    addNotification('Tiempos de respuesta actualizados')
    refreshModule()
  })

  document.querySelector('#mark-notifications')?.addEventListener('click', () => {
    notifications = markAllNotificationsAsRead(notifications)
    saveNotifications()
    refreshModule()
  })

  document.querySelector('#export-data')?.addEventListener('click', exportData)
  document.querySelector('#import-data')?.addEventListener('change', importData)
}

function handleSearch(e) {
  searchQuery = e.target.value
  updateReportsList()
}

function handleStatusFilter(e) {
  statusFilter = e.target.value
  updateReportsList()
}

function handlePriorityFilter(e) {
  priorityFilter = e.target.value
  updateReportsList()
}

function updateReportsList() {
  document.querySelector('.panel__count').textContent = getReportsCountLabel()
  document.querySelector('#reports-list').innerHTML = renderReportsList()
  bindReportActions()
}

function bindReportActions() {
  document.querySelectorAll('.btn-edit').forEach((btn) => {
    btn.addEventListener('click', () => openEdit(btn.dataset.id))
  })
  document.querySelectorAll('.btn-delete').forEach((btn) => {
    btn.addEventListener('click', () => openDelete(btn.dataset.id))
  })
  document.querySelectorAll('.technician-select').forEach((select) => {
    select.addEventListener('change', handleTechnicianChange)
  })
  document.querySelectorAll('.status-select').forEach((select) => {
    select.addEventListener('change', handleStatusChange)
  })
  document.querySelectorAll('.btn-comment').forEach((btn) => {
    btn.addEventListener('click', handleAddComment)
  })
  document.querySelectorAll('.comment-input').forEach((input) => {
    input.addEventListener('keydown', handleCommentKeydown)
  })
  document.querySelectorAll('.activity').forEach((details) => {
    details.addEventListener('toggle', () => {
      if (details.open) {
        openActivityReportId = details.dataset.id
      } else if (openActivityReportId === details.dataset.id) {
        openActivityReportId = null
      }
    })
  })
}

function handleSubmit(e) {
  e.preventDefault()
  const form = e.target
  const userName = form.userName.value.trim()
  const contactEmail = form.contactEmail.value.trim()
  const contactPhone = form.contactPhone.value.trim()
  const department = form.department.value
  const description = form.description.value.trim()
  const priority = form.priority.value

  if (!contactEmail || !form.contactEmail.validity.valid) {
    form.contactEmail.focus()
    showToast('Ingresa un correo de contacto válido', 'error')
    return
  }
  if (!contactPhone) {
    form.contactPhone.focus()
    showToast('Ingresa un número de contacto', 'error')
    return
  }
  if (!userName || !description) return

  reports.unshift(createReport({
    userName,
    contactEmail,
    contactPhone,
    department,
    description,
    priority,
  }, reports))
  addNotification(`Nuevo reporte registrado por ${userName}`)
  saveReports()
  isReportFormOpen = false
  currentView = 'tickets'
  renderApp()
  showToast('Reporte registrado correctamente')
}

function handleStatusChange(e) {
  const report = reports.find((item) => item.id === e.currentTarget.dataset.id)
  if (!report) return

  report.status = e.currentTarget.value

  addActivity(report, `Estado cambiado a ${report.status.toLowerCase()}`)
  addNotification(`${report.userName}: estado cambiado a ${report.status.toLowerCase()}`)
  saveReports()
  renderApp()
  showToast(`${formatTicket(report.ticketNumber)} cambió a ${report.status.toLowerCase()}`)
}

function handleTechnicianChange(e) {
  const report = reports.find((item) => item.id === e.currentTarget.dataset.id)
  if (!report) return

  report.technician = e.currentTarget.value
  const message =
    report.technician === UNASSIGNED_TECHNICIAN
      ? 'Asignación de técnico eliminada'
      : `Reporte asignado a ${report.technician}`
  addActivity(report, message)
  addNotification(`${report.userName}: ${message}`)
  saveReports()
  updateUI()
  showToast(message)
}

function handleAddComment(e) {
  const id = e.currentTarget.dataset.id
  const input = document.querySelector(`.comment-input[data-id="${id}"]`)
  const report = reports.find((item) => item.id === id)
  const comment = input?.value.trim()
  if (!report || !comment) return

  addActivity(report, `Comentario: ${comment}`)
  addNotification(`${report.userName}: nuevo comentario agregado`)
  openActivityReportId = id
  saveReports()
  updateUI()
  showToast('Comentario agregado al historial')
}

function handleCommentKeydown(e) {
  if (e.key !== 'Enter') return
  e.preventDefault()
  const button = document.querySelector(
    `.btn-comment[data-id="${e.currentTarget.dataset.id}"]`
  )
  button?.click()
}

function addActivity(report, message) {
  report.activity.unshift(createActivity(message))
}

function addNotification(message) {
  notifications.unshift(createNotification(message))
  saveNotifications()
}

function exportData() {
  const payload = JSON.stringify(createBackup(reports, settings, notifications), null, 2)
  const url = URL.createObjectURL(new Blob([payload], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `smartsupport-respaldo-${new Date().toISOString().slice(0, 10)}.json`
  link.click()
  URL.revokeObjectURL(url)
}

function importData(event) {
  const file = event.target.files[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    try {
      const data = normalizeBackup(JSON.parse(reader.result))
      reports = data.reports
      settings = data.settings
      notifications = data.notifications
      saveReports()
      saveSettings()
      saveNotifications()
      activeModule = null
      renderApp()
    } catch {
      window.alert('No se pudo importar el respaldo. Verifica el archivo.')
    }
  }
  reader.readAsText(file)
}

renderApp()
