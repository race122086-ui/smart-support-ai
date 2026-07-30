import { DEPARTMENTS, PRIORITIES } from '@smartsupport/contracts'

export function TicketForm({ initialValue = {}, submitLabel = 'Registrar falla', pending, onSubmit }) {
  function handleSubmit(event) {
    event.preventDefault()
    if (!event.currentTarget.reportValidity()) return
    const form = new FormData(event.currentTarget)
    onSubmit({
      userName: form.get('userName').trim(),
      contactEmail: form.get('contactEmail').trim(),
      contactPhone: form.get('contactPhone').trim(),
      department: form.get('department'),
      description: form.get('description').trim(),
      priority: form.get('priority'),
    })
  }

  return (
    <form className="report-form" noValidate onSubmit={handleSubmit}>
      <div className="form-group"><label htmlFor="userName">Nombre del usuario</label><input id="userName" name="userName" defaultValue={initialValue.userName} required maxLength="120" autoComplete="name" /></div>
      <div className="form-group"><label htmlFor="contactEmail">Correo de contacto</label><input type="email" id="contactEmail" name="contactEmail" defaultValue={initialValue.contactEmail} required maxLength="254" autoComplete="email" /></div>
      <div className="form-group"><label htmlFor="contactPhone">Número de contacto</label><input type="tel" id="contactPhone" name="contactPhone" defaultValue={initialValue.contactPhone} required maxLength="40" autoComplete="tel" /></div>
      <div className="form-group"><label htmlFor="department">Área o departamento</label><select id="department" name="department" defaultValue={initialValue.department || DEPARTMENTS[0]}>{DEPARTMENTS.map((department) => <option key={department}>{department}</option>)}</select></div>
      <div className="form-group form-group--description"><label htmlFor="description">Descripción de la falla</label><textarea id="description" name="description" rows="5" defaultValue={initialValue.description} required maxLength="2000" /></div>
      <div className="form-group"><label htmlFor="priority">Prioridad</label><select id="priority" name="priority" defaultValue={initialValue.priority || PRIORITIES[1]}>{PRIORITIES.map((priority) => <option key={priority}>{priority}</option>)}</select></div>
      <button type="submit" className="btn btn--primary btn--full" disabled={pending}>{pending ? 'Guardando…' : submitLabel}</button>
    </form>
  )
}
