import { PRIORITIES, ROLES } from '@smartsupport/contracts'
import { useState } from 'react'
import { api } from '../../api/client.js'
import { queryKeys, useApiMutation, useApiQuery } from '../../api/queries.js'
import { ErrorState, LoadingState, useToast } from '../../components/ui/Feedback.jsx'
import { downloadJson } from '../../utils/format.js'
import { normalizeBackup } from '../../../../../src/domain/backups.js'
import { getLegacyMigration, markLegacyMigrationComplete } from '../../../../../src/persistence/legacy-migration.js'

function LegacyMigrationNotice({ allowRecovery }) {
  const [dismissed, setDismissed] = useState(false)
  const migration = dismissed
    ? null
    : getLegacyMigration(undefined, { ignoreMarker: allowRecovery })
  const notify = useToast()
  const importMutation = useApiMutation(api.importBackup, [['reports'], queryKeys.metrics, queryKeys.settings, queryKeys.technicians, queryKeys.notifications])
  if (!migration) return null

  async function migrate() {
    downloadJson(migration.backup, 'smartsupport-respaldo-local')
    try {
      const result = await importMutation.mutateAsync(migration.backup)
      markLegacyMigrationComplete(result.fingerprint)
      setDismissed(true)
      notify('Datos anteriores recuperados correctamente')
    } catch (error) {
      notify(`${error.message}. Los datos locales siguen disponibles.`, 'error')
    }
  }

  return <aside className="migration-notice"><div><strong>Hay datos anteriores disponibles</strong><p>{migration.counts.reports} reportes, {migration.counts.technicians} técnicos y {migration.counts.notifications} notificaciones pueden recuperarse. Se descargará un respaldo antes de restaurarlos.</p></div><button className="btn btn--primary" type="button" disabled={importMutation.isPending} onClick={migrate}>Respaldar y recuperar</button></aside>
}

export function SettingsPage() {
  const notify = useToast()
  const settings = useApiQuery(queryKeys.settings, api.getSettings)
  const metrics = useApiQuery(queryKeys.metrics, api.getMetrics)
  const update = useApiMutation(api.updateSettings, [queryKeys.settings])
  const importMutation = useApiMutation(api.importBackup, [['reports'], queryKeys.metrics, queryKeys.settings, queryKeys.technicians, queryKeys.notifications])

  async function saveProfile(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    try {
      await update.mutateAsync({ profile: { name: form.get('name').trim(), role: form.get('role') } })
      notify('Perfil actualizado')
    } catch (error) {
      notify(error.message, 'error')
    }
  }

  async function saveSla(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const sla = Object.fromEntries(PRIORITIES.map((priority) => [priority, Number(form.get(priority))]))
    try {
      await update.mutateAsync({ sla })
      notify('Tiempos de respuesta actualizados')
    } catch (error) {
      notify(error.message, 'error')
    }
  }

  async function exportBackup() {
    try {
      downloadJson(await api.exportBackup())
    } catch (error) {
      notify(error.message, 'error')
    }
  }

  async function importBackup(event) {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const backup = normalizeBackup(JSON.parse(await file.text()))
      await importMutation.mutateAsync(backup)
      notify('Respaldo importado correctamente')
    } catch (error) {
      notify(error.message || 'El respaldo no es válido', 'error')
    } finally {
      event.target.value = ''
    }
  }

  if (settings.isLoading) return <LoadingState message="Cargando configuración…" />
  if (settings.isError) return <ErrorState error={settings.error} onRetry={settings.refetch} />
  return (
    <>
      <div className="page-heading"><div><span className="page-kicker">SISTEMA</span><h2>Configuración</h2><p>Perfil, SLA y respaldos de SmartSupport.</p></div></div>
      <LegacyMigrationNotice allowRecovery={metrics.data?.total === 0} />
      <div className="settings-grid">
        <section className="workspace-card"><h3>Acceso y rol</h3><form className="module-form" onSubmit={saveProfile}><label htmlFor="profile-name">Nombre</label><input id="profile-name" name="name" defaultValue={settings.data.profile.name} required maxLength="120" /><label htmlFor="profile-role">Rol</label><select id="profile-role" name="role" defaultValue={settings.data.profile.role}>{ROLES.map((role) => <option key={role}>{role}</option>)}</select><button className="btn btn--primary" disabled={update.isPending}>Guardar perfil</button></form></section>
        <section className="workspace-card"><h3>Tiempos de respuesta</h3><form className="module-form" onSubmit={saveSla}>{PRIORITIES.map((priority) => <label key={priority} htmlFor={`sla-${priority}`}>{priority}<span className="input-suffix"><input id={`sla-${priority}`} name={priority} type="number" min="1" max="720" defaultValue={settings.data.sla[priority]} required /> horas</span></label>)}<button className="btn btn--primary" disabled={update.isPending}>Guardar SLA</button></form></section>
        <section className="workspace-card"><h3>Respaldo de datos</h3><p>Exporta una copia completa o restaura un archivo validado por la API.</p><div className="database-actions"><button className="btn btn--secondary" type="button" onClick={exportBackup}>Exportar JSON</button><label className="btn btn--primary import-label">Importar JSON<input className="sr-only" type="file" accept="application/json,.json" onChange={importBackup} /></label></div></section>
      </div>
    </>
  )
}
