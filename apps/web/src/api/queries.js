import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './client.js'

export const queryKeys = {
  reports: (params = {}) => ['reports', params],
  report: (id) => ['report', id],
  activity: (id) => ['activity', id],
  attachments: (id) => ['attachments', id],
  sla: (id) => ['sla', id],
  metrics: ['metrics'],
  technicians: ['technicians'],
  settings: ['settings'],
  notifications: ['notifications'],
  users: ['users'],
}

export function useReports(params) {
  return useQuery({ queryKey: queryKeys.reports(params), queryFn: () => api.listReports(params) })
}

export function useReport(id) {
  return useQuery({
    queryKey: queryKeys.report(id),
    queryFn: () => api.getReport(id),
    enabled: Boolean(id),
  })
}

export function useApiQuery(queryKey, queryFn, options = {}) {
  return useQuery({ queryKey, queryFn, ...options })
}

export function useApiMutation(mutationFn, invalidations = []) {
  const client = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: async () => {
      await Promise.all(invalidations.map((key) => client.invalidateQueries({ queryKey: key })))
    },
  })
}

export async function invalidateReportData(client, id) {
  await Promise.all([
    client.invalidateQueries({ queryKey: ['reports'] }),
    client.invalidateQueries({ queryKey: queryKeys.report(id) }),
    client.invalidateQueries({ queryKey: queryKeys.activity(id) }),
    client.invalidateQueries({ queryKey: queryKeys.attachments(id) }),
    client.invalidateQueries({ queryKey: queryKeys.sla(id) }),
    client.invalidateQueries({ queryKey: queryKeys.metrics }),
    client.invalidateQueries({ queryKey: queryKeys.notifications }),
  ])
}
