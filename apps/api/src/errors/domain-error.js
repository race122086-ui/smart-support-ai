export class DomainError extends Error {
  constructor(code, message, statusCode, details) {
    super(message)
    this.name = 'DomainError'
    this.code = code
    this.statusCode = statusCode
    this.details = details
  }
}

export function notFound(resource = 'Reporte') {
  return new DomainError(
    `${resource.toUpperCase()}_NOT_FOUND`,
    `${resource} no encontrado`,
    404
  )
}

export function validationError(message, details) {
  return new DomainError('VALIDATION_ERROR', message, 422, details)
}
