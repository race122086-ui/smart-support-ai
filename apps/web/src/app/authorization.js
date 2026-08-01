export const ADMIN_ONLY_ROLES = ['ADMIN']

export function canAccessAdminRoute(role) {
  return role === 'ADMIN'
}
