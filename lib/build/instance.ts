import deepmerge from 'deepmerge'
import find from 'find'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import mkdirp from 'mkdirp'
import { extname, dirname, join, resolve } from 'path'
import _ from 'lodash'
import {
  Configuration as WebpackConfig,
  optimize,
  DefinePlugin,
  Stats,
  webpack,
} from 'webpack'
import * as ts from 'typescript'
import { VueLoaderPlugin } from 'vue-loader'
import { runInNewContext } from 'vm'

type EnvType = 'development' | 'production' | 'none'

const VALID_EXTENSIONS = ['js', 'json', 'ts']
const env: EnvType = (process.env.NODE_ENV as EnvType) || 'development'

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
  if (_.last(extname(path).split('.')) === 'ts')
    src = ts.transpileModule(src, {}).outputText
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

  const config = deepmerge<BuildConfig>(
    {
      rootDir: dirname(path),
      targets: ['api', 'server', 'client'],
    },
    loadScript(path)
  )

  const rootDir = resolve(config.rootDir as string)
  const targets = config.targets as BuildTarget[]
  const buildPath = join(rootDir, '.panther')
  const componentsName = findNamed(/\.vue$/, join(rootDir, 'components'))
  const layoutNames = findNamed(/\.vue$/, join(rootDir, 'layouts')).map((v) =>
    v.substring(1)
  )
  const pageNames = findNamed(/\.vue$/, join(rootDir, 'pages'))

  const defaultPlugins = [
    new optimize.LimitChunkCountPlugin({ maxChunks: 15 }),
    new optimize.MinChunkSizePlugin({ minChunkSize: 10000 }),
  ]

  const makeBaseWebpack = (target: BuildTarget): WebpackConfig => ({
    name: `Build for ${target} target`,
    devtool: env === 'development' ? 'source-map' : false,
    mode: env,
    entry: join(buildPath, target, 'index.ts'),
    output: {
      path: join(buildPath, target, 'dist'),
      publicPath: 'auto',
      filename(pathData) {
        return (pathData as any).chunk.name === 'main'
          ? 'bundle.dist.js'
          : '[chunkhash:8].js'
      },
      chunkFilename: '[chunkhash:8].js',
      enabledLibraryTypes: ['commonjs'],
      sourceMapFilename:
        env === 'development' ? '[chunkhash:8].js.map' : undefined,
      asyncChunks: true,
      chunkFormat: 'commonjs',
      clean: true,
      globalObject: 'this',
    },
    resolve: {
      alias: {
        panther$: join(
          'panther',
          'dist',
          target == 'api' ? 'all' : target,
          'index.js'
        ),
        vue$: join(
          'vue',
          'dist',
          `vue.runtime.esm-${target === 'client' ? 'browser' : 'bundler'}${
            env == 'production' ? '.prod' : ''
          }.js`
        ),
      },
      extensions: ['.vue', '.ts', '.js', '.json', '...'],
    },
    externals: {
      assert: 'commonjs assert',
      buffer: 'commonjs buffer',
      crypto: 'commonjs crypto',
      fs: 'commonjs fs',
      http: 'commonjs http',
      https: 'commonjs https',
      os: 'commonjs os',
      path: 'commonjs path',
      stream: 'commonjs stream',
      url: 'commonjs url',
      util: 'commonjs util',
      querystring: 'commonjs querystring',
      vm: 'commonjs vm',
      zlib: 'commonjs zlib',
    },
    optimization: {
      minimize: env === 'production',
      nodeEnv: env,
      chunkIds: 'deterministic',
      moduleIds: 'deterministic',
      runtimeChunk: true,
      splitChunks: {
        chunks: 'all',
        minSize: 10000,
        maxSize: 250000,
      },
    },
    module: {
      rules: [
        {
          test: /.m?js$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            options: {
              presets: [
                ['@babel/preset-env', { targets: 'defaults' }],
                '@babel/preset-typescript',
              ],
              plugins: ['@babel/plugin-transform-runtime'],
            },
          },
        },
        {
          test: /.ts$/,
          loader: 'ts-loader',
          exclude: /node_modules/,
          options: {
            appendTsSuffixTo: [/\.vue$/],
            configFile: join(rootDir, 'tsconfig.json'),
          },
        },
      ],
    },
  })

  const makeWebWebpack = (target: BuildTarget) =>
    deepmerge.all([
      makeBaseWebpack(target),
      {
        module: {
          rules: [
            {
              test: /\.scss$/,
              use: [
                'vue-style-loader',
                'style-loader',
                'css-loader',
                'sass-loader',
              ],
            },
            {
              test: /\.vue$/,
              loader: 'vue-loader',
              options: {
                loaders: {
                  ts: 'ts-loader',
                  scss: 'sass-loader',
                  js: 'babel-loader',
                },
              },
            },
          ],
        },
      },
    ])

  const webpackConfigFactory: Record<BuildTarget, WebpackConfig> = {
    api: {
      ...deepmerge.all([
        makeBaseWebpack('api'),
        {
          target: 'node',
        },
      ]),
      plugins: defaultPlugins,
    },
    client: {
      ...deepmerge.all([
        makeWebWebpack('client'),
        {
          target: 'web',
        },
      ]),
      plugins: [
        ...defaultPlugins,
        new VueLoaderPlugin(),
        new DefinePlugin({
          __VUE_OPTIONS_API__: env !== 'production',
          __VUE_PROD_DEVTOOLS__: env !== 'production',
        }),
      ],
    },
    server: {
      ...deepmerge.all([
        makeWebWebpack('server'),
        {
          target: 'node',
        },
      ]),
      plugins: [
        ...defaultPlugins,
        new DefinePlugin({
          __VUE_OPTIONS_API__: env !== 'production',
          __VUE_PROD_DEVTOOLS__: env !== 'production',
        }),
        new VueLoaderPlugin(),
      ],
    },
  }

  return {
    config,
    paths: {
      root: rootDir,
      build: buildPath,
    },
    entries: Object.fromEntries(
      targets.map((target) => {
        const imports =
          target !== 'api'
            ? [
                ...componentsName.map(
                  (name, i) =>
                    `import component${i} from '${join(
                      rootDir,
                      'components',
                      name
                    )}'`
                ),
                ...pageNames.map(
                  (name, i) =>
                    `import page${i} from '${join(rootDir, 'pages', name)}'`
                ),
                ...layoutNames.map(
                  (name, i) =>
                    `import layout${i} from '${join(rootDir, 'layouts', name)}'`
                ),
              ]
            : []

        const context: string[] = []

        switch (target) {
          case 'api':
            context.push('const context = {}')
            break
          case 'client':
            imports.push("import { createClientContext } from 'panther'")
            context.push(`const context = createClientContext({
  vue: {
    components: [${componentsName
      .map((name, i) => `component${i}`)
      .join(', ')}],
    pages: {${pageNames
      .map(
        (name, i) =>
          `'${name === '/index.vue' ? '/' : name.slice(0, -4)}': page${i}`
      )
      .join(', ')}},
    layouts: [${layoutNames.map((name, i) => `layout${i}`).join(', ')}]
  }
})\nconsole.log(context)`)
            break
          case 'server':
            imports.push("import { createServerContext } from 'panther'")
            context.push(`console.log(require('panther'))\nconst context = createServerContext({
  vue: {
    components: [${componentsName
      .map((name, i) => `component${i}`)
      .join(', ')}],
    pages: {${pageNames
      .map(
        (name, i) =>
          `'${name === '/index.vue' ? '/' : name.slice(0, -4)}': page${i}`
      )
      .join(', ')}},
    layouts: [${layoutNames.map((name, i) => `layout${i}`).join(', ')}]
  }
})\nconsole.log(context)`)
            break
        }

        return [
          target,
          [...imports, ...context, 'export default context'].join('\n'),
        ]
      })
    ) as Record<BuildTarget, string>,
    webpackConfigs: Object.fromEntries(
      targets.map((target) => [target, webpackConfigFactory[target]])
    ) as Record<BuildTarget, WebpackConfig>,
  }
}

export async function buildInstance(
  instance: BuildInstance
): Promise<Record<BuildTarget, Stats>> {
  generateBuildForWebpack(instance)

  const all: Promise<Stats>[] = []
  for (const key in instance.webpackConfigs) {
    const value = instance.webpackConfigs[key as BuildTarget]
    all.push(
      new Promise<Stats>((resolve, reject) =>
        webpack(value).run((error, stats) => {
          if (error) reject(error)
          if (stats) resolve(stats)
        })
      )
    )
  }

  return Object.fromEntries(
    (await Promise.all(all)).map((stats, i) => [
      Object.keys(instance.webpackConfigs)[i] as BuildTarget,
      stats,
    ])
  ) as Record<BuildTarget, Stats>
}

export function generateBuildForWebpack(
  instance: BuildInstance
): WebpackConfig[] {
  for (const key in instance.entries) {
    const value = instance.entries[key as BuildTarget]
    if (!existsSync(join(instance.paths.build, key)))
      mkdirp.sync(join(instance.paths.build, key))
    writeFileSync(join(instance.paths.build, key, 'index.ts'), value)
  }

  return Object.values(instance.webpackConfigs)
}
