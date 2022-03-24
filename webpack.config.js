const path = require('path')
const { VueLoaderPlugin } = require('vue-loader')
const webpack = require('webpack')
const { dependencies } = require('./package.json')

const env = process.env.NODE_ENV || 'development'

const baseConfig = {
  devtool: env === 'development' ? 'source-map' : false,
  target: 'node',
  mode: env,
  output: {
    clean: true,
    publicPath: 'auto',
    filename: 'index.js',
    assetModuleFilename: '[hash:8].[ext]',
    sourceMapFilename: '[chunkhash:8].js.map',
    chunkFilename: '[chunkhash:8].js',
    enabledLibraryTypes: ['commonjs'],
    asyncChunks: false,
    chunkFormat: 'commonjs',
    chunkLoading: 'require',
    library: {
      type: 'commonjs',
    },
    globalObject: 'this',
  },
  resolve: {
    extensions: ['.vue', '.ts', '.js', '.json', '...'],
  },
  externals: Object.fromEntries(
    Object.entries(dependencies).map(([pkg]) => [pkg, pkg])
  ),
  externalsType: 'node-commonjs',
  optimization: {
    chunkIds: 'natural',
    moduleIds: 'deterministic',
    minimize: env === 'production',
  },
  plugins: [
    new VueLoaderPlugin(),
    new webpack.optimize.LimitChunkCountPlugin({ maxChunks: 15 }),
    new webpack.optimize.MinChunkSizePlugin({ minChunkSize: 10000 }),
  ],
  module: {
    rules: [
      {
        test: /.m?js$/,
        exclude: /(node_modules|example)/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [
              ['@babel/preset-env', { targets: 'defaults' }],
              '@babel/preset-typescript',
            ],
            plugins: [
              [
                '@babel/plugin-transform-runtime',
                {
                  corejs: '3',
                },
              ],
            ],
          },
        },
      },
      {
        test: /.ts$/,
        loader: 'ts-loader',
        exclude: /(node_modules|example)/,
        options: {
          appendTsSuffixTo: [/\.vue$/],
        },
      },
      {
        test: /\.scss$/,
        use: ['vue-style-loader', 'style-loader', 'css-loader', 'sass-loader'],
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
}

module.exports = [
  {
    ...baseConfig,
    name: 'All',
    entry: path.join(__dirname, 'lib', 'index.ts'),
    output: {
      ...baseConfig.output,
      path: path.join(__dirname, 'dist', 'all'),
    },
    resolve: {
      ...baseConfig.resolve,
      alias: {
        vue$: path.join(
          'vue',
          'dist',
          `vue.runtime.esm-bundler${env == 'production' ? '.prod' : ''}.js`
        ),
      },
    },
  },
  {
    ...baseConfig,
    name: 'Client',
    externals: Object.fromEntries(
      Object.entries(baseConfig.externals).filter(([name]) => name !== 'vue')
    ),
    entry: path.join(__dirname, 'lib', 'client', 'index.ts'),
    output: {
      ...baseConfig.output,
      path: path.join(__dirname, 'dist', 'client'),
    },
    resolve: {
      ...baseConfig.resolve,
      alias: {
        vue$: path.join(
          'vue',
          'dist',
          `vue.runtime.esm-browser${env == 'production' ? '.prod' : ''}.js`
        ),
      },
    },
  },
  {
    ...baseConfig,
    name: 'Server',
    entry: path.join(__dirname, 'lib', 'server', 'index.ts'),
    output: {
      ...baseConfig.output,
      path: path.join(__dirname, 'dist', 'server'),
    },
    resolve: {
      ...baseConfig.resolve,
      alias: {
        vue$: path.join(
          'vue',
          'dist',
          `vue.runtime.esm-bundler${env == 'production' ? '.prod' : ''}.js`
        ),
      },
    },
  },
]
