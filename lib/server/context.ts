import express from 'express'
import { Component } from 'vue'
import createBaseContext, { BaseContext, BaseContextOptions } from '../base/context'

export interface ServerContextOptions extends BaseContextOptions {
  vue?: {
    components?: Component[],
    layouts?: Component[],
    pages?: Component[]
  }
}

export interface ServerContext extends BaseContext {
  express: Express.Application
}

export function createServerContext(options: ServerContextOptions): ServerContext {
  return {
    ...createBaseContext(options),
    express: express(),
  }
}
export default createServerContext