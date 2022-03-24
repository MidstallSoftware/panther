import deepmerge from 'deepmerge'

const env = process.env.NODE_ENV || 'development'

export interface BaseContextOptions {
  debug?: boolean
}

export interface BaseContext {
  options: BaseContextOptions
}

export function createBaseContext(options: BaseContextOptions): BaseContext {
  return {
    options: deepmerge<BaseContextOptions>(
      {
        debug: env !== 'production',
      },
      options
    ),
  }
}
export default createBaseContext
