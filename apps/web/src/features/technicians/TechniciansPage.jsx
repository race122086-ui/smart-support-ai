import { useState } from 'react'
import { api } from '../../api/client.js'
import { queryKeys, useApiMutation, useApiQuery } from '../../api/queries.js'
import { ConfirmDialog, EmptyState, ErrorState, LoadingState, useToast } from '../../components/ui/Feedback.jsx'

export function TechniciansPage() {
  const [name, setName] = useState('')
  const [deleting, setDeleting] = useState(null)
  const notify = useToast()
  const technicians = useApiQuery(queryKeys.technicians, api.listTechnicians)
  const create = useApiMutation(api.addTechnician, [queryKeys.technicians, queryKeys.settings])
  const remove = useApiMutation(api.deleteTechnician, [queryKeys.technicians, queryKeys.settings, ['reports']])

  async function add(event) {
    event.preventDefault()
    if (!name.trim()) return
    try {
      await create.mutateAsync(name.trim())
      setName('')
      notify('Técnico agregado')
    } catch (error) {
      notify(error.message, 'error')
    }
  }

  async function confirmRemove() {
    try {
      await remove.mutateAsync(deleting.id)
      setDeleting(null)
      notify('Técnico eliminado')
    } catch (error) {
      notify(error.message, 'error')
    }
  }

  if (technicians.isLoading) return <LoadingState message="Cargando técnicos…" />
  if (technicians.isError) return <ErrorState error={technicians.error} onRetry={technicians.refetch} />
  return (
    <>
      <div className="page-heading"><div><span className="page-kicker">EQUIPO</span><h2>Técnicos</h2><p>Administra responsables disponibles para asignación.</p></div></div>
      <section className="workspace-card">
        <form className="module-inline-form" onSubmit={add}><label htmlFor="technician-name">Nuevo técnico</label><input id="technician-name" value={name} maxLength="120" onChange={(event) => setName(event.target.value)} required /><button className="btn btn--primary" type="submit" disabled={create.isPending}>Agregar</button></form>
        {technicians.data.length ? <ul className="module-list">{technicians.data.map((technician) => <li className="module-list__item" key={technician.id}><div><strong>{technician.name}</strong><span>{technician.active ? 'Disponible' : 'Inactivo'}</span></div><button className="btn btn--danger" type="button" onClick={() => setDeleting(technician)}>Eliminar</button></li>)}</ul> : <EmptyState title="No hay técnicos registrados." description="Agrega el primer integrante del equipo." />}
      </section>
      {deleting && <ConfirmDialog title={`Eliminar a ${deleting.name}`} onClose={() => setDeleting(null)} onConfirm={confirmRemove}>Los tickets asignados volverán a quedar sin responsable.</ConfirmDialog>}
    </>
  )
}
