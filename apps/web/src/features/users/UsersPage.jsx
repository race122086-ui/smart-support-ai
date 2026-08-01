import { useState } from 'react'
import { api } from '../../api/client.js'
import { queryKeys, useApiMutation, useApiQuery } from '../../api/queries.js'
import { ErrorState, LoadingState, useToast } from '../../components/ui/Feedback.jsx'

const emptyForm = { name: '', email: '', password: '', role: 'USER' }

export function UsersPage() {
  const notify = useToast()
  const users = useApiQuery(queryKeys.users, api.listUsers)
  const createUser = useApiMutation(api.createUser, [queryKeys.users])
  const updateUser = useApiMutation(({ id, changes }) => api.updateUser(id, changes), [queryKeys.users])
  const [form, setForm] = useState(emptyForm)

  async function submit(event) {
    event.preventDefault()
    try {
      await createUser.mutateAsync(form)
      setForm(emptyForm)
      notify('Usuario creado')
    } catch (error) {
      notify(error.message, 'error')
    }
  }

  async function toggle(user) {
    try {
      await updateUser.mutateAsync({ id: user.id, changes: { active: !user.active } })
      notify(user.active ? 'Usuario desactivado' : 'Usuario activado')
    } catch (error) {
      notify(error.message, 'error')
    }
  }

  return (
    <section className="module-page">
      <header className="module-header"><div><p className="eyebrow">Administración</p><h2>Usuarios</h2></div></header>
      <form className="settings-card user-form" onSubmit={submit}>
        <label>Nombre<input required maxLength="120" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
        <label>Correo<input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
        <label>Contraseña<input required type="password" minLength="12" autoComplete="new-password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></label>
        <label>Rol<select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}><option value="USER">Usuario</option><option value="TECHNICIAN">Técnico</option><option value="ADMIN">Administrador</option></select></label>
        <button className="btn btn--primary" disabled={createUser.isPending}>Crear usuario</button>
      </form>
      {users.isLoading && <LoadingState message="Cargando usuarios…" />}
      {users.isError && <ErrorState error={users.error} onRetry={users.refetch} />}
      <div className="settings-card table-scroll">
        <table className="users-table"><thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Estado</th><th>Acción</th></tr></thead>
          <tbody>{users.data?.map((user) => <tr key={user.id}><td>{user.name}</td><td>{user.email}</td><td>{user.role}</td><td>{user.active ? 'Activo' : 'Inactivo'}</td><td><button type="button" className="btn btn--secondary" onClick={() => toggle(user)}>{user.active ? 'Desactivar' : 'Activar'}</button></td></tr>)}</tbody>
        </table>
      </div>
    </section>
  )
}
