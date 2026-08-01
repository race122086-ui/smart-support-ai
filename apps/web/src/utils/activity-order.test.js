import { describe, expect, it } from 'vitest'
import { sortReportActivity } from '@smartsupport/contracts'

describe('orden del historial de actividad', () => {
  it('muestra el ciclo de vida en secuencia y deja el cierre al final', () => {
    const activity = [
      { id: 'closed', message: 'Reporte cerrado', createdAt: '2026-08-01T10:02:00.000Z' },
      { id: 'comment', message: 'Comentario: Problema resuelto', createdAt: '2026-08-01T10:03:00.000Z' },
      { id: 'resolved', message: 'Estado cambiado a Resuelto', createdAt: '2026-08-01T10:02:00.000Z' },
      { id: 'progress', message: 'Estado cambiado a En progreso', createdAt: '2026-08-01T10:01:00.000Z' },
      { id: 'pending', message: 'Estado inicial: Pendiente', createdAt: '2026-08-01T10:00:00.000Z' },
      { id: 'created', message: 'Reporte creado', createdAt: '2026-08-01T10:00:00.000Z' },
    ]

    expect(sortReportActivity(activity).map((item) => item.id)).toEqual([
      'created', 'pending', 'progress', 'resolved', 'comment', 'closed',
    ])
  })

  it('colapsa comentarios idénticos aunque tengan identificadores distintos', () => {
    const activity = [
      { id: '1', message: 'Comentario: Problema resuelto', createdAt: '2026-08-01T10:00:00.000Z' },
      { id: '2', message: 'Comentario:  problema resuelto ', createdAt: '2026-08-01T10:01:00.000Z' },
      { id: '3', message: 'Comentario: Evidencia adjunta', createdAt: '2026-08-01T10:02:00.000Z' },
    ]
    expect(sortReportActivity(activity).map((item) => item.id)).toEqual(['1', '3'])
  })

  it('no muta el historial recibido', () => {
    const activity = [
      { id: '2', message: 'Reporte cerrado', createdAt: '2026-08-01T10:01:00.000Z' },
      { id: '1', message: 'Reporte creado', createdAt: '2026-08-01T10:00:00.000Z' },
    ]
    sortReportActivity(activity)
    expect(activity.map((item) => item.id)).toEqual(['2', '1'])
  })
})
