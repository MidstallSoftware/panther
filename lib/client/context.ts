import {
  WebContext,
  WebContextOptions,
  createWebContext,
  createWebVue,
} from '../web/context'

export type ClientContextOptions = WebContextOptions
export type ClientContext = WebContext

export function createClientContext(
  options: ClientContextOptions
): ClientContext {
  const base = createWebContext(options)
  return {
    ...base,
    vue: createWebVue(base),
  }
}
export default createClientContext
