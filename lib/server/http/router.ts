import { Router } from 'express'
import { BaseContext } from '../../base/context'
import {
  ControllerEndpoint,
  RequestHandler,
  wrapControllerEndpoint,
} from './controller'

export interface RouterEndpoint {
  method:
    | 'all'
    | 'get'
    | 'post'
    | 'put'
    | 'delete'
    | 'patch'
    | 'options'
    | 'head'
  handle: ControllerEndpoint[] | ControllerEndpoint
}

export type RouterFactory = (
  context: BaseContext
) => Record<string, RouterEndpoint>

export function createRouter(
  factory: RouterFactory
): (context: BaseContext) => Router {
  return function (context: BaseContext) {
    const inst = factory(context)
    const router = Router()

    const controller = Object.fromEntries(
      Object.entries(inst).map(([key, endpoint]) => {
        return [
          key,
          Array.isArray(endpoint.handle)
            ? endpoint.handle.map((e) => wrapControllerEndpoint(e))
            : wrapControllerEndpoint(endpoint.handle),
        ] as [string, RequestHandler[] | RequestHandler]
      })
    )

    for (const key in controller) {
      const endpoint = inst[key]
      const handlers = controller[key]

      if (Array.isArray(handlers)) {
        router[endpoint.method](key, ...handlers)
      } else {
        router[endpoint.method](key, handlers)
      }
    }
    return router
  }
}
