import deepmerge from 'deepmerge'
import find, { fileSync } from 'find'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import mkdirp from 'mkdirp'
import { extname, dirname, join, resolve } from 'path'
import _ from 'lodash'
import { Configuration as WebpackConfig, DefinePlugin, Stats, webpack } from 'webpack'
import * as ts from 'typescript'
import { runInNewContext } from 'vm'

const VALID_EXTENSIONS = [
  'js',
  'json',
  'ts'
]

const env = process.env.NODE_ENV || 'development'

export type BuildTarget = 'api' | 'server' | 'client'

export interface BuildConfig {
  rootDir?: string
  targets?: BuildTarget[]
}

export interface BuildInstance {
  config: BuildConfig
  paths: {
    root: string
    build: string
  }
  entries: Record<BuildTarget, string>
  webpackConfigs: Record<BuildTarget, WebpackConfig>
}

function loadScript(path: string): any {
  let src = readFileSync(path, 'utf-8')
  if (_.last(extname(path).split('.')) === 'ts') src = ts.transpileModule(src, {}).outputText
  return runInNewContext(src, { module: { exports: {} }, exports: {} })
}

function findNamed(regex: RegExp, path: string): string[] {
  return find.fileSync(regex, path).map((v) => v.replace(path, ''))
}

export function defineBuildInstance(path: string): BuildInstance {
  if (!VALID_EXTENSIONS.includes(_.last(extname(path).split('.')) as string)) {
    for (const ext in VALID_EXTENSIONS) {
      const p = `${path}.${ext}`
      if (existsSync(p)) return defineBuildInstance(p)
    }

    throw new Error(`Invalid file ${path}, needs a valid extension`)
  }
  
  const config = deepmerge<BuildConfig>({
    rootDir: dirname(path),
    targets: ['api', 'server', 'client']
  }, loadScript(path))
  
  const rootDir = resolve(config.rootDir as string)
  const targets = config.targets as BuildTarget[]
  const buildPath = join(rootDir, '.panther')
  const componentsName = findNamed(/\.vue$/, join(rootDir, 'components'))
  const layoutNames = findNamed(/\.vue$/, join(rootDir, 'layouts')).map((v) => v.substring(1))
  const pageNames = findNamed(/\.vue$/, join(rootDir, 'pages'))
  
  return {
    config,
    paths: {
      root: rootDir,
      build: buildPath
    },
    entries: Object.fromEntries(targets.map((target) => {
      const imports = target !== 'api' ? [
        ...componentsName.map((name, i) => `import component${i} from '${join(rootDir, 'components', name)}'`),
        ...pageNames.map((name, i) => `import page${i} from '${join(rootDir, 'pages', name)}'`),
        ...layoutNames.map((name, i) => `import layout${i} from '${join(rootDir, 'layouts', name)}'`),
      ] : []
      
      const context: string[] = []
      
      switch (target) {
        case 'client':
          imports.push('import vue from Vue')
          break
        case 'server':
          imports.push('import { createServerContext } from \'panther\'')
          context.push(`const context = createServerContext({
  vue: {
    components: [${componentsName.map((name, i) => `component${i}`).join(', ')}],
    pages: [${pageNames.map((name, i) => `page${i}`).join(', ')}],
    layouts: [${layoutNames.map((name, i) => `layout${i}`).join(', ')}]
  }
})\nconsole.log(context)`)
          break
      }

      return [ target, [
        ...imports,
        ...context
      ].join('\n') ]
    })) as Record<BuildTarget, string>,
    webpackConfigs: Object.fromEntries(targets.map((target) => [ target, {
      devtool: false,
      mode: env,
      entry: join(buildPath, target, 'index.ts'),
      output: {
        path: join(buildPath, target, 'dist'),
        filename: 'bundle.dist.js',
      },
      resolve: {
        alias: {
          '~': config.rootDir,
          'panther': resolve(join(__dirname, '..', '..'))
        }
      },
      module: {
        rules: [
          {
            test: /\.scss$/,
            use: [
              'style-loader',
              'css-loader',
              'sass-loader',
            ]
          },
          {
            test: /\.vue$/,
            loader: 'vue-loader',
            options: {
              loaders: {
                ts: 'ts-loader',
                scss: 'sass-loader',
                js: 'babel-loader'
              }
            }
          },
          {
            test: /.m?js$/,
            exclude: /node_modules/,
            use: {
              loader: 'babel-loader',
              options: {
                presets: [
                  ['@babel/preset-env', { targets: 'defaults' }]
                ]
              }
            }
          },
          {
            test: /.ts$/,
            loader: 'ts-loader',
            exclude: /node_modules/,
            options: {
              appendTsSuffixTo: [/\.vue$/],
              configFile: join(rootDir, 'tsconfig.json')
            },
          }
        ],
      },
      plugins: [
        new DefinePlugin({
          'process.env.NODE_ENV': `'${env}'`
        })
      ],
      target: target === 'client' ? 'web' : 'node',
      externals: target !== 'client' ? {
        fs: 'require(\'fs\')'
      } : undefined
    } as WebpackConfig ])) as Record<BuildTarget, WebpackConfig>
  }
}

export async function buildInstance(instance: BuildInstance) {
  for (const key in instance.entries) {
    const value = instance.entries[key as BuildTarget]
    if (!existsSync(join(instance.paths.build, key))) await mkdirp(join(instance.paths.build, key))
    writeFileSync(join(instance.paths.build, key, 'index.ts'), value)
  }

  const all: Promise<Stats>[] = []
  for (const key in instance.webpackConfigs) {
    const value = instance.webpackConfigs[key as BuildTarget]
    all.push(new Promise<Stats>((resolve, reject) => webpack(value).run((error, stats) => {
      if (error) reject(error)
      if (stats) resolve(stats)
    })))
  }

  await Promise.all(all)
}