const path = require('path')
const CopyWebpackPlugin = require('copy-webpack-plugin')
const OfflineBuildPlugin = require('./scripts/offline-build.cjs')

module.exports = {
  mode: 'development',
  entry: './dist-ts/index.js',
  resolve: {
    alias: {
      'sketchpad-markup': path.resolve(__dirname, 'src/sketchpad/index.html'),
      'sketchpad-styles': path.resolve(__dirname, 'src/sketchpad/style.css')
    }
  },
  module: { rules: [{ test: /\.(html|css)$/, type: 'asset/source' }] },

  output: {
    filename: 'app.js',
    path: path.resolve(__dirname, 'dist'),
    publicPath: "/",
    clean: true
  },

  plugins: [
    new CopyWebpackPlugin({
      patterns: [
        { from: 'public', to: '.' }
      ]
    }),
    new OfflineBuildPlugin()
  ],


  devtool: 'source-map',

  devServer: {
    static: {
      directory: path.resolve(__dirname, 'public')
    },
    hot: true,
    port: 3000,
    watchFiles: ['dist-ts/**/*.js', 'src/sketchpad/*.html', 'src/sketchpad/*.css']
  }
}
