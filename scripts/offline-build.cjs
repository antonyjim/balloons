const { createHash } = require('crypto')
const { Compilation, sources } = require('webpack')
module.exports = class OfflineBuildPlugin {
  apply(compiler) {
    compiler.hooks.thisCompilation.tap('OfflineBuild', compilation => {
      compilation.hooks.processAssets.tap({ name: 'OfflineBuild', stage: Compilation.PROCESS_ASSETS_STAGE_SUMMARIZE }, () => {
        const assets = compilation.getAssets().filter(({ name }) =>
          !['sw.js', '_headers'].includes(name) && !name.endsWith('.map') && !name.endsWith('.txt'))
          .sort((a, b) => a.name.localeCompare(b.name))
        const hash = createHash('sha256')
        for (const asset of assets) { hash.update(asset.name); hash.update(asset.source.buffer()) }
        const worker = compilation.getAsset('sw.js').source.source().toString()
        hash.update(worker)
        hash.update(String(process.env.FORCE_APP_UPDATE === 'true'))
        const version = hash.digest('hex').slice(0, 16)
        compilation.updateAsset('sw.js', new sources.RawSource(worker
            .replace('__BUILD_VERSION__', version).replace('["__PRECACHE__"]', JSON.stringify(assets.map(asset => '/' + asset.name)))))
        compilation.emitAsset('version.json', new sources.RawSource(JSON.stringify({
          version, forceUpdate: process.env.FORCE_APP_UPDATE === 'true'
        })))
      })
    })
  }
}
