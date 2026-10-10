const path = require('path')

module.exports = {
  mode: 'development',
  entry: './dist-ts/index.js',

  output: {
    filename: 'app.js',
    path: path.resolve(__dirname, 'dist'),
    clean: true
  },

  devtool: 'source-map',

  devServer: {
    static: {
      directory: path.resolve(__dirname, 'public')
    },
    hot: true,
    port: 3000,
    watchFiles: ['dist-ts/**/*.js']
  }
}