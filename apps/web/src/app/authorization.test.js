import { describe, expect, it } from 'vitest'
import { ADMIN_ONLY_ROLES, canAccessAdminRoute } from './authorization.js'

describe('rutas administrativas', () => {
  it('solo permite entrar a ADMIN', () => {
    expect(canAccessAdminRoute('ADMIN')).toBe(true)
    expect(canAccessAdminRoute('TECHNICIAN')).toBe(false)
    expect(canAccessAdminRoute('USER')).toBe(false)
    expect(ADMIN_ONLY_ROLES).toEqual(['ADMIN'])
  })
})
