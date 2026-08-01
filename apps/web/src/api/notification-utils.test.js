import { describe, expect, it } from 'vitest'
import { mergeNotification } from './notification-utils.js'

describe('mergeNotification', () => {
  it('agrega una notificación nueva al inicio', () => {
    expect(mergeNotification([{ id: '1' }], { id: '2' })).toEqual([{ id: '2' }, { id: '1' }])
  })

  it('evita duplicados al reconectar o recibir el mismo evento', () => {
    const current = [{ id: '1', message: 'Persistida' }]
    expect(mergeNotification(current, { id: '1', message: 'Repetida' })).toBe(current)
  })
})
