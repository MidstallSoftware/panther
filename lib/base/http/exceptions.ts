import { ValidationError as JSONValidationError } from 'jsonschema'
import { ValidationError as DBValidationError, NotFoundError as DBNotFoundError } from 'objection'
import { DBError } from 'db-errors'

export interface HttpErrorJSON {
  status: number
  detail: string
}

export interface HttpErrorWithJSON {
  status: number
  detail: string
  errors: (JSONValidationError | DBValidationError | DBNotFoundError | DBError | string)[]
}

export class HttpError extends Error {
  status = 500
  detail = 'Internal server error'

  public toJSON(): HttpErrorJSON {
    return {
      status: this.status,
      detail: this.detail,
    }
  }
}

export class HttpNotFoundError extends HttpError {
  status = 404
  detail = 'Not found'
}

export class HttpValidationError extends HttpError {
  status = 422
  detail = 'Unprocessable Entity'
  errors: (JSONValidationError | DBValidationError)[] = []

  constructor(errors: (JSONValidationError | DBValidationError)[]) {
    super('Unprocessable Entity')
    this.errors = errors
  }

  public toJSON(): HttpErrorWithJSON {
    return {
      status: this.status,
      detail: this.detail,
      errors: this.errors,
    }
  }
}

export class HttpUnauthorizedError extends HttpError {
  status = 401
  detail = 'Unauthorized'
  errors: string[]

  constructor(message: string) {
    super('Unauthorized request')
    this.errors = [message]
  }

  public toJSON(): HttpErrorWithJSON {
    return {
      status: this.status,
      detail: this.detail,
      errors: this.errors,
    }
  }
}

export class HttpBadRequestError extends HttpError {
  status = 400
  detail = 'Bad request'
  errors: string[]

  constructor(message: string) {
    super('Bad request')
    this.errors = [message]
  }

  public toJSON(): HttpErrorWithJSON {
    return {
      status: this.status,
      detail: this.detail,
      errors: this.errors,
    }
  }
}
