export interface BaseMessageInterface {
  data?: any
  error?: {
    message: string
    name: string
  }
  type: string
}

export class BaseMessage {
  private data: any
  private error?: Error
  private type = ''

  constructor(data: any, errorOrType: Error | string) {
    this.data = data
    if (errorOrType instanceof Error) this.error = errorOrType as Error
    else this.type = errorOrType as string
  }

  toJSON(): BaseMessageInterface {
    return this.error
      ? {
          error: { message: this.error.message, name: this.error.name },
          type: 'error',
        }
      : { data: this.data, type: this.type }
  }

  static fromJSON(json: BaseMessageInterface): BaseMessage {
    return new BaseMessage(json.data, json.error || json.type)
  }
}
