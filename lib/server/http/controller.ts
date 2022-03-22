import { Request, Response, NextFunction } from 'express'
import { BaseMessage } from '../../base/http/message'

export type RequestHandler = (req: Request, res: Response, next: NextFunction) => void
export type ControllerEndpoint = (req: Request, res: Response, next: NextFunction) => Promise<BaseMessage | string>
export type ControllerFactory = () => Record<string, ControllerEndpoint[] | ControllerEndpoint>

export function wrapControllerEndpoint(endpoint: ControllerEndpoint): RequestHandler {
  return function(req: Request, res: Response, next: NextFunction) {
    endpoint(req, res, next)
      .then((body) => body instanceof BaseMessage ? res.json(body) : res.send(body))
      .catch(e => next(e))
  }
}