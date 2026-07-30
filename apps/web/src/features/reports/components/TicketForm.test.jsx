import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { TicketForm } from './TicketForm.jsx'

describe('TicketForm', () => {
  it('envía un ticket válido con los textos recortados', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<TicketForm onSubmit={onSubmit} />)

    await user.type(screen.getByLabelText('Nombre del usuario'), '  Ana  ')
    await user.type(screen.getByLabelText('Correo de contacto'), 'ana@example.com')
    await user.type(screen.getByLabelText('Número de contacto'), '55 1234')
    await user.type(screen.getByLabelText('Descripción de la falla'), '  Sin red  ')
    await user.click(screen.getByRole('button', { name: 'Registrar falla' }))

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      userName: 'Ana',
      contactEmail: 'ana@example.com',
      contactPhone: '55 1234',
      description: 'Sin red',
      priority: 'Media',
    }))
  })

  it('no envía datos cuando faltan campos requeridos', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<TicketForm onSubmit={onSubmit} />)
    await user.click(screen.getByRole('button', { name: 'Registrar falla' }))
    expect(onSubmit).not.toHaveBeenCalled()
  })
})
