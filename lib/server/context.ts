import express from 'express'
import { renderToString } from 'vue/server-renderer'
import {
  WebContext,
  WebContextOptions,
  createWebContext,
  createWebVue,
} from '../web/context'

export type ServerContextOptions = WebContextOptions

export interface ServerContext extends WebContext {
  express: Express.Application
}

export function createServerContext(
  options: ServerContextOptions
): ServerContext {
  const ctx = {
    ...createWebContext(options),
    express: express(),
  }

  for (const p in options.vue.pages) {
    ctx.express.get(p, (req, res) => {
      const vue = createWebVue(ctx)
      renderToString(vue)
        .then((val) => res.send(val))
        .catch(() => res.status(500).send(''))
    })
  }
  return ctx
}
export default createServerContext
