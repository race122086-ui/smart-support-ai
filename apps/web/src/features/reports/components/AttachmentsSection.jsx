import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { api } from '../../../api/client.js'
import { queryKeys, useApiQuery } from '../../../api/queries.js'
import { useToast } from '../../../components/ui/Feedback.jsx'
import { formatBytes, formatDate } from '../../../utils/format.js'

const acceptedFiles = '.png,.jpg,.jpeg,.gif,.webp,.pdf,.txt,.csv,.md,.log,.json'

export function AttachmentsSection({ reportId, report, user }) {
  const client = useQueryClient()
  const notify = useToast()
  const fileInput = useRef(null)
  const [hasFile, setHasFile] = useState(false)
  const attachments = useApiQuery(
    queryKeys.attachments(reportId),
    () => api.listAttachments(reportId),
    { enabled: Boolean(reportId) }
  )

  const invalidate = async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: queryKeys.attachments(reportId) }),
      client.invalidateQueries({ queryKey: queryKeys.activity(reportId) }),
      client.invalidateQueries({ queryKey: queryKeys.report(reportId) }),
    ])
  }

  const upload = useMutation({
    mutationFn: (file) => api.uploadAttachment(reportId, file),
    onSuccess: async () => {
      notify('Archivo adjuntado')
      if (fileInput.current) fileInput.current.value = ''
      setHasFile(false)
      await invalidate()
    },
    onError: (error) => notify(error.message, 'error'),
  })

  const remove = useMutation({
    mutationFn: (attachmentId) => api.deleteAttachment(reportId, attachmentId),
    onSuccess: async () => {
      notify('Archivo eliminado')
      await invalidate()
    },
    onError: (error) => notify(error.message, 'error'),
  })

  const download = async (attachment) => {
    try {
      const { blob, fileName } = await api.downloadAttachment(reportId, attachment.id)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = fileName
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch (error) {
      notify(error.message || 'No se pudo descargar el archivo', 'error')
    }
  }

  const canDelete = (attachment) => user.role === 'ADMIN'
    || attachment.uploadedById === user.id
    || report.createdById === user.id

  return (
    <section className="activity" aria-labelledby="attachments-title">
      <h3 id="attachments-title">Adjuntos</h3>
      {attachments.isLoading && <p>Cargando adjuntos…</p>}
      {!attachments.isLoading && (!attachments.data || attachments.data.length === 0) && (
        <p className="empty-state__hint">Este ticket no tiene archivos adjuntos.</p>
      )}
      {attachments.data && attachments.data.length > 0 && (
        <ul className="attachment-list">
          {attachments.data.map((attachment) => (
            <li className="attachment-item" key={attachment.id}>
              <span className="attachment-item__name" title={attachment.fileName}>{attachment.fileName}</span>
              <span className="attachment-item__meta">{formatBytes(attachment.size)} · {formatDate(attachment.createdAt)}{attachment.uploadedBy ? ` · ${attachment.uploadedBy}` : ''}</span>
              <span className="attachment-item__actions">
                <button className="btn btn--secondary" type="button" onClick={() => download(attachment)}>Descargar</button>
                {canDelete(attachment) && <button className="btn btn--danger" type="button" disabled={remove.isPending} onClick={() => remove.mutate(attachment.id)}>Eliminar</button>}
              </span>
            </li>
          ))}
        </ul>
      )}
      <form className="comment-box" onSubmit={(event) => {
        event.preventDefault()
        const file = fileInput.current?.files?.[0]
        if (file) upload.mutate(file)
      }}>
        <label className="sr-only" htmlFor="attachment-file">Seleccionar archivo</label>
        <input id="attachment-file" ref={fileInput} className="comment-input" type="file" accept={acceptedFiles} onChange={() => setHasFile(Boolean(fileInput.current?.files?.length))} />
        <button className="btn btn--comment" type="submit" disabled={!hasFile || upload.isPending}>{upload.isPending ? 'Adjuntando…' : 'Adjuntar'}</button>
      </form>
    </section>
  )
}
