const { defineBuildInstance, generateBuildForWebpack } = require('panther')
const path = require('path')

module.exports = generateBuildForWebpack(
  defineBuildInstance(path.join(__dirname, 'panther.config.ts'))
)
