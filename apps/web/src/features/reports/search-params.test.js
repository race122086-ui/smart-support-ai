import { describe, expect, it } from 'vitest'
import { parseReportSearchParams, updateReportSearchParams } from './search-params.js'

describe('filtros de tickets en URL', () => {
  it('aplica valores predeterminados con una URL vacía', () => {
    expect(parseReportSearchParams(new URLSearchParams())).toEqual({
      q: '',
      status: '',
      priority: '',
      technician: '',
      sort: 'recent',
      page: 1,
      pageSize: 12,
    })
  })

  it('conserva filtros válidos y corrige los valores malformados', () => {
    const params = new URLSearchParams('q=impresora&status=Pendiente&priority=Urgente&sort=nope&page=-4')
    expect(parseReportSearchParams(params)).toMatchObject({
      q: 'impresora',
      status: 'Pendiente',
      priority: '',
      sort: 'recent',
      page: 1,
    })
  })

  it('reinicia la página al cambiar un filtro', () => {
    const result = updateReportSearchParams(
      new URLSearchParams('status=Pendiente&page=4'),
      { status: 'Resuelto' }
    )
    expect(result.toString()).toBe('status=Resuelto')
  })
})
