import { App, Component, h, createSSRApp } from 'vue'
import PantherApp from './components/panther-app.vue'
import PantherBody from './components/panther-body.vue'
import createBaseContext, {
  BaseContext,
  BaseContextOptions,
} from '../base/context'

export interface WebContextOptions extends BaseContextOptions {
  vue: {
    components: Component[]
    layouts: Component[]
    pages: Record<string, Component>
  }
}

export interface WebContext extends BaseContext {
  options: WebContextOptions
  vue?: App
}

function mapComponents(list: Component[]): Record<string, Component> {
  return Object.fromEntries(
    Object.values(list).map((comp) => [comp.name, comp])
  )
}

export function createWebVue(context: WebContext): App {
  const app = createSSRApp({
    render: () => h(PantherApp),
  })

  const components: Record<string, Component> = {
    ...mapComponents([
      ...context.options.vue.components,
      ...context.options.vue.layouts,
      ...Object.values(context.options.vue.pages),
    ]),
    'panther-body': PantherBody,
  }

  for (const key in components) {
    app.component(key, components[key])
  }
  return app
}

export function createWebContext(options: WebContextOptions): WebContext {
  const base = createBaseContext(options) as WebContext
  return {
    ...base,
  }
}
